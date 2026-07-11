import { BasesView, ButtonComponent, TFile, setIcon } from "obsidian";
import type { BasesViewFactory } from "obsidian";
import { BASES_TIMELINE_VIEW_TYPE, PRIORITIES } from "../constants";
import { CreateTaskModal } from "../modals/TaskModals";
import { getPriorityWeight, getTaskTitle } from "../taskFields";
import { formatDateForInput } from "../utils/date";
import { renderTaskCard } from "./TaskCard";

const DAY_MS = 24 * 60 * 60 * 1000;
const LABEL_COLUMN_WIDTH = 124;

const PRIORITY_ACCENTS = {
  high: "#C98282",
  medium: "#C2A667",
  low: "#79A99F",
  none: "#70899D"
};

function getEntryFile(entry) {
  return entry && entry.file instanceof TFile ? entry.file : null;
}

function parseDateOnly(value) {
  const text = formatDateForInput(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function daysBetween(start, end) {
  const left = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const right = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((right.getTime() - left.getTime()) / DAY_MS);
}

function startOfWeek(date) {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return addDays(date, diff);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getIsoWeekNumber(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil((((target.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7);
}

function formatTaiwanDate(date, includeYear = true) {
  const prefix = includeYear ? `${date.getFullYear()}年` : "";
  return `${prefix}${date.getMonth() + 1}月${date.getDate()}日`;
}

function getWeekdayLabel(date) {
  return ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][date.getDay()];
}

function getPriorityKey(task) {
  const priority = String(task.frontmatter.priority || "").trim().toLowerCase();
  return PRIORITIES.includes(priority) ? priority : "none";
}

function getPriorityAccent(task) {
  return PRIORITY_ACCENTS[getPriorityKey(task)] || PRIORITY_ACCENTS.none;
}

export class TimelineBasesView extends BasesView {
  type = BASES_TIMELINE_VIEW_TYPE;

  constructor(controller, containerEl, plugin) {
    super(controller);
    this.controller = controller;
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.cardClickTimer = null;
    this.suppressNextCardClick = false;
    this.periodMode = "week";
    this.anchorDate = new Date();
  }

  onload() {
    this.render();
  }

  onDataUpdated() {
    this.render();
  }

  async createFileForView() {
    new CreateTaskModal(this.plugin.app, this.plugin).open();
  }

  render() {
    this.containerEl.empty();
    this.containerEl.removeClass("frontmatter-kanban-board");
    this.containerEl.addClass("frontmatter-kanban");
    this.containerEl.addClass("frontmatter-kanban-bases");
    this.containerEl.addClass("frontmatter-timeline");

    const tasks = this.getTasks();
    const period = this.getPeriod();

    this.renderToolbar(period);

    const shell = this.containerEl.createDiv({ cls: "frontmatter-timeline-shell" });
    this.renderTimeline(shell, tasks, period);
    this.renderSidebar(shell, tasks);
  }

  getDayWidth() {
    const configured = this.config && typeof this.config.get === "function"
      ? Number(this.config.get("dayWidth"))
      : 170;
    if (!Number.isFinite(configured)) return 170;
    return Math.min(260, Math.max(120, configured));
  }

  getLaneHeight() {
    const configured = this.config && typeof this.config.get === "function"
      ? Number(this.config.get("laneHeight"))
      : 178;
    if (!Number.isFinite(configured)) return 178;
    return Math.min(260, Math.max(132, configured));
  }

  getPeriod() {
    const anchor = new Date(this.anchorDate.getFullYear(), this.anchorDate.getMonth(), this.anchorDate.getDate());
    let start = anchor;
    let end = anchor;
    if (this.periodMode === "week") {
      start = startOfWeek(anchor);
      end = addDays(start, 6);
    } else if (this.periodMode === "month") {
      start = startOfMonth(anchor);
      end = endOfMonth(anchor);
    }

    const days = [];
    for (let date = start; date <= end; date = addDays(date, 1)) {
      days.push(date);
    }
    return { start, end, days };
  }

  renderToolbar(period) {
    const toolbar = this.containerEl.createDiv({ cls: "frontmatter-timeline-toolbar" });

    const title = toolbar.createDiv({ cls: "frontmatter-timeline-title" });
    setIcon(title.createSpan({ cls: "frontmatter-timeline-title-icon" }), "calendar-days");
    title.createSpan({ text: "Timeline" });

    const modeSwitch = toolbar.createDiv({ cls: "frontmatter-timeline-mode-switch" });
    [
      ["day", "日"],
      ["week", "週"],
      ["month", "月"]
    ].forEach(([mode, label]) => {
      const button = modeSwitch.createEl("button", {
        cls: mode === this.periodMode ? "is-active" : "",
        text: label
      });
      this.registerDomEvent(button, "click", () => {
        this.periodMode = mode;
        this.render();
      });
    });

    const nav = toolbar.createDiv({ cls: "frontmatter-timeline-nav" });
    new ButtonComponent(nav)
      .setIcon("chevron-left")
      .setTooltip("Previous")
      .onClick(() => {
        this.shiftPeriod(-1);
        this.render();
      });
    nav.createDiv({ cls: "frontmatter-timeline-period-label", text: this.formatPeriodLabel(period) });
    new ButtonComponent(nav)
      .setIcon("chevron-right")
      .setTooltip("Next")
      .onClick(() => {
        this.shiftPeriod(1);
        this.render();
      });

    new ButtonComponent(toolbar)
      .setButtonText("今天")
      .setClass("frontmatter-timeline-today")
      .onClick(() => {
        this.anchorDate = new Date();
        this.render();
      });
  }

  shiftPeriod(direction) {
    if (this.periodMode === "day") {
      this.anchorDate = addDays(this.anchorDate, direction);
    } else if (this.periodMode === "week") {
      this.anchorDate = addDays(this.anchorDate, direction * 7);
    } else {
      this.anchorDate = new Date(this.anchorDate.getFullYear(), this.anchorDate.getMonth() + direction, 1);
    }
  }

  formatPeriodLabel(period) {
    if (this.periodMode === "day") return formatTaiwanDate(period.start);
    if (this.periodMode === "month") return `${period.start.getFullYear()}年${period.start.getMonth() + 1}月`;
    const sameYear = period.start.getFullYear() === period.end.getFullYear();
    const endLabel = formatTaiwanDate(period.end, !sameYear);
    return `${formatTaiwanDate(period.start)} - ${endLabel}（第${getIsoWeekNumber(period.start)}週）`;
  }

  getTasks() {
    const entries = this.getTaskFolderEntries(this.data && Array.isArray(this.data.data) ? this.data.data : []);
    return entries
      .map((entry) => this.entryToTask(entry))
      .filter(Boolean)
      .sort((left, right) => {
        const startDiff = (parseDateOnly(left.frontmatter.work_start || left.frontmatter.work_end)?.getTime() || 0)
          - (parseDateOnly(right.frontmatter.work_start || right.frontmatter.work_end)?.getTime() || 0);
        if (startDiff) return startDiff;
        const priorityDiff = getPriorityWeight(right.frontmatter.priority) - getPriorityWeight(left.frontmatter.priority);
        if (priorityDiff) return priorityDiff;
        return getTaskTitle(left).localeCompare(getTaskTitle(right));
      });
  }

  getTaskFolderEntries(entries) {
    return entries.filter((entry) => {
      const file = getEntryFile(entry);
      return this.plugin.isKanbanTaskFile(file);
    });
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

  getTaskRange(task) {
    const start = parseDateOnly(task.frontmatter.work_start || task.frontmatter.work_end);
    const end = parseDateOnly(task.frontmatter.work_end || task.frontmatter.work_start);
    if (!start && !end) return null;
    if (start && end && start > end) return { start: end, end: start };
    return { start: start || end, end: end || start };
  }

  getVisibleScheduledTasks(tasks, period) {
    return tasks
      .map((task) => ({ task, range: this.getTaskRange(task) }))
      .filter((item) => item.range && item.range.start <= period.end && item.range.end >= period.start);
  }

  renderTimeline(shell, tasks, period) {
    const scheduled = this.getVisibleScheduledTasks(tasks, period);
    const rowCount = Math.max(scheduled.length, 4);
    const dayWidth = this.getDayWidth();
    const laneHeight = this.getLaneHeight();

    const panel = shell.createDiv({ cls: "frontmatter-timeline-main" });
    const grid = panel.createDiv({ cls: "frontmatter-timeline-grid" });
    grid.style.setProperty("--timeline-day-width", `${dayWidth}px`);
    grid.style.setProperty("--timeline-label-width", `${LABEL_COLUMN_WIDTH}px`);
    grid.style.setProperty("--timeline-lane-height", `${laneHeight}px`);
    grid.style.gridTemplateColumns = `var(--timeline-label-width) repeat(${period.days.length}, var(--timeline-day-width))`;
    grid.style.gridTemplateRows = `78px repeat(${rowCount}, var(--timeline-lane-height))`;

    this.registerDomEvent(grid, "dragover", (event) => {
      if (!this.getDropDate(event, grid, period)) return;
      event.preventDefault();
      grid.addClass("is-drag-over");
    });
    this.registerDomEvent(grid, "dragleave", (event) => {
      if (event.relatedTarget && grid.contains(event.relatedTarget)) return;
      grid.removeClass("is-drag-over");
    });
    this.registerDomEvent(grid, "drop", async (event) => {
      const dropDate = this.getDropDate(event, grid, period);
      if (!dropDate) return;
      event.preventDefault();
      grid.removeClass("is-drag-over");
      const path = event.dataTransfer.getData("text/plain");
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;
      const task = tasks.find((item) => item.file.path === file.path);
      await this.scheduleTaskFromDrop(file, task, dropDate);
    });

    const corner = grid.createDiv({ cls: "frontmatter-timeline-corner", text: "任務" });
    corner.style.gridColumn = "1";
    corner.style.gridRow = "1";

    period.days.forEach((date, index) => {
      const header = grid.createDiv({ cls: "frontmatter-timeline-day-header" });
      if (formatDateOnly(date) === formatDateOnly(new Date())) header.addClass("is-today");
      if (date.getDay() === 0 || date.getDay() === 6) header.addClass("is-weekend");
      header.style.gridColumn = String(index + 2);
      header.style.gridRow = "1";
      header.createDiv({ cls: "frontmatter-timeline-day-number", text: `${date.getMonth() + 1}/${date.getDate()}` });
      header.createDiv({ cls: "frontmatter-timeline-weekday", text: getWeekdayLabel(date) });

      const dropColumn = grid.createDiv({ cls: "frontmatter-timeline-drop-column" });
      if (date.getDay() === 0 || date.getDay() === 6) dropColumn.addClass("is-weekend");
      dropColumn.style.gridColumn = String(index + 2);
      dropColumn.style.gridRow = `2 / span ${rowCount}`;
    });

    for (let row = 0; row < rowCount; row += 1) {
      const laneLabel = grid.createDiv({ cls: "frontmatter-timeline-lane-label" });
      laneLabel.style.gridColumn = "1";
      laneLabel.style.gridRow = String(row + 2);
    }

    scheduled.forEach((item, index) => {
      const clippedStart = item.range.start < period.start ? period.start : item.range.start;
      const clippedEnd = item.range.end > period.end ? period.end : item.range.end;
      const colStart = daysBetween(period.start, clippedStart) + 2;
      const colEnd = daysBetween(period.start, clippedEnd) + 3;
      const holder = grid.createDiv({ cls: "frontmatter-timeline-task" });
      holder.style.gridColumn = `${colStart} / ${colEnd}`;
      holder.style.gridRow = String(index + 2);
      holder.style.setProperty("--kanban-column-accent", getPriorityAccent(item.task));
      renderTaskCard(this, holder, item.task, {
        badgeMode: "status",
        extraClass: "frontmatter-timeline-grid-card",
        accent: getPriorityAccent(item.task),
        onDragEnd: () => grid.removeClass("is-drag-over")
      });
    });

    if (!scheduled.length) {
      const empty = grid.createDiv({ cls: "frontmatter-timeline-empty", text: "這段期間沒有已排程的任務" });
      empty.style.gridColumn = `2 / span ${period.days.length}`;
      empty.style.gridRow = "2";
    }
  }

  getDropDate(event, grid, period) {
    const rect = grid.getBoundingClientRect();
    const x = event.clientX - rect.left + grid.scrollLeft - LABEL_COLUMN_WIDTH;
    if (x < 0) return null;
    const index = Math.floor(x / this.getDayWidth());
    return period.days[index] || null;
  }

  async scheduleTaskFromDrop(file, task, startDate) {
    const existingRange = task ? this.getTaskRange(task) : null;
    const duration = existingRange ? Math.max(0, daysBetween(existingRange.start, existingRange.end)) : 0;
    const endDate = addDays(startDate, duration);
    await this.plugin.updateTaskWorkRange(file, formatDateOnly(startDate), formatDateOnly(endDate));
  }

  renderSidebar(shell, tasks) {
    const sidebar = shell.createDiv({ cls: "frontmatter-timeline-sidebar" });
    const header = sidebar.createDiv({ cls: "frontmatter-timeline-sidebar-header" });
    header.createDiv({ cls: "frontmatter-timeline-sidebar-title", text: "任務清單" });
    new ButtonComponent(header)
      .setIcon("plus")
      .setTooltip("New task")
      .onClick(() => new CreateTaskModal(this.plugin.app, this.plugin).open());
    new ButtonComponent(header)
      .setIcon("more-horizontal")
      .setTooltip("More");

    const body = sidebar.createDiv({ cls: "frontmatter-timeline-sidebar-body" });
    const groups = [
      ["high", "HIGH 優先度"],
      ["medium", "MEDIUM 優先度"],
      ["low", "LOW 優先度"],
      ["none", "未分級"]
    ];

    for (const [priority, title] of groups) {
      const groupTasks = tasks.filter((task) => getPriorityKey(task) === priority);
      if (!groupTasks.length) continue;

      const section = body.createDiv({ cls: `frontmatter-timeline-sidebar-section priority-${priority}` });
      const sectionTitle = section.createDiv({ cls: "frontmatter-timeline-sidebar-section-title" });
      sectionTitle.createSpan({ cls: "frontmatter-timeline-sidebar-priority-dot" });
      sectionTitle.createSpan({ text: `${title} (${groupTasks.length})` });

      const list = section.createDiv({ cls: "frontmatter-timeline-sidebar-list" });
      groupTasks.forEach((task) => {
        renderTaskCard(this, list, task, {
          badgeMode: "status",
          extraClass: "frontmatter-timeline-sidebar-card",
          accent: getPriorityAccent(task)
        });
      });
    }
  }
}

export function buildTimelineBasesViewFactory(plugin): BasesViewFactory {
  return function (controller, containerEl): BasesView {
    return new TimelineBasesView(controller, containerEl, plugin);
  };
}
