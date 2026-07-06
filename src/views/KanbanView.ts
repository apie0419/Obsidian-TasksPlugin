import { ButtonComponent, DropdownComponent, ItemView, TFile, setIcon } from "obsidian";
import { PRIORITIES, VIEW_TYPE_KANBAN } from "../constants";
import {
  DATE_FILTER_MODES,
  RELATIVE_DATE_DIRECTIONS,
  RELATIVE_DATE_UNITS,
  getDateFilterMode
} from "../dateFilters";
import { matchesFilter } from "../filters";
import { CreateTaskModal, EditTaskModal } from "../modals/TaskModals";
import { statusEquals } from "../status";
import {
  compareValues,
  getAllFieldDefinitions,
  getDueClass,
  getFieldType,
  getFieldValue,
  getOperatorsForType,
  getTaskTitle
} from "../taskFields";
import { formatDateLabel, formatDateTimeForInput, getWorkOnText } from "../utils/date";
import { setDropdownOptions } from "../utils/text";

const COLUMN_ACCENTS = [
  "#7d8b84",
  "#8793ad",
  "#86a39a",
  "#b39a7c",
  "#819f88",
  "#9a8fa9",
  "#b28c8c"
];

export class KanbanView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.filterGroups = [{ mode: "and", filters: [] }];
    this.filterMode = "and";
    this.sortField = "due";
    this.sortDirection = "asc";
    this.openToolbarPanel = null;
    this.cardClickTimer = null;
    this.suppressNextCardClick = false;
  }

  getViewType() {
    return VIEW_TYPE_KANBAN;
  }

  getDisplayText() {
    return "Kanban Board";
  }

  getIcon() {
    return "kanban";
  }

  async onOpen() {
    this.registerDomEvent(document, "mousedown", (event) => this.closeToolbarPanelsOnOutsideClick(event));
    this.registerDomEvent(document, "keydown", (event) => {
      if (event.key === "Escape") this.closeToolbarPanels();
    });
    await this.refresh();
  }

  closeToolbarPanelsOnOutsideClick(event) {
    if (!this.openToolbarPanel) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".frontmatter-kanban-toolbar-popover")) return;
    this.closeToolbarPanels();
  }

  closeToolbarPanels() {
    this.openToolbarPanel = null;
    this.containerEl.querySelectorAll(".frontmatter-kanban-toolbar-popover[open]").forEach((panel) => {
      panel.open = false;
    });
  }

  getFilterGroups() {
    if (!Array.isArray(this.filterGroups) || !this.filterGroups.length) {
      this.filterGroups = [{ mode: this.filterMode || "and", filters: [] }];
    }
    return this.filterGroups;
  }

  getFilterCount() {
    return this.getFilterGroups().reduce((count, group) => count + this.getFilterNodeCount(group), 0);
  }

  getFilterNodeCount(node) {
    if (!this.isFilterGroupNode(node)) return 1;
    return this.getGroupChildren(node).reduce((count, child) => count + this.getFilterNodeCount(child), 0);
  }

  getGroupChildren(group) {
    if (!Array.isArray(group.filters)) group.filters = [];
    return group.filters;
  }

  isFilterGroupNode(node) {
    return Boolean(node && Array.isArray(node.filters) && !node.field);
  }

  createDefaultFilter() {
    const firstField = getAllFieldDefinitions(this.plugin)[0];
    return {
      field: firstField.id,
      operator: getOperatorsForType(firstField.type)[0][0],
      value: ""
    };
  }

  createDefaultGroup() {
    return {
      type: "group",
      mode: "and",
      filters: [this.createDefaultFilter()]
    };
  }

  async refresh() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("frontmatter-kanban");

    const allTasks = await this.plugin.getTasks();
    const tasks = this.applySortAndFilters(allTasks);

    const toolbar = container.createDiv({ cls: "frontmatter-kanban-toolbar" });
    this.renderToolbar(toolbar, allTasks.length, tasks.length);

    const board = container.createDiv({ cls: "frontmatter-kanban-board" });

    for (let index = 0; index < this.plugin.settings.statuses.length; index += 1) {
      const status = this.plugin.settings.statuses[index];
      this.renderColumn(
        board,
        status,
        tasks.filter((task) => statusEquals(task.frontmatter.status || "", status)),
        index
      );
    }
  }

  renderToolbar(toolbar, totalTasks, visibleTasks) {
    const title = toolbar.createDiv({ cls: "frontmatter-kanban-toolbar-title" });
    title.createEl("h2", { text: "Kanban Board" });
    title.createSpan({ text: `${visibleTasks} / ${totalTasks} tasks` });

    const controls = toolbar.createDiv({ cls: "frontmatter-kanban-toolbar-controls" });

    const panels = controls.createDiv({ cls: "frontmatter-kanban-toolbar-panels" });
    this.renderToolbarPanel(panels, "sort", "arrow-up-down", "Sort", (body) => {
      body.createDiv({ cls: "frontmatter-kanban-popover-title", text: "Sort" });
      const sortWrap = body.createDiv({ cls: "frontmatter-kanban-sort" });
      sortWrap.createSpan({ text: "Field" });
      const sortField = new DropdownComponent(sortWrap);
      for (const field of getAllFieldDefinitions(this.plugin)) {
        sortField.addOption(field.id, field.name);
      }
      sortField.setValue(this.sortField);
      sortField.onChange((value) => {
        this.openToolbarPanel = "sort";
        this.sortField = value;
        this.refresh();
      });

      sortWrap.createSpan({ text: "Order" });
      const sortDirection = new DropdownComponent(sortWrap);
      sortDirection.addOption("asc", "Asc");
      sortDirection.addOption("desc", "Desc");
      sortDirection.setValue(this.sortDirection);
      sortDirection.onChange((value) => {
        this.openToolbarPanel = "sort";
        this.sortDirection = value;
        this.refresh();
      });
    });

    const filterCount = this.getFilterCount();
    this.renderToolbarPanel(
      panels,
      "filters",
      "list-filter",
      filterCount ? `Filters (${filterCount})` : "Filters",
      (body) => this.renderFiltersPanel(body),
      filterCount ? String(filterCount) : ""
    );

    new ButtonComponent(controls.createDiv({ cls: "frontmatter-kanban-toolbar-actions" }))
      .setIcon("plus")
      .setButtonText("New task")
      .setTooltip("New task")
      .setCta()
      .onClick(() => new CreateTaskModal(this.app, this.plugin).open());
  }

  renderFiltersPanel(body) {
    const filters = body.createDiv({ cls: "frontmatter-kanban-filters" });
    const filterHeader = filters.createDiv({ cls: "frontmatter-kanban-filter-header" });
    filterHeader.createSpan({ text: "Filter groups" });

    const mode = new DropdownComponent(filterHeader);
    mode.addOption("and", "All groups");
    mode.addOption("or", "Any group");
    mode.setValue(this.filterMode);
    mode.onChange((value) => {
      this.openToolbarPanel = "filters";
      this.filterMode = value;
      this.refresh();
    });

    new ButtonComponent(filterHeader)
      .setIcon("folder-plus")
      .setTooltip("Add group")
      .onClick(() => {
        this.openToolbarPanel = "filters";
        this.getFilterGroups().push(this.createDefaultGroup());
        this.refresh();
      });

    if (!this.getFilterCount()) {
      filters.createDiv({ cls: "frontmatter-kanban-filter-empty", text: "No filters" });
    }

    const groups = this.getFilterGroups();
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      this.renderFilterGroup(filters, groups[groupIndex], `Group ${groupIndex + 1}`, () => {
        this.getFilterGroups().splice(groupIndex, 1);
        if (!this.filterGroups.length) {
          this.filterGroups.push({ mode: "and", filters: [] });
        }
      });
    }
  }

  renderFilterGroup(container, group, label, onRemove, depth = 0) {
    const groupEl = container.createDiv({ cls: "frontmatter-kanban-filter-group" });
    if (depth > 0) {
      groupEl.addClass("is-nested");
      groupEl.setAttr("data-depth", String(depth));
    }
    const header = groupEl.createDiv({ cls: "frontmatter-kanban-filter-group-header" });
    header.createSpan({ text: label });

    const mode = new DropdownComponent(header);
    mode.addOption("and", "All conditions");
    mode.addOption("or", "Any condition");
    mode.setValue(group.mode || "and");
    mode.onChange((value) => {
      this.openToolbarPanel = "filters";
      group.mode = value;
        this.refresh();
      });

    new ButtonComponent(header)
      .setIcon("plus")
      .setTooltip("Add condition")
      .onClick(() => {
        this.openToolbarPanel = "filters";
        group.filters.push(this.createDefaultFilter());
        this.refresh();
      });

    new ButtonComponent(header)
      .setIcon("folder-plus")
      .setTooltip("Add nested group")
      .onClick(() => {
        this.openToolbarPanel = "filters";
        this.getGroupChildren(group).push(this.createDefaultGroup());
        this.refresh();
      });

    new ButtonComponent(header)
      .setIcon("x")
      .setTooltip("Remove group")
      .onClick(() => {
        this.openToolbarPanel = "filters";
        onRemove();
        this.refresh();
      });

    const children = this.getGroupChildren(group);
    if (!children.length) {
      groupEl.createDiv({ cls: "frontmatter-kanban-filter-empty", text: "No conditions" });
    }

    for (let filterIndex = 0; filterIndex < children.length; filterIndex += 1) {
      const child = children[filterIndex];
      if (this.isFilterGroupNode(child)) {
        this.renderFilterGroup(groupEl, child, "Nested group", () => {
          this.getGroupChildren(group).splice(filterIndex, 1);
        }, depth + 1);
      } else {
        this.renderFilterRow(groupEl, group, child, filterIndex);
      }
    }
  }

  renderToolbarPanel(container, key, icon, tooltip, renderBody, badgeText = "") {
    const panel = container.createEl("details", { cls: "frontmatter-kanban-toolbar-popover" });
    panel.open = this.openToolbarPanel === key;
    if (badgeText) panel.addClass("is-active");
    panel.addEventListener("toggle", () => {
      if (panel.open) {
        container.querySelectorAll(".frontmatter-kanban-toolbar-popover[open]").forEach((otherPanel) => {
          if (otherPanel !== panel) otherPanel.open = false;
        });
        this.openToolbarPanel = key;
      } else if (this.openToolbarPanel === key) {
        this.openToolbarPanel = null;
      }
    });

    const summary = panel.createEl("summary");
    summary.setAttr("aria-label", tooltip);
    summary.setAttr("title", tooltip);
    const iconEl = summary.createSpan({ cls: "frontmatter-kanban-toolbar-icon" });
    setIcon(iconEl, icon);
    summary.createSpan({ cls: "frontmatter-kanban-toolbar-label", text: tooltip });
    if (badgeText) {
      summary.createSpan({ cls: "frontmatter-kanban-toolbar-badge", text: badgeText });
    }

    const body = panel.createDiv({ cls: "frontmatter-kanban-popover-body" });
    renderBody(body);
  }

  renderFilterRow(container, group, filter, filterIndex) {
    const row = container.createDiv({ cls: "frontmatter-kanban-filter-row" });
    const fields = getAllFieldDefinitions(this.plugin);
    const fieldDropdown = new DropdownComponent(row);
    for (const field of fields) {
      fieldDropdown.addOption(field.id, field.name);
    }
    fieldDropdown.setValue(filter.field);
    fieldDropdown.onChange((value) => {
      this.openToolbarPanel = "filters";
      filter.field = value;
      const type = getFieldType(this.plugin, value);
      filter.operator = getOperatorsForType(type)[0][0];
      filter.value = "";
      filter.valueStart = "";
      filter.valueEnd = "";
      this.refresh();
    });

    const type = getFieldType(this.plugin, filter.field);
    const operatorDropdown = new DropdownComponent(row);
    setDropdownOptions(operatorDropdown, getOperatorsForType(type));
    operatorDropdown.setValue(filter.operator);
    operatorDropdown.onChange((value) => {
      this.openToolbarPanel = "filters";
      filter.operator = value;
      this.refresh();
    });

    this.renderFilterValue(row, filter, type);

    new ButtonComponent(row)
      .setIcon("x")
      .setTooltip("Remove condition")
      .onClick(() => {
        this.openToolbarPanel = "filters";
        group.filters.splice(filterIndex, 1);
        this.refresh();
      });
  }

  renderFilterValue(row, filter, type) {
    if (filter.operator === "is_empty" || filter.operator === "not_empty") {
      row.createSpan({ cls: "frontmatter-kanban-filter-placeholder", text: "No value" });
      return;
    }

    if (type === "date-range" && filter.operator === "overlaps") {
      const start = row.createEl("input", { type: "date" });
      start.value = filter.valueStart || "";
      start.addEventListener("change", () => {
        this.openToolbarPanel = "filters";
        filter.valueStart = start.value;
        this.refresh();
      });
      const end = row.createEl("input", { type: "date" });
      end.value = filter.valueEnd || "";
      end.addEventListener("change", () => {
        this.openToolbarPanel = "filters";
        filter.valueEnd = end.value;
        this.refresh();
      });
      return;
    }

    if (type === "date" || type === "date-range") {
      this.renderDateFilterValue(row, filter, "date");
      return;
    }

    if (type === "datetime") {
      this.renderDateFilterValue(row, filter, "datetime-local");
      return;
    }

    if (type === "checkbox") {
      if (!filter.value) filter.value = "true";
      const dropdown = new DropdownComponent(row);
      dropdown.addOption("true", "Checked");
      dropdown.addOption("false", "Unchecked");
      dropdown.setValue(filter.value || "true");
      dropdown.onChange((value) => {
        this.openToolbarPanel = "filters";
        filter.value = value;
        this.refresh();
      });
      return;
    }

    if (filter.field === "status") {
      if (!filter.value) filter.value = this.plugin.settings.statuses[0] || "";
      const dropdown = new DropdownComponent(row);
      for (const status of this.plugin.settings.statuses) {
        dropdown.addOption(status, status);
      }
      dropdown.setValue(filter.value || this.plugin.settings.statuses[0] || "");
      dropdown.onChange((value) => {
        this.openToolbarPanel = "filters";
        filter.value = value;
        this.refresh();
      });
      return;
    }

    if (filter.field === "priority") {
      if (!filter.value) filter.value = PRIORITIES[0];
      const dropdown = new DropdownComponent(row);
      for (const priority of PRIORITIES) {
        dropdown.addOption(priority, priority);
      }
      dropdown.setValue(filter.value || PRIORITIES[0]);
      dropdown.onChange((value) => {
        this.openToolbarPanel = "filters";
        filter.value = value;
        this.refresh();
      });
      return;
    }

    const customField = this.plugin.settings.customFields.find((field) => field.id === filter.field);
    if (customField && customField.type === "select") {
      const options = customField.options.split(",").map((item) => item.trim()).filter(Boolean);
      if (!filter.value && options.length) filter.value = options[0];
      const dropdown = new DropdownComponent(row);
      for (const option of options) {
        dropdown.addOption(option, option);
      }
      dropdown.setValue(filter.value || "");
      dropdown.onChange((value) => {
        this.openToolbarPanel = "filters";
        filter.value = value;
        this.refresh();
      });
      return;
    }

    const input = row.createEl("input", { type: type === "number" ? "number" : "text" });
    input.value = filter.value || "";
    input.addEventListener("change", () => {
      this.openToolbarPanel = "filters";
      filter.value = input.value;
      this.refresh();
    });
  }

  renderDateFilterValue(row, filter, inputType) {
    const modeDropdown = new DropdownComponent(row);
    for (const [value, label] of DATE_FILTER_MODES) {
      modeDropdown.addOption(value, label);
    }
    modeDropdown.setValue(getDateFilterMode(filter));
    modeDropdown.onChange((value) => {
      this.openToolbarPanel = "filters";
      filter.dateMode = value;
      if (value === "relative") {
        filter.relativeAmount = filter.relativeAmount ?? 0;
        filter.relativeUnit = filter.relativeUnit || "days";
        filter.relativeDirection = filter.relativeDirection || "from_now";
      }
      if (value === "formula") {
        filter.formula = filter.formula || "today";
      }
      this.refresh();
    });

    const mode = getDateFilterMode(filter);
    if (mode === "relative") {
      const amount = row.createEl("input", { type: "number", cls: "frontmatter-kanban-filter-amount" });
      amount.min = "0";
      amount.step = "1";
      amount.value = filter.relativeAmount === undefined ? "0" : String(filter.relativeAmount);
      amount.addEventListener("change", () => {
        this.openToolbarPanel = "filters";
        filter.relativeAmount = amount.value;
        this.refresh();
      });

      const unit = new DropdownComponent(row);
      for (const [value, label] of RELATIVE_DATE_UNITS) {
        unit.addOption(value, label);
      }
      unit.setValue(filter.relativeUnit || "days");
      unit.onChange((value) => {
        this.openToolbarPanel = "filters";
        filter.relativeUnit = value;
        this.refresh();
      });

      const direction = new DropdownComponent(row);
      for (const [value, label] of RELATIVE_DATE_DIRECTIONS) {
        direction.addOption(value, label);
      }
      direction.setValue(filter.relativeDirection || "from_now");
      direction.onChange((value) => {
        this.openToolbarPanel = "filters";
        filter.relativeDirection = value;
        this.refresh();
      });
      return;
    }

    if (mode === "formula") {
      const formula = row.createEl("input", {
        type: "text",
        cls: "frontmatter-kanban-filter-formula"
      });
      formula.placeholder = "today - 7d";
      formula.value = filter.formula || "";
      formula.addEventListener("change", () => {
        this.openToolbarPanel = "filters";
        filter.formula = formula.value;
        this.refresh();
      });
      return;
    }

    const input = row.createEl("input", { type: inputType });
    input.value = filter.value || "";
    input.addEventListener("change", () => {
      this.openToolbarPanel = "filters";
      filter.value = input.value;
      this.refresh();
    });
  }

  renderColumn(board, status, tasks, columnIndex) {
    const column = board.createDiv({ cls: "frontmatter-kanban-column" });
    column.dataset.status = status;
    column.style.setProperty("--kanban-column-accent", COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length]);

    const header = column.createDiv({ cls: "frontmatter-kanban-column-header" });
    const title = header.createDiv({ cls: "frontmatter-kanban-column-title" });
    title.createSpan({ text: status });
    title.createSpan({ cls: "frontmatter-kanban-column-count", text: String(tasks.length) });

    const cards = column.createDiv({ cls: "frontmatter-kanban-cards" });
    cards.addEventListener("dragover", (event) => {
      event.preventDefault();
      column.addClass("is-drag-target");
      cards.addClass("is-drag-over");
    });
    cards.addEventListener("dragleave", (event) => {
      if (event.relatedTarget && cards.contains(event.relatedTarget)) return;
      column.removeClass("is-drag-target");
      cards.removeClass("is-drag-over");
    });
    cards.addEventListener("drop", async (event) => {
      event.preventDefault();
      column.removeClass("is-drag-target");
      cards.removeClass("is-drag-over");
      const path = event.dataTransfer.getData("text/plain");
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.plugin.updateTaskStatus(file, status);
      }
    });

    for (const task of tasks) {
      this.renderCard(cards, task);
    }

    if (!tasks.length) {
      cards.createDiv({ cls: "frontmatter-kanban-column-empty", text: "No tasks" });
    }
  }

  renderCard(cards, task) {
    const card = cards.createDiv({ cls: `frontmatter-kanban-card ${getDueClass(task)}` });
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) return;
      card.addClass("is-dragging");
      event.dataTransfer.setData("text/plain", task.file.path);
      event.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
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
    card.addEventListener("click", () => {
      if (this.suppressNextCardClick) return;
      if (this.cardClickTimer) window.clearTimeout(this.cardClickTimer);
      this.cardClickTimer = window.setTimeout(() => {
        this.cardClickTimer = null;
        new EditTaskModal(this.app, this.plugin, task).open();
      }, 180);
    });
    card.addEventListener("dblclick", (event) => {
      event.preventDefault();
      if (this.cardClickTimer) {
        window.clearTimeout(this.cardClickTimer);
        this.cardClickTimer = null;
      }
      this.app.workspace.getLeaf(false).openFile(task.file);
    });

    card.createDiv({ cls: "frontmatter-kanban-card-title", text: getTaskTitle(task) });

    const summary = this.getCardSummary(task);
    if (summary) {
      card.createDiv({ cls: "frontmatter-kanban-card-summary", text: summary });
    }

    const workOn = getWorkOnText(task.frontmatter);
    if (task.frontmatter.priority || workOn) {
      const meta = card.createDiv({ cls: "frontmatter-kanban-card-meta" });
      if (task.frontmatter.priority) {
        meta.createSpan({ cls: `priority-${task.frontmatter.priority}`, text: task.frontmatter.priority });
      }
      if (workOn) {
        meta.createSpan({ text: `Work ${workOn}` });
      }
    }

    if (task.frontmatter.due || task.frontmatter.completed) {
      const footer = card.createDiv({ cls: "frontmatter-kanban-card-footer" });
      if (task.frontmatter.due) {
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

  getCardSummary(task) {
    const fm = task.frontmatter;
    return String(fm.description || fm.summary || fm.notes || "").trim();
  }

  applySortAndFilters(tasks) {
    let result = tasks.slice();
    const activeGroups = this.getFilterGroups().filter((group) => this.getFilterNodeCount(group) > 0);
    if (activeGroups.length) {
      result = result.filter((task) => {
        const groupMatches = activeGroups.map((group) => this.matchesFilterGroup(task, group));
        return this.filterMode === "or" ? groupMatches.some(Boolean) : groupMatches.every(Boolean);
      });
    }

    const type = getFieldType(this.plugin, this.sortField);
    result.sort((a, b) => {
      const compared = compareValues(type, getFieldValue(a, this.sortField), getFieldValue(b, this.sortField));
      return this.sortDirection === "asc" ? compared : -compared;
    });
    return result;
  }

  matchesFilterGroup(task, group) {
    const activeChildren = this.getGroupChildren(group).filter((child) => this.getFilterNodeCount(child) > 0);
    if (!activeChildren.length) return true;
    const childMatches = activeChildren.map((child) => {
      if (this.isFilterGroupNode(child)) return this.matchesFilterGroup(task, child);
      return matchesFilter(task, child, this.plugin);
    });
    return group.mode === "or" ? childMatches.some(Boolean) : childMatches.every(Boolean);
  }
}
