import { BasesView, TFile, setIcon } from "obsidian";
import type { BasesViewFactory } from "obsidian";
import { BASES_KANBAN_VIEW_TYPE } from "../constants";
import { CreateTaskModal } from "../modals/TaskModals";
import { statusEquals } from "../status";
import { renderTaskCard } from "./TaskCard";

const COLUMN_ACCENTS = [
  "#829C92",
  "#8D7896",
  "#70899D",
  "#A68A5D"
];

const STATUS_ACCENTS = {
  backlog: "#829C92",
  nextup: "#8D7896",
  next: "#8D7896",
  "next up": "#8D7896",
  ongoing: "#70899D",
  inprogress: "#70899D",
  "in progress": "#70899D",
  done: "#A68A5D"
};

function valueToString(value) {
  if (value === undefined || value === null) return "";
  if (value.constructor && value.constructor.name === "NullValue") return "";
  const text = String(value).trim();
  if (text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return "";
  return text;
}

function getEntryFile(entry) {
  return entry && entry.file instanceof TFile ? entry.file : null;
}

function getStatusAccent(status, fallback) {
  const normalized = String(status || "").trim().toLowerCase().replace(/[-_]+/g, " ");
  const compact = normalized.replace(/\s+/g, "");
  return STATUS_ACCENTS[normalized] || STATUS_ACCENTS[compact] || fallback;
}

export class KanbanBasesView extends BasesView {
  type = BASES_KANBAN_VIEW_TYPE;

  constructor(controller, containerEl, plugin) {
    super(controller);
    this.controller = controller;
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.cardClickTimer = null;
    this.suppressNextCardClick = false;
    this.createFileForView = async (baseFileName, frontmatterProcessor) => {
      this.openCreateTaskModal(this.getCreateTaskInitialValues(baseFileName, frontmatterProcessor));
    };
  }

  onload() {
    this.installBasesToolbarNewHandler();
    this.render();
  }

  onDataUpdated() {
    this.render();
  }

  openCreateTaskModal(initialValues = {}) {
    new CreateTaskModal(this.plugin.app, this.plugin, initialValues).open();
  }

  getCreateTaskInitialValues(baseFileName = "", frontmatterProcessor) {
    const initialValues = {};
    const title = String(baseFileName || "").trim();
    if (title) initialValues.title = title;
    if (typeof frontmatterProcessor === "function") {
      const frontmatter = {};
      frontmatterProcessor(frontmatter);
      Object.assign(initialValues, frontmatter);
    }
    return initialValues;
  }

  installBasesToolbarNewHandler() {
    this.registerDomEvent(document, "click", (event) => {
      if (!this.shouldHandleBasesNewClick(event)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.openCreateTaskModal();
    }, { capture: true });
  }

  shouldHandleBasesNewClick(event) {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const button = target ? target.closest("button, .clickable-icon, [role='button']") : null;
    if (!button || this.containerEl.contains(button)) return false;

    const label = `${button.getAttribute("aria-label") || ""} ${button.textContent || ""}`.trim().toLowerCase();
    if (!/(^|\s)new($|\s)/.test(label)) return false;

    const leaf = this.containerEl.closest(".workspace-leaf-content, .workspace-leaf");
    return !leaf || leaf.contains(button);
  }

  render() {
    this.containerEl.empty();
    this.containerEl.removeClass("frontmatter-timeline");
    this.containerEl.addClass("frontmatter-kanban");
    this.containerEl.addClass("frontmatter-kanban-bases");

    const board = this.containerEl.createDiv({ cls: "frontmatter-kanban-board" });
    board.setCssProps({ "--kanban-column-width": `${this.getColumnWidth()}px` });
    const groups = this.getGroups();

    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      this.renderColumn(board, group.status, group.entries, index);
    }
  }

  getColumnWidth() {
    const configured = this.config && typeof this.config.get === "function"
      ? Number(this.config.get("columnWidth"))
      : 380;
    if (!Number.isFinite(configured)) return 380;
    return Math.min(560, Math.max(280, configured));
  }

  getGroups() {
    const groupedData = this.data && Array.isArray(this.data.groupedData)
      ? this.data.groupedData
      : [];

    if (groupedData.length > 1 || (groupedData[0] && groupedData[0].hasKey && groupedData[0].hasKey())) {
      return this.mergeConfiguredStatuses(groupedData.map((group) => ({
        status: this.normalizeStatus(valueToString(group.key)),
        entries: this.getTaskFolderEntries(group.entries || [])
      })));
    }

    const entries = this.getTaskFolderEntries(this.data && Array.isArray(this.data.data) ? this.data.data : []);
    const groupsByStatus = new Map();
    for (const entry of entries) {
      const file = getEntryFile(entry);
      const frontmatter = file ? this.getFrontmatter(file) : {};
      const status = this.normalizeStatus(frontmatter.status || valueToString(entry.getValue && entry.getValue("note.status")));
      if (!groupsByStatus.has(status)) groupsByStatus.set(status, []);
      groupsByStatus.get(status).push(entry);
    }

    return this.mergeConfiguredStatuses(Array.from(groupsByStatus.entries()).map(([status, statusEntries]) => ({
      status,
      entries: statusEntries
    })));
  }

  getTaskFolderEntries(entries) {
    return entries.filter((entry) => {
      const file = getEntryFile(entry);
      return this.plugin.isKanbanTaskFile(file);
    });
  }

  normalizeStatus(value) {
    return valueToString(value) || this.plugin.getDefaultStatus();
  }

  mergeConfiguredStatuses(groups) {
    const result = [];
    const used = new Set();
    for (const status of this.plugin.settings.statuses) {
      const matching = groups.find((group) => statusEquals(group.status, status));
      result.push({
        status,
        entries: matching ? matching.entries : []
      });
      used.add(status.toLowerCase());
    }
    for (const group of groups) {
      if (used.has(String(group.status).toLowerCase())) continue;
      result.push(group);
    }
    return result;
  }

  getFrontmatter(file) {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    return Object.assign({}, (cache && cache.frontmatter) || {});
  }

  entryToTask(entry) {
    const file = getEntryFile(entry);
    if (!file) return null;
    const frontmatter = this.getFrontmatter(file);
    delete frontmatter.position;
    return { file, frontmatter, pluginSettings: this.plugin.settings };
  }

  renderColumn(board, status, entries, columnIndex) {
    const column = board.createDiv({ cls: "frontmatter-kanban-column" });
    column.dataset.status = status;
    column.setCssProps({ "--kanban-column-accent": getStatusAccent(status, COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length]) });

    const header = column.createDiv({ cls: "frontmatter-kanban-column-header" });
    const title = header.createDiv({ cls: "frontmatter-kanban-column-title" });
    title.createSpan({ text: status });
    title.createSpan({ cls: "frontmatter-kanban-column-count", text: String(entries.length) });
    const newTaskButton = header.createEl("button", { cls: "frontmatter-kanban-column-new" });
    newTaskButton.setAttr("aria-label", `New task in ${status}`);
    newTaskButton.setAttr("type", "button");
    setIcon(newTaskButton.createSpan({ cls: "frontmatter-kanban-column-new-icon" }), "plus");
    newTaskButton.createSpan({ text: "New Task" });
    this.registerDomEvent(newTaskButton, "click", () => this.openCreateTaskModal({ status }));

    const cards = column.createDiv({ cls: "frontmatter-kanban-cards" });
    this.registerDomEvent(cards, "dragover", (event) => {
      event.preventDefault();
      column.addClass("is-drag-target");
      cards.addClass("is-drag-over");
    });
    this.registerDomEvent(cards, "dragleave", (event) => {
      if (event.relatedTarget && cards.contains(event.relatedTarget)) return;
      column.removeClass("is-drag-target");
      cards.removeClass("is-drag-over");
    });
    this.registerDomEvent(cards, "drop", async (event) => {
      event.preventDefault();
      column.removeClass("is-drag-target");
      cards.removeClass("is-drag-over");
      const path = event.dataTransfer.getData("text/plain");
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.plugin.updateTaskStatus(file, status);
      }
    });

    for (const entry of entries) {
      const task = this.entryToTask(entry);
      if (task) this.renderCard(cards, task);
    }

    if (!entries.length) {
      cards.createDiv({ cls: "frontmatter-kanban-column-empty", text: "No tasks" });
    }
  }

  renderCard(cards, task) {
    renderTaskCard(this, cards, task, {
      onDragEnd: () => {
        this.containerEl.querySelectorAll(".frontmatter-kanban-cards.is-drag-over").forEach((element) => {
          element.classList.remove("is-drag-over");
        });
        this.containerEl.querySelectorAll(".frontmatter-kanban-column.is-drag-target").forEach((element) => {
          element.classList.remove("is-drag-target");
        });
      }
    });
  }
}

export function buildKanbanBasesViewFactory(plugin): BasesViewFactory {
  return function (controller, containerEl): BasesView {
    return new KanbanBasesView(controller, containerEl, plugin);
  };
}
