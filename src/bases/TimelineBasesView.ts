/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- Bases entries and frontmatter are runtime-shaped Obsidian data. */
import { BasesView, ButtonComponent, Menu, setIcon, TFile } from "obsidian";
import type { BasesViewFactory } from "obsidian";
import { BASES_TIMELINE_VIEW_TYPE, PRIORITIES } from "../constants";
import { CreateTaskModal, EditTaskModal } from "../modals/TaskModals";
import { isDoneStatus, statusEquals } from "../status";
import { getTaskTitle } from "../taskFields";
import { formatDateForInput } from "../utils/date";
import { openTaskMenu, renderTaskCard } from "./TaskCard";

const DAY_MS = 24 * 60 * 60 * 1000;

const PRIORITY_ACCENTS = {
  high: "#C98282",
  medium: "#C2A667",
  low: "#79A99F",
  none: "#70899D",
  done: "#777E8F"
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function sameDate(left, right) {
  return formatDateOnly(left) === formatDateOnly(right);
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

function formatDisplayDate(date, includeYear = true) {
  const month = MONTH_LABELS[date.getMonth()];
  const base = `${month} ${date.getDate()}`;
  return includeYear ? `${base}, ${date.getFullYear()}` : base;
}

function getPriorityKey(task) {
  const priority = String(task.frontmatter.priority || "").trim().toLowerCase();
  return PRIORITIES.includes(priority) ? priority : "none";
}

function getPriorityAccent(task) {
  if (isDoneStatus(task.frontmatter.status)) return PRIORITY_ACCENTS.done;
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
    this.collapsedSidebarGroups = new Set();
    this.isSidebarCollapsed = this.shouldStartSidebarCollapsed();
    this.sidebarStatusOrder = [];
    this.showSidebarDetails = true;
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

  shouldStartSidebarCollapsed() {
    return this.isMobileLayout();
  }

  isMobileLayout() {
    return document.body.classList.contains("is-mobile")
      || document.body.classList.contains("is-phone")
      || window.matchMedia("(max-width: 720px)").matches;
  }

  shouldUseTimelineResizeHandles() {
    return !this.isMobileLayout();
  }

  openCreateTaskModal(initialValues = {}) {
    new CreateTaskModal(this.plugin.app, this.plugin, initialValues).open();
  }

  openCreateTaskMenu(event, date) {
    const dateText = formatDateOnly(date);
    const menu = new Menu();
    menu.addItem((item) => item
      .setTitle(`New task on ${dateText}`)
      .setIcon("plus")
      .onClick(() => this.openCreateTaskModal({
        work_start: dateText,
        work_end: dateText
      })));
    menu.showAtMouseEvent(event);
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
    this.containerEl.removeClass("frontmatter-kanban-board");
    this.containerEl.addClass("frontmatter-kanban");
    this.containerEl.addClass("frontmatter-kanban-bases");
    this.containerEl.addClass("frontmatter-timeline");

    const tasks = this.getTasks();
    const period = this.getPeriod();

    this.renderToolbar(period);

    const shell = this.containerEl.createDiv({
      cls: `frontmatter-timeline-shell ${this.isSidebarCollapsed ? "is-sidebar-collapsed" : ""}`
    });
    if (this.periodMode === "month") {
      this.renderMonthCalendar(shell, tasks, period);
    } else if (this.periodMode === "day") {
      this.renderDayList(shell, tasks, period.start);
    } else {
      this.renderWeekTimeline(shell, tasks, period);
    }
    this.renderSidebar(shell, tasks);
  }

  getDayWidth() {
    const configured = this.config && typeof this.config.get === "function"
      ? Number(this.config.get("dayWidth"))
      : 150;
    if (!Number.isFinite(configured)) return 150;
    return Math.min(240, Math.max(104, configured));
  }

  getLaneHeight() {
    const configured = this.config && typeof this.config.get === "function"
      ? Number(this.config.get("laneHeight"))
      : 118;
    if (!Number.isFinite(configured)) return 118;
    return Math.min(180, Math.max(84, configured));
  }

  getHideWeekends() {
    return Boolean(this.config && typeof this.config.get === "function" && this.config.get("hideWeekends"));
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

  getVisibleDays(days) {
    if (!this.getHideWeekends() || this.periodMode === "day") return days;
    return days.filter((date) => date.getDay() !== 0 && date.getDay() !== 6);
  }

  renderToolbar(period) {
    const toolbar = this.containerEl.createDiv({ cls: "frontmatter-timeline-toolbar is-compact" });

    const modeSwitch = toolbar.createDiv({ cls: "frontmatter-timeline-mode-switch" });
    [
      ["day", "Day"],
      ["week", "Week"],
      ["month", "Month"]
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
      .setButtonText("Today")
      .setClass("frontmatter-timeline-today")
      .onClick(() => {
        this.anchorDate = new Date();
        this.render();
      });

    const weekendsButton = new ButtonComponent(toolbar)
      .setButtonText(this.getHideWeekends() ? "Show weekends" : "Hide weekends")
      .setTooltip("Toggle weekend columns")
      .setClass("frontmatter-timeline-weekends-toggle")
      .onClick(() => {
        const nextValue = !this.getHideWeekends();
        if (this.config && typeof this.config.set === "function") {
          this.config.set("hideWeekends", nextValue);
        }
        this.render();
      });
    if (this.getHideWeekends()) weekendsButton.buttonEl.addClass("is-active");

    const newTaskButton = toolbar.createEl("button", { cls: "frontmatter-timeline-new" });
    newTaskButton.setAttr("aria-label", "Create task");
    newTaskButton.setAttr("type", "button");
    setIcon(newTaskButton.createSpan({ cls: "frontmatter-timeline-new-icon" }), "plus");
    newTaskButton.createSpan({ text: "New Task" });
    this.registerDomEvent(newTaskButton, "click", () => this.openCreateTaskModal());
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
    if (this.periodMode === "day") return formatDisplayDate(period.start);
    if (this.periodMode === "month") return `${MONTH_LABELS[period.start.getMonth()]} ${period.start.getFullYear()}`;
    const sameYear = period.start.getFullYear() === period.end.getFullYear();
    const endLabel = formatDisplayDate(period.end, !sameYear);
    return `${formatDisplayDate(period.start)} - ${endLabel} (Week ${getIsoWeekNumber(period.start)})`;
  }

  getTasks() {
    const entries = this.getTaskFolderEntries(this.data && Array.isArray(this.data.data) ? this.data.data : []);
    return entries
      .map((entry) => this.entryToTask(entry))
      .filter(Boolean);
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

  getScheduledTasks(tasks) {
    return tasks
      .map((task) => ({ task, range: this.getTaskRange(task) }))
      .filter((item) => item.range);
  }

  getVisibleScheduledTasks(tasks, period) {
    return this.getScheduledTasks(tasks)
      .filter((item) => item.range.start <= period.end && item.range.end >= period.start);
  }

  getTasksForDate(tasks, date) {
    return this.getScheduledTasks(tasks)
      .filter((item) => item.range.start <= date && item.range.end >= date)
      .map((item) => item.task);
  }

  renderWeekTimeline(shell, tasks, period) {
    const visibleDays = this.getVisibleDays(period.days);
    const scheduled = this.getVisibleScheduledTasks(tasks, period)
      .filter((item) => visibleDays.some((date) => item.range.start <= date && item.range.end >= date));
    const rowCount = Math.max(scheduled.length, 4);
    const dayWidth = this.getDayWidth();
    const laneHeight = this.getLaneHeight();

    const panel = shell.createDiv({ cls: "frontmatter-timeline-main" });
    const grid = panel.createDiv({ cls: "frontmatter-timeline-grid frontmatter-timeline-week-grid" });
    const preview = grid.createDiv({ cls: "frontmatter-timeline-drop-preview" });
    grid.setCssProps({
      "--timeline-day-width": `${dayWidth}px`,
      "--timeline-lane-height": `${laneHeight}px`,
      "--timeline-visible-days": String(visibleDays.length || 1)
    });
    grid.setCssStyles({
      gridTemplateColumns: `repeat(${visibleDays.length}, minmax(var(--timeline-day-width), 1fr))`,
      gridTemplateRows: `64px repeat(${rowCount}, var(--timeline-lane-height)) minmax(0, 1fr)`
    });

    this.registerDomEvent(grid, "dragover", (event) => {
      if (!this.getDropDate(event, grid, visibleDays)) return;
      event.preventDefault();
      grid.addClass("is-drag-over");
      this.updateWeekDropPreview(preview, event, grid, visibleDays, tasks, rowCount);
    });
    this.registerDomEvent(grid, "dragleave", (event) => {
      if (event.relatedTarget && grid.contains(event.relatedTarget)) return;
      grid.removeClass("is-drag-over");
      preview.removeClass("is-visible");
    });
    this.registerDomEvent(grid, "drop", (event) => {
      const dropDate = this.getDropDate(event, grid, visibleDays);
      if (!dropDate) return;
      event.preventDefault();
      grid.removeClass("is-drag-over");
      preview.removeClass("is-visible");
      if (!event.dataTransfer) return;
      const path = event.dataTransfer.getData("text/plain");
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;
      const task = tasks.find((item) => item.file.path === file.path);
      void this.scheduleTaskFromDrop(file, task, dropDate);
    });
    this.registerDomEvent(grid, "contextmenu", (event) => {
      const date = this.getDropDate(event, grid, visibleDays);
      if (!date) return;
      event.preventDefault();
      event.stopPropagation();
      this.openCreateTaskMenu(event, date);
    });

    visibleDays.forEach((date, index) => {
      const header = grid.createDiv({ cls: "frontmatter-timeline-day-header" });
      if (sameDate(date, new Date())) header.addClass("is-today");
      if (date.getDay() === 0 || date.getDay() === 6) header.addClass("is-weekend");
      header.setCssStyles({
        gridColumn: String(index + 1),
        gridRow: "1"
      });
      header.createDiv({ cls: "frontmatter-timeline-day-number", text: `${date.getMonth() + 1}/${date.getDate()}` });
      header.createDiv({ cls: "frontmatter-timeline-weekday", text: WEEKDAY_LABELS[date.getDay()] });

      const dropColumn = grid.createDiv({ cls: "frontmatter-timeline-drop-column" });
      if (date.getDay() === 0 || date.getDay() === 6) dropColumn.addClass("is-weekend");
      dropColumn.setCssStyles({
        gridColumn: String(index + 1),
        gridRow: "2 / -1"
      });
    });

    scheduled.forEach((item, index) => {
      const columns = this.getGridColumnsForRange(item.range, visibleDays);
      if (!columns) return;
      const holder = grid.createDiv({ cls: "frontmatter-timeline-task" });
      holder.setCssProps({ "--kanban-column-accent": getPriorityAccent(item.task) });
      holder.setCssStyles({
        gridColumn: `${columns.start} / ${columns.end}`,
        gridRow: String(index + 2)
      });
      this.renderTimelineCard(holder, item.task, "frontmatter-timeline-grid-card");
      if (this.shouldUseTimelineResizeHandles()) {
        this.renderResizeHandle(holder, item, "start", grid, visibleDays);
        this.renderResizeHandle(holder, item, "end", grid, visibleDays);
      }
    });

    if (!scheduled.length) {
      const empty = grid.createDiv({ cls: "frontmatter-timeline-empty", text: "No scheduled tasks in this period." });
      empty.setCssStyles({
        gridColumn: `1 / span ${Math.max(visibleDays.length, 1)}`,
        gridRow: "2"
      });
    }
  }

  updateWeekDropPreview(preview, event, grid, visibleDays, tasks, rowCount) {
    const dropDate = this.getDropDate(event, grid, visibleDays);
    if (!dropDate) {
      preview.removeClass("is-visible");
      return;
    }
    const path = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
    const task = tasks.find((item) => item.file.path === path);
    const existingRange = task ? this.getTaskRange(task) : null;
    const duration = existingRange ? Math.max(0, daysBetween(existingRange.start, existingRange.end)) : 0;
    const range = { start: dropDate, end: addDays(dropDate, duration) };
    const columns = this.getGridColumnsForRange(range, visibleDays);
    if (!columns) {
      preview.removeClass("is-visible");
      return;
    }
    preview.setCssStyles({
      gridColumn: `${columns.start} / ${columns.end}`,
      gridRow: `2 / span ${rowCount}`
    });
    preview.addClass("is-visible");
  }

  getGridColumnsForRange(range, visibleDays) {
    let startIndex = -1;
    let endIndex = -1;
    for (let index = 0; index < visibleDays.length; index += 1) {
      const date = visibleDays[index];
      if (date >= range.start && date <= range.end) {
        if (startIndex === -1) startIndex = index;
        endIndex = index;
      }
    }
    if (startIndex === -1) return null;
    return { start: startIndex + 1, end: endIndex + 2 };
  }

  renderTimelineCard(holder, task, extraClass) {
    return renderTaskCard(this, holder, task, {
      badgeMode: "status",
      extraClass,
      accent: getPriorityAccent(task),
      compactDueInTitle: extraClass === "frontmatter-timeline-grid-card",
      hidePriorityBadge: true,
      hideDueDetail: extraClass === "frontmatter-timeline-grid-card",
      hideSummary: extraClass !== "frontmatter-timeline-day-card",
      hideTodos: false,
      hideCompletedFooter: true,
      onDragEnd: () => this.containerEl.querySelector(".frontmatter-timeline-grid")?.removeClass("is-drag-over")
    });
  }

  renderResizeHandle(holder, item, edge, grid, visibleDays) {
    const handle = holder.createSpan({ cls: `frontmatter-timeline-resize-handle is-${edge}` });
    handle.setAttr("aria-label", edge === "start" ? "Resize start date" : "Resize end date");
    this.registerDomEvent(handle, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.suppressNextCardClick = true;
      const state = {
        start: item.range.start,
        end: item.range.end,
        nextStart: item.range.start,
        nextEnd: item.range.end
      };
      holder.addClass("is-resizing");

      const onMove = (moveEvent) => {
        const date = this.getDropDate(moveEvent, grid, visibleDays);
        if (!date) return;
        if (edge === "start") {
          state.nextStart = date <= state.nextEnd ? date : state.nextEnd;
        } else {
          state.nextEnd = date >= state.nextStart ? date : state.nextStart;
        }
        const columns = this.getGridColumnsForRange({ start: state.nextStart, end: state.nextEnd }, visibleDays);
        if (columns) holder.setCssStyles({ gridColumn: `${columns.start} / ${columns.end}` });
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        holder.removeClass("is-resizing");
        void this.plugin.updateTaskWorkRange(item.task.file, formatDateOnly(state.nextStart), formatDateOnly(state.nextEnd))
          .finally(() => {
            window.setTimeout(() => {
              this.suppressNextCardClick = false;
            }, 80);
          });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    });
  }

  getDropDate(event, grid, visibleDays) {
    const rect = grid.getBoundingClientRect();
    const x = event.clientX - rect.left + grid.scrollLeft;
    if (x < 0) return null;
    const columnWidth = this.getTimelineColumnWidth(grid, visibleDays);
    const index = Math.floor(x / columnWidth);
    return visibleDays[index] || null;
  }

  getTimelineColumnWidth(grid, visibleDays) {
    if (!visibleDays.length) return this.getDayWidth();
    return Math.max(this.getDayWidth(), Math.max(grid.scrollWidth, grid.clientWidth) / visibleDays.length);
  }

  async scheduleTaskFromDrop(file, task, startDate) {
    const existingRange = task ? this.getTaskRange(task) : null;
    const duration = existingRange ? Math.max(0, daysBetween(existingRange.start, existingRange.end)) : 0;
    const endDate = addDays(startDate, duration);
    await this.plugin.updateTaskWorkRange(file, formatDateOnly(startDate), formatDateOnly(endDate));
  }

  renderMonthCalendar(shell, tasks, period) {
    const panel = shell.createDiv({ cls: "frontmatter-timeline-main frontmatter-timeline-month-main" });
    const calendar = panel.createDiv({ cls: "frontmatter-timeline-month" });
    const hideWeekends = this.getHideWeekends();
    const labels = hideWeekends ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : WEEKDAY_LABELS;
    const isMobileLayout = this.isMobileLayout();
    if (isMobileLayout) {
      panel.addClass("is-mobile-month");
      calendar.addClass("is-mobile-month");
    }
    calendar.setCssStyles({
      gridTemplateColumns: isMobileLayout
        ? `repeat(${labels.length}, minmax(0, 1fr))`
        : `repeat(${labels.length}, minmax(120px, 1fr))`
    });

    labels.forEach((label, index) => {
      const header = calendar.createDiv({ cls: "frontmatter-timeline-month-weekday", text: label });
      header.setCssStyles({
        gridColumn: String(index + 1),
        gridRow: "1"
      });
    });

    const weeks = this.getMonthWeeks(period.start, hideWeekends);
    calendar.setCssStyles({
      gridTemplateRows: isMobileLayout
        ? `28px repeat(${weeks.length}, minmax(58px, 1fr))`
        : `34px repeat(${weeks.length}, minmax(132px, 1fr))`
    });
    this.registerDomEvent(calendar, "dragover", (event) => {
      const date = this.getMonthDateFromPoint(event.clientX, event.clientY);
      if (!date) return;
      event.preventDefault();
      this.markMonthDropTarget(event.clientX, event.clientY);
    });
    this.registerDomEvent(calendar, "dragleave", (event) => {
      if (event.relatedTarget && calendar.contains(event.relatedTarget)) return;
      this.clearMonthDropTargets();
    });
    this.registerDomEvent(calendar, "drop", (event) => {
      const date = this.getMonthDateFromPoint(event.clientX, event.clientY);
      if (!date) return;
      event.preventDefault();
      this.clearMonthDropTargets();
      if (!event.dataTransfer) return;
      const path = event.dataTransfer.getData("text/plain");
      const file = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) return;
      const task = tasks.find((item) => item.file.path === file.path);
      void this.scheduleTaskFromDrop(file, task, date);
    });
    weeks.forEach((week, weekIndex) => {
      week.forEach((date, dayIndex) => {
        const cell = calendar.createDiv({ cls: "frontmatter-timeline-month-day" });
        cell.setCssStyles({
          gridColumn: String(dayIndex + 1),
          gridRow: String(weekIndex + 2)
        });
        if (!date) {
          cell.addClass("is-empty");
          return;
        }
        if (date.getMonth() !== period.start.getMonth()) cell.addClass("is-outside");
        if (sameDate(date, new Date())) cell.addClass("is-today");
        cell.dataset.date = formatDateOnly(date);
        this.registerDomEvent(cell, "dragover", (event) => {
          event.preventDefault();
          event.stopPropagation();
          cell.addClass("is-drop-target");
        });
        this.registerDomEvent(cell, "dragleave", (event) => {
          if (event.relatedTarget && cell.contains(event.relatedTarget)) return;
          cell.removeClass("is-drop-target");
        });
        this.registerDomEvent(cell, "drop", (event) => {
          event.preventDefault();
          event.stopPropagation();
          cell.removeClass("is-drop-target");
          if (!event.dataTransfer) return;
          const path = event.dataTransfer.getData("text/plain");
          const file = this.plugin.app.vault.getAbstractFileByPath(path);
          if (!(file instanceof TFile)) return;
          const task = tasks.find((item) => item.file.path === file.path);
          void this.scheduleTaskFromDrop(file, task, date);
        });
        this.registerDomEvent(cell, "contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.openCreateTaskMenu(event, date);
        });
        cell.createDiv({ cls: "frontmatter-timeline-month-date", text: String(date.getDate()) });
      });
    });

    this.renderMonthTaskBars(calendar, tasks, weeks);
  }

  renderMonthTaskBars(calendar, tasks, weeks) {
    const scheduled = this.getScheduledTasks(tasks);
    const lanesByWeek = new Map();
    scheduled.forEach((item) => {
      weeks.forEach((week, weekIndex) => {
        const segment = this.getMonthSegment(item.range, week);
        if (!segment) return;
        const lane = lanesByWeek.get(weekIndex) || 0;
        lanesByWeek.set(weekIndex, lane + 1);
        this.renderMonthTask(calendar, item.task, {
          weekIndex,
          lane,
          colStart: segment.start + 1,
          colEnd: segment.end + 2
        });
      });
    });
  }

  getMonthSegment(range, week) {
    let start = -1;
    let end = -1;
    for (let index = 0; index < week.length; index += 1) {
      const date = week[index];
      if (!date) continue;
      if (range.start <= date && range.end >= date) {
        if (start === -1) start = index;
        end = index;
      }
    }
    if (start === -1) return null;
    return { start, end };
  }

  getMonthWeeks(monthStart, hideWeekends) {
    const monthEnd = endOfMonth(monthStart);
    const weekStart = hideWeekends ? startOfWeek(monthStart) : addDays(monthStart, -monthStart.getDay());
    const weekEndBase = hideWeekends ? startOfWeek(monthEnd) : addDays(monthEnd, 6 - monthEnd.getDay());
    const weekEnd = hideWeekends ? addDays(weekEndBase, 4) : weekEndBase;
    const weeks = [];
    let row = [];
    for (let date = weekStart; date <= weekEnd; date = addDays(date, 1)) {
      if (hideWeekends && (date.getDay() === 0 || date.getDay() === 6)) continue;
      row.push(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
      if (row.length === (hideWeekends ? 5 : 7)) {
        weeks.push(row);
        row = [];
      }
    }
    if (row.length) weeks.push(row);
    return weeks;
  }

  renderMonthTask(calendar, task, placement) {
    const item = calendar.createDiv({ cls: `frontmatter-timeline-month-task ${isDoneStatus(task.frontmatter.status) ? "is-done" : ""}` });
    const isMobileLayout = this.isMobileLayout();
    item.setCssProps({ "--kanban-column-accent": getPriorityAccent(task) });
    item.setCssStyles({
      gridColumn: `${placement.colStart} / ${placement.colEnd}`,
      gridRow: String(placement.weekIndex + 2),
      marginTop: isMobileLayout
        ? `${20 + placement.lane * 17}px`
        : `${30 + placement.lane * 24}px`
    });
    item.draggable = true;
    this.registerDomEvent(item, "dragstart", (event) => {
      if (!event.dataTransfer) return;
      item.addClass("is-dragging");
      event.dataTransfer.setData("text/plain", task.file.path);
      event.dataTransfer.effectAllowed = "move";
    });
    this.registerDomEvent(item, "dragend", () => {
      item.removeClass("is-dragging");
      this.containerEl.querySelectorAll(".frontmatter-timeline-month-day.is-drop-target").forEach((element) => {
        element.classList.remove("is-drop-target");
      });
    });
    if (this.shouldUseTimelineResizeHandles()) {
      this.renderMonthResizeHandle(item, task, "start");
    }
    item.createSpan({ cls: "frontmatter-timeline-month-task-dot" });
    const status = String(task.frontmatter.status || this.plugin.getDefaultStatus()).trim();
    if (status) item.createSpan({ cls: "frontmatter-timeline-month-task-status", text: status });
    item.createSpan({ cls: "frontmatter-timeline-month-task-title", text: getTaskTitle(task) });
    const due = formatDateForInput(task.frontmatter.due);
    if (due) item.createSpan({ cls: "frontmatter-timeline-month-task-due", text: due.slice(5) });
    if (this.shouldUseTimelineResizeHandles()) {
      this.renderMonthResizeHandle(item, task, "end");
    }
    this.registerDomEvent(item, "click", (event) => {
      if (this.suppressNextCardClick) return;
      if (event.detail > 1) return;
      if (this.cardClickTimer) window.clearTimeout(this.cardClickTimer);
      this.cardClickTimer = window.setTimeout(() => {
        this.cardClickTimer = null;
        new EditTaskModal(this.plugin.app, this.plugin, task).open();
      }, 300);
    });
    this.registerDomEvent(item, "contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (this.cardClickTimer) {
        window.clearTimeout(this.cardClickTimer);
        this.cardClickTimer = null;
      }
      openTaskMenu(this, event, task);
    });
  }

  renderMonthResizeHandle(item, task, edge) {
    const handle = item.createSpan({ cls: `frontmatter-timeline-month-resize-handle is-${edge}` });
    handle.setAttr("aria-label", edge === "start" ? "Resize start date" : "Resize end date");
    this.registerDomEvent(handle, "pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.suppressNextCardClick = true;
      const range = this.getTaskRange(task) || { start: new Date(), end: new Date() };
      const state = {
        nextStart: range.start,
        nextEnd: range.end
      };
      item.addClass("is-resizing");

      const onMove = (moveEvent) => {
        const date = this.getMonthDateFromPoint(moveEvent.clientX, moveEvent.clientY);
        if (!date) return;
        this.containerEl.querySelectorAll(".frontmatter-timeline-month-day.is-drop-target").forEach((element) => {
          element.classList.remove("is-drop-target");
        });
        this.markMonthDropTarget(moveEvent.clientX, moveEvent.clientY);
        if (edge === "start") state.nextStart = date <= state.nextEnd ? date : state.nextEnd;
        else state.nextEnd = date >= state.nextStart ? date : state.nextStart;
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        item.removeClass("is-resizing");
        this.containerEl.querySelectorAll(".frontmatter-timeline-month-day.is-drop-target").forEach((element) => {
          element.classList.remove("is-drop-target");
        });
        void this.plugin.updateTaskWorkRange(task.file, formatDateOnly(state.nextStart), formatDateOnly(state.nextEnd))
          .finally(() => {
            window.setTimeout(() => {
              this.suppressNextCardClick = false;
            }, 80);
          });
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    });
  }

  getMonthCellFromPoint(clientX, clientY) {
    const cells = Array.from(this.containerEl.querySelectorAll(".frontmatter-timeline-month-day[data-date]"));
    return cells.find((cell) => {
      const rect = cell.getBoundingClientRect();
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
    }) || null;
  }

  getMonthDateFromPoint(clientX, clientY) {
    const cell = this.getMonthCellFromPoint(clientX, clientY);
    return cell ? parseDateOnly(cell.dataset.date) : null;
  }

  markMonthDropTarget(clientX, clientY) {
    this.clearMonthDropTargets();
    const target = this.getMonthCellFromPoint(clientX, clientY);
    if (target) target.classList.add("is-drop-target");
  }

  clearMonthDropTargets() {
    this.containerEl.querySelectorAll(".frontmatter-timeline-month-day.is-drop-target").forEach((element) => {
      element.classList.remove("is-drop-target");
    });
  }

  renderDayList(shell, tasks, date) {
    const panel = shell.createDiv({ cls: "frontmatter-timeline-main frontmatter-timeline-day-main" });
    const list = panel.createDiv({ cls: "frontmatter-timeline-day-list" });
    const dayTasks = this.getTasksForDate(tasks, date);

    const statuses = [...this.plugin.settings.statuses];
    const extras = dayTasks
      .map((task) => String(task.frontmatter.status || this.plugin.getDefaultStatus()).trim())
      .filter((status) => status && !statuses.some((item) => item.toLowerCase() === status.toLowerCase()));
    const groups = [...statuses, ...extras];

    groups.forEach((status) => {
      const groupTasks = dayTasks.filter((task) => String(task.frontmatter.status || this.plugin.getDefaultStatus()).toLowerCase() === status.toLowerCase());
      if (!groupTasks.length) return;
      const section = list.createDiv({ cls: "frontmatter-timeline-day-section" });
      const header = section.createDiv({ cls: "frontmatter-timeline-day-section-header" });
      header.createSpan({ text: status });
      header.createSpan({ cls: "frontmatter-timeline-day-count", text: String(groupTasks.length) });
      const cards = section.createDiv({ cls: "frontmatter-timeline-day-cards" });
      groupTasks.forEach((task) => this.renderFullTaskCard(cards, task, "frontmatter-timeline-day-card"));
    });

    if (!dayTasks.length) {
      list.createDiv({ cls: "frontmatter-timeline-empty", text: "No tasks scheduled for this day." });
    }
  }

  renderSidebar(shell, tasks) {
    const sidebar = shell.createDiv({ cls: "frontmatter-timeline-sidebar" });
    if (this.isSidebarCollapsed) sidebar.addClass("is-collapsed");
    const header = sidebar.createDiv({ cls: "frontmatter-timeline-sidebar-header" });
    if (!this.isSidebarCollapsed) {
      header.createDiv({ cls: "frontmatter-timeline-sidebar-title", text: "Task List" });
      const detailsButton = new ButtonComponent(header)
        .setButtonText("Show details")
        .setTooltip("Toggle detailed task cards")
        .setClass("frontmatter-timeline-sidebar-details-toggle")
        .onClick(() => {
          this.showSidebarDetails = !this.showSidebarDetails;
          this.render();
        });
      if (this.showSidebarDetails) {
        detailsButton.buttonEl.addClass("is-active");
      }
    }
    new ButtonComponent(header)
      .setIcon(this.isSidebarCollapsed ? "panel-left-open" : "panel-right-close")
      .setTooltip(this.isSidebarCollapsed ? "Show task list" : "Hide task list")
      .setClass("frontmatter-timeline-sidebar-toggle")
      .onClick(() => {
        this.isSidebarCollapsed = !this.isSidebarCollapsed;
        this.render();
      });
    if (this.isSidebarCollapsed) return;

    const body = sidebar.createDiv({ cls: "frontmatter-timeline-sidebar-body" });
    const groups = this.getStatusGroups(tasks);

    for (const group of groups) {
      const groupTasks = group.tasks;
      if (!groupTasks.length) continue;

      const section = body.createDiv({ cls: "frontmatter-timeline-sidebar-section is-status-group" });
      section.setCssProps({ "--timeline-section-accent": group.accent });
      if (this.collapsedSidebarGroups.has(group.key)) section.addClass("is-collapsed");
      const sectionTitle = section.createDiv({ cls: "frontmatter-timeline-sidebar-section-title" });
      sectionTitle.setAttr("role", "button");
      sectionTitle.setAttr("tabindex", "0");
      sectionTitle.createSpan({ cls: "frontmatter-timeline-sidebar-collapse-icon", text: this.collapsedSidebarGroups.has(group.key) ? "+" : "-" });
      sectionTitle.createSpan({ cls: "frontmatter-timeline-sidebar-priority-dot" });
      sectionTitle.createSpan({ text: `${group.status} (${groupTasks.length})` });
      if (!isDoneStatus(group.status)) {
        const controls = sectionTitle.createSpan({ cls: "frontmatter-timeline-sidebar-group-controls" });
        const upButton = controls.createEl("button", { text: "↑" });
        upButton.setAttr("aria-label", `Move ${group.status} up`);
        const downButton = controls.createEl("button", { text: "↓" });
        downButton.setAttr("aria-label", `Move ${group.status} down`);
        this.registerDomEvent(upButton, "click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.moveStatusGroup(group.key, -1);
        });
        this.registerDomEvent(downButton, "click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.moveStatusGroup(group.key, 1);
        });
      }
      const toggleSection = () => {
        if (this.collapsedSidebarGroups.has(group.key)) this.collapsedSidebarGroups.delete(group.key);
        else this.collapsedSidebarGroups.add(group.key);
        this.render();
      };
      this.registerDomEvent(sectionTitle, "click", toggleSection);
      this.registerDomEvent(sectionTitle, "keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleSection();
      });

      const list = section.createDiv({ cls: "frontmatter-timeline-sidebar-list" });
      groupTasks.forEach((task) => {
        this.renderSidebarTaskCard(list, task);
      });
    }
  }

  renderSidebarTaskCard(container, task) {
    if (this.showSidebarDetails) {
      return this.renderFullTaskCard(container, task, "frontmatter-timeline-sidebar-card");
    }

    return renderTaskCard(this, container, task, {
      extraClass: "frontmatter-timeline-sidebar-card is-compact",
      accent: getPriorityAccent(task),
      compactDueInTitle: true,
      hidePriorityBadge: false,
      hideDetails: true,
      hideSummary: true,
      hideTodos: true,
      hideCompletedFooter: true,
      onDragEnd: () => this.containerEl.querySelector(".frontmatter-timeline-grid")?.removeClass("is-drag-over")
    });
  }

  renderFullTaskCard(container, task, extraClass = "") {
    return renderTaskCard(this, container, task, {
      extraClass,
      accent: getPriorityAccent(task),
      hideCompletedFooter: true,
      onDragEnd: () => this.containerEl.querySelector(".frontmatter-timeline-grid")?.removeClass("is-drag-over")
    });
  }

  getStatusGroups(tasks) {
    const configured = [...this.plugin.settings.statuses];
    const extras = tasks
      .map((task) => String(task.frontmatter.status || this.plugin.getDefaultStatus()).trim())
      .filter((status) => status && !configured.some((item) => statusEquals(item, status)));
    const defaults = [...configured.filter((status) => !isDoneStatus(status)), ...extras.filter((status) => !isDoneStatus(status))];
    const done = [...configured, ...extras].find((status) => isDoneStatus(status)) || "done";
    const defaultKeys = defaults.map((status) => status.toLowerCase());
    const orderedKeys = [
      ...this.sidebarStatusOrder.filter((key) => defaultKeys.includes(key)),
      ...defaultKeys.filter((key) => !this.sidebarStatusOrder.includes(key))
    ];
    const statusByKey = new Map(defaults.map((status) => [status.toLowerCase(), status]));
    const statuses = orderedKeys.map((key) => statusByKey.get(key)).filter(Boolean);
    statuses.push(done);

    return statuses.map((status) => {
      const groupTasks = tasks.filter((task) => statusEquals(task.frontmatter.status || this.plugin.getDefaultStatus(), status));
      return {
        key: status.toLowerCase(),
        status,
        tasks: groupTasks,
        accent: groupTasks[0] ? getPriorityAccent(groupTasks[0]) : PRIORITY_ACCENTS.none
      };
    });
  }

  moveStatusGroup(key, direction) {
    const groups = this.getStatusGroups(this.getTasks()).filter((group) => !isDoneStatus(group.status));
    const keys = groups.map((group) => group.key);
    const index = keys.indexOf(key);
    const nextIndex = index + direction;
    if (index === -1 || nextIndex < 0 || nextIndex >= keys.length) return;
    const [moved] = keys.splice(index, 1);
    keys.splice(nextIndex, 0, moved);
    this.sidebarStatusOrder = keys;
    this.render();
  }
}

export function buildTimelineBasesViewFactory(plugin): BasesViewFactory {
  return function (controller, containerEl): BasesView {
    return new TimelineBasesView(controller, containerEl, plugin);
  };
}

/* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return -- Re-enable unsafe checks after handling runtime-shaped timeline entries. */
