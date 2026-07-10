import { BasesView, ButtonComponent, Menu, TFile, setIcon } from "obsidian";
import type { BasesViewFactory } from "obsidian";
import { BASES_KANBAN_VIEW_TYPE } from "../constants";
import { CreateTaskModal, EditTaskModal } from "../modals/TaskModals";
import { statusEquals } from "../status";
import { getDueClass, getTaskTitle } from "../taskFields";
import { formatDateForInput, formatDateLabel, formatDateTimeForInput } from "../utils/date";

const COLUMN_ACCENTS = [
  "#7d8b84",
  "#8793ad",
  "#86a39a",
  "#b39a7c",
  "#819f88",
  "#9a8fa9",
  "#b28c8c"
];

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

function formatReferenceLabel(value) {
  const text = String(value || "").trim();
  const wikilink = text.match(/^\[\[(.+)\]\]$/);
  if (!wikilink) return text;

  const target = wikilink[1];
  const alias = target.includes("|") ? target.split("|").pop() : target;
  return alias.split("/").pop();
}

function formatCompactDate(value) {
  return formatDateForInput(value).replace(/-/g, "/");
}

function formatDueDateParts(value) {
  const dateText = formatDateForInput(value);
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthIndex = Number(match[2]) - 1;
  const month = months[monthIndex];
  if (!month) return null;

  return {
    year: match[1],
    dayMonth: `${Number(match[3])} ${month}`
  };
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
  }

  onload() {
    this.render();
  }

  onDataUpdated() {
    this.render();
  }

  async createFileForView() {
    this.openCreateTaskModal();
  }

  openCreateTaskModal(initialValues = {}) {
    new CreateTaskModal(this.plugin.app, this.plugin, initialValues).open();
  }

  render() {
    this.containerEl.empty();
    this.containerEl.addClass("frontmatter-kanban");
    this.containerEl.addClass("frontmatter-kanban-bases");

    const board = this.containerEl.createDiv({ cls: "frontmatter-kanban-board" });
    board.style.setProperty("--kanban-column-width", `${this.getColumnWidth()}px`);
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
    column.style.setProperty("--kanban-column-accent", COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length]);

    const header = column.createDiv({ cls: "frontmatter-kanban-column-header" });
    const title = header.createDiv({ cls: "frontmatter-kanban-column-title" });
    title.createSpan({ text: status });
    title.createSpan({ cls: "frontmatter-kanban-column-count", text: String(entries.length) });
    new ButtonComponent(header)
      .setIcon("plus")
      .setTooltip(`New task in ${status}`)
      .setClass("frontmatter-kanban-column-new")
      .onClick(() => this.openCreateTaskModal({ status }));

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
    const priority = String(task.frontmatter.priority || "").trim().toLowerCase();
    const priorityClass = priority ? `priority-${priority}` : "";
    const card = cards.createDiv({ cls: `frontmatter-kanban-card ${priorityClass}` });
    card.draggable = true;
    this.registerDomEvent(card, "dragstart", (event) => {
      if (!event.dataTransfer) return;
      card.addClass("is-dragging");
      event.dataTransfer.setData("text/plain", task.file.path);
      event.dataTransfer.effectAllowed = "move";
    });
    this.registerDomEvent(card, "dragend", () => {
      card.removeClass("is-dragging");
      this.suppressNextCardClick = true;
      this.containerEl.querySelectorAll(".frontmatter-kanban-cards.is-drag-over").forEach((element) => {
        element.classList.remove("is-drag-over");
      });
      this.containerEl.querySelectorAll(".frontmatter-kanban-column.is-drag-target").forEach((element) => {
        element.classList.remove("is-drag-target");
      });
      window.setTimeout(() => {
        this.suppressNextCardClick = false;
      }, 80);
    });
    this.registerDomEvent(card, "click", (event) => {
      if (this.suppressNextCardClick) return;
      if (event.detail > 1) return;
      if (this.cardClickTimer) window.clearTimeout(this.cardClickTimer);
      this.cardClickTimer = window.setTimeout(() => {
        this.cardClickTimer = null;
        new EditTaskModal(this.plugin.app, this.plugin, task).open();
      }, 300);
    });
    this.registerDomEvent(card, "dblclick", (event) => {
      event.preventDefault();
      if (this.cardClickTimer) {
        window.clearTimeout(this.cardClickTimer);
        this.cardClickTimer = null;
      }
      this.plugin.openTaskFile(task.file);
    });
    this.registerDomEvent(card, "contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.cardClickTimer) {
        window.clearTimeout(this.cardClickTimer);
        this.cardClickTimer = null;
      }
      this.openTaskMenu(event, task);
    });

    const workStart = formatCompactDate(task.frontmatter.work_start);
    const workEnd = formatCompactDate(task.frontmatter.work_end);
    const workRange = workStart && workEnd ? `${workStart} -> ${workEnd}` : workStart || workEnd;
    const dueDateParts = task.frontmatter.due ? formatDueDateParts(task.frontmatter.due) : null;

    const hero = card.createDiv({ cls: "frontmatter-kanban-card-hero" });
    const titleBlock = hero.createDiv({ cls: "frontmatter-kanban-card-title-block" });
    const titleText = titleBlock.createDiv({ cls: "frontmatter-kanban-card-title-wrap" });
    const titleTags = titleText.createDiv({ cls: "frontmatter-kanban-card-tags" });
    if (priority) {
      titleTags.createSpan({ cls: `frontmatter-kanban-card-priority-tag ${priorityClass}`, text: priority });
    }
    if (workRange) {
      titleTags.createSpan({ cls: "frontmatter-kanban-card-work-tag", text: workRange });
    }
    titleText.createDiv({ cls: "frontmatter-kanban-card-title", text: getTaskTitle(task) });

    const summary = this.getCardSummary(task);
    if (summary) {
      card.createDiv({ cls: "frontmatter-kanban-card-summary", text: summary });
    }

    this.renderTodoProgress(card, task);

    const project = formatReferenceLabel(task.frontmatter.project);
    const feature = formatReferenceLabel(task.frontmatter.feature);
    if (project || feature || dueDateParts) {
      card.createDiv({ cls: "frontmatter-kanban-card-divider" });
      const details = card.createDiv({ cls: "frontmatter-kanban-card-details" });
      if (project || feature) {
        const stats = details.createDiv({ cls: "frontmatter-kanban-card-stats" });
        if (project) {
          const item = stats.createDiv({ cls: "frontmatter-kanban-card-stat is-project" });
          setIcon(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "rocket");
          const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
          body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Project" });
          body.createSpan({ cls: "frontmatter-kanban-card-stat-value", text: project });
        }
        if (feature) {
          const item = stats.createDiv({ cls: "frontmatter-kanban-card-stat is-feature" });
          setIcon(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "wrench");
          const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
          body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Feature" });
          body.createSpan({ cls: "frontmatter-kanban-card-stat-value", text: feature });
        }
      }
      if (dueDateParts) {
        const item = details.createDiv({ cls: `frontmatter-kanban-card-stat is-due ${getDueClass(task)}` });
        setIcon(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "calendar");
        const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Due date" });
        const value = body.createSpan({ cls: "frontmatter-kanban-card-stat-value is-due-date" });
        value.createSpan({ cls: "frontmatter-kanban-card-due-year", text: dueDateParts.year });
        value.createSpan({ cls: "frontmatter-kanban-card-due-day-month", text: dueDateParts.dayMonth });
      }
    }
    if (false) {
      const meta = card.createDiv({ cls: "frontmatter-kanban-card-meta" });
      if (project) {
        meta.createSpan({ cls: "frontmatter-kanban-card-reference is-project", text: `🚀 ${project}` });
      }
      if (feature) {
        meta.createSpan({ cls: "frontmatter-kanban-card-reference is-feature", text: `🛠️ ${feature}` });
      }
      if (task.frontmatter.priority) {
        meta.createSpan({ cls: `priority-${task.frontmatter.priority}`, text: task.frontmatter.priority });
      }
      if (false) {
        meta.createSpan({ cls: "frontmatter-kanban-card-work", text: `Work on ${workOn}` });
      }
    }

    if (task.frontmatter.completed) {
      const footer = card.createDiv({ cls: "frontmatter-kanban-card-footer" });
      if (false) {
        const due = footer.createSpan({ cls: "frontmatter-kanban-card-date" });
        setIcon(due.createSpan(), "calendar");
        due.createSpan({ text: formatDateLabel(task.frontmatter.due) || formatDateTimeForInput(task.frontmatter.due).replace("T", " ") });
      }
      if (task.frontmatter.completed) {
        const completed = footer.createSpan({ cls: "frontmatter-kanban-card-date is-complete" });
        setIcon(completed.createSpan(), "check-circle-2");
        completed.createSpan({ text: formatDateLabel(task.frontmatter.completed) });
      }
    }
  }

  renderTodoProgress(card, task) {
    const todo = card.createDiv({ cls: "frontmatter-kanban-card-todos is-loading" });
    this.plugin.getTaskTodoStats(task.file)
      .then((stats) => {
        if (!todo.isConnected) return;
        todo.empty();
        todo.removeClass("is-loading");

        if (!stats.total) {
          todo.detach();
          return;
        }

        const progress = todo.createDiv({ cls: "frontmatter-kanban-card-todo-progress" });
        const fill = progress.createDiv({ cls: "frontmatter-kanban-card-todo-progress-fill" });
        fill.style.width = `${Math.round((stats.completed / stats.total) * 100)}%`;
        todo.createSpan({
          cls: "frontmatter-kanban-card-todo-count",
          text: `${stats.completed}/${stats.total}`
        });
      })
      .catch(() => {
        todo.detach();
      });
  }

  openTaskMenu(event, task) {
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle("Edit task")
      .setIcon("pencil")
      .onClick(() => new EditTaskModal(this.plugin.app, this.plugin, task).open()));
    menu.addItem((item) => item
      .setTitle("Open note")
      .setIcon("file-text")
      .onClick(() => this.plugin.openTaskFile(task.file)));
    menu.addSeparator();
    menu.addItem((item) => item
      .setTitle("Delete task")
      .setIcon("trash-2")
      .setWarning(true)
      .onClick(() => this.plugin.deleteTask(task.file)));
    menu.showAtMouseEvent(event);
  }

  getCardSummary(task) {
    const fm = task.frontmatter;
    return String(fm.description || fm.summary || fm.notes || "").trim();
  }
}

export function buildKanbanBasesViewFactory(plugin): BasesViewFactory {
  return function (controller, containerEl): BasesView {
    return new KanbanBasesView(controller, containerEl, plugin);
  };
}
