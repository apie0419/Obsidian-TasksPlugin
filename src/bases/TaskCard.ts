import { Menu, setIcon } from "obsidian";
import { EditTaskModal } from "../modals/TaskModals";
import { isDoneStatus } from "../status";
import { getDueClass, getTaskTitle } from "../taskFields";
import { formatDateForInput, formatDateLabel, formatDateTimeForInput } from "../utils/date";

export function formatReferenceLabel(value) {
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

function getCardSummary(task) {
  const fm = task.frontmatter;
  return String(fm.description || fm.summary || fm.notes || "").trim();
}

export function openTaskMenu(host, event, task) {
  const menu = new Menu();
  menu.addItem((item) => item
    .setTitle("Edit task")
    .setIcon("pencil")
    .onClick(() => new EditTaskModal(host.plugin.app, host.plugin, task).open()));
  menu.addItem((item) => item
    .setTitle("Open note")
    .setIcon("file-text")
    .onClick(() => host.plugin.openTaskFile(task.file)));
  if (host.plugin.settings && Array.isArray(host.plugin.settings.statuses)) {
    menu.addSeparator();
    for (const status of host.plugin.settings.statuses) {
      const isCurrent = String(task.frontmatter.status || host.plugin.getDefaultStatus()).toLowerCase() === String(status).toLowerCase();
      menu.addItem((item) => item
        .setTitle(`Status: ${status}`)
        .setIcon(isCurrent ? "check" : "circle")
        .onClick(() => host.plugin.updateTaskStatus(task.file, status)));
    }
  }
  menu.addSeparator();
  menu.addItem((item) => item
    .setTitle("Delete task")
    .setIcon("trash-2")
    .setWarning(true)
    .onClick(() => host.plugin.deleteTask(task.file)));
  menu.showAtMouseEvent(event);
}

export function renderTaskCard(host, cards, task, options = {}) {
  const priority = String(task.frontmatter.priority || "").trim().toLowerCase();
  const priorityClass = priority ? `priority-${priority}` : "";
  const doneClass = isDoneStatus(task.frontmatter.status) ? "is-done" : "";
  const extraClass = options.extraClass || "";
  const card = cards.createDiv({ cls: `frontmatter-kanban-card ${priorityClass} ${doneClass} ${extraClass}`.trim() });
  if (options.accent) card.style.setProperty("--kanban-column-accent", options.accent);
  card.draggable = options.draggable !== false;

  if (card.draggable) {
    host.registerDomEvent(card, "dragstart", (event) => {
      if (!event.dataTransfer) return;
      card.addClass("is-dragging");
      event.dataTransfer.setData("text/plain", task.file.path);
      event.dataTransfer.effectAllowed = options.dragEffectAllowed || "move";
      if (typeof options.onDragStart === "function") options.onDragStart(event, card, task);
    });
    host.registerDomEvent(card, "dragend", (event) => {
      card.removeClass("is-dragging");
      host.suppressNextCardClick = true;
      if (typeof options.onDragEnd === "function") options.onDragEnd(event, card, task);
      window.setTimeout(() => {
        host.suppressNextCardClick = false;
      }, 80);
    });
  }

  host.registerDomEvent(card, "click", (event) => {
    if (host.suppressNextCardClick) return;
    if (event.detail > 1) return;
    if (host.cardClickTimer) window.clearTimeout(host.cardClickTimer);
    host.cardClickTimer = window.setTimeout(() => {
      host.cardClickTimer = null;
      new EditTaskModal(host.plugin.app, host.plugin, task).open();
    }, 300);
  });
  host.registerDomEvent(card, "dblclick", (event) => {
    event.preventDefault();
    if (host.cardClickTimer) {
      window.clearTimeout(host.cardClickTimer);
      host.cardClickTimer = null;
    }
    host.plugin.openTaskFile(task.file);
  });
  host.registerDomEvent(card, "contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (host.cardClickTimer) {
      window.clearTimeout(host.cardClickTimer);
      host.cardClickTimer = null;
    }
    openTaskMenu(host, event, task);
  });

  const workStart = formatCompactDate(task.frontmatter.work_start);
  const workEnd = formatCompactDate(task.frontmatter.work_end);
  const workRange = workStart && workEnd ? `${workStart} -> ${workEnd}` : workStart || workEnd;
  const dueDateParts = task.frontmatter.due ? formatDueDateParts(task.frontmatter.due) : null;

  const hero = card.createDiv({ cls: "frontmatter-kanban-card-hero" });
  const titleBlock = hero.createDiv({ cls: "frontmatter-kanban-card-title-block" });
  const titleText = titleBlock.createDiv({ cls: "frontmatter-kanban-card-title-wrap" });
  const titleTags = titleText.createDiv({ cls: "frontmatter-kanban-card-tags" });
  if (priority && !options.hidePriorityBadge) {
    titleTags.createSpan({ cls: `frontmatter-kanban-card-priority-tag ${priorityClass}`, text: priority });
  }
  if (options.badgeMode === "status") {
    const status = String(task.frontmatter.status || host.plugin.getDefaultStatus()).trim();
    if (status) titleTags.createSpan({ cls: "frontmatter-kanban-card-status-tag", text: status });
  } else if (workRange) {
    titleTags.createSpan({ cls: "frontmatter-kanban-card-work-tag", text: workRange });
  }
  titleText.createDiv({ cls: "frontmatter-kanban-card-title", text: getTaskTitle(task) });

  const summary = options.hideSummary ? "" : getCardSummary(task);
  if (summary) {
    card.createDiv({ cls: "frontmatter-kanban-card-summary", text: summary });
  }

  if (!options.hideTodos) {
    renderTodoProgress(host, card, task);
  }

  const project = formatReferenceLabel(task.frontmatter.project);
  const feature = formatReferenceLabel(task.frontmatter.feature);
  if (!options.hideDetails && (project || feature || dueDateParts)) {
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

  if (task.frontmatter.completed && !options.hideCompletedFooter) {
    const footer = card.createDiv({ cls: "frontmatter-kanban-card-footer" });
    const completed = footer.createSpan({ cls: "frontmatter-kanban-card-date is-complete" });
    setIcon(completed.createSpan(), "check-circle-2");
    completed.createSpan({ text: formatDateLabel(task.frontmatter.completed) || formatDateTimeForInput(task.frontmatter.completed).replace("T", " ") });
  }

  return card;
}

export function renderTodoProgress(host, card, task) {
  const todo = card.createDiv({ cls: "frontmatter-kanban-card-todos is-loading" });
  host.plugin.getTaskTodoStats(task.file)
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
