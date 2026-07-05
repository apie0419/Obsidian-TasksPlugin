const {
  ButtonComponent,
  DropdownComponent,
  ItemView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon,
  TFile,
  TextComponent,
  normalizePath,
  stringifyYaml
} = require("obsidian");

const VIEW_TYPE_KANBAN = "frontmatter-kanban-board-view";
const DONE_STATUS = "done";

const BUILT_IN_STATUSES = ["backlog", "nextup", "ongoing", "done"];
const PRIORITIES = ["high", "medium", "easy", "low"];
const PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  easy: 1,
  low: 1
};

const DEFAULT_SETTINGS = {
  taskFolder: "Tasks",
  statuses: [...BUILT_IN_STATUSES],
  createFormFields: {
    status: true,
    priority: true,
    due: true,
    workOn: true,
    notification: true
  },
  customFields: []
};

const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "datetime",
  "date-range",
  "select",
  "checkbox"
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function sanitizeFileName(title) {
  return title
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFieldId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function formatDateTimeForInput(value) {
  const date = toDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateForInput(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function readDateInputAsIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function getTaskTitle(task) {
  return task.frontmatter.title || task.file.basename;
}

function getWorkOnText(frontmatter) {
  const start = frontmatter.work_start || "";
  const end = frontmatter.work_end || "";
  if (!start && !end) return "";
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

function getPriorityWeight(priority) {
  return PRIORITY_WEIGHTS[String(priority || "").toLowerCase()] || 0;
}

function getNotificationLeadMs(frontmatter) {
  const rawAmount = frontmatter.notification_amount;
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") return null;
  const amount = Number(frontmatter.notification_amount);
  const unit = frontmatter.notification_unit;
  if (!Number.isFinite(amount) || amount < 0 || !unit) return null;
  if (unit === "minutes") return amount * 60 * 1000;
  if (unit === "hours") return amount * 60 * 60 * 1000;
  if (unit === "days") return amount * 24 * 60 * 60 * 1000;
  return null;
}

function getDueClass(task) {
  if (task.frontmatter.status === DONE_STATUS) return "";
  const due = toDate(task.frontmatter.due);
  if (!due) return "";
  const diffMs = due.getTime() - Date.now();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (diffDays <= 3) return "is-due-red";
  if (diffDays <= 7) return "is-due-yellow";
  return "";
}

function getFieldValue(task, fieldId) {
  const fm = task.frontmatter;
  if (fieldId === "title") return getTaskTitle(task);
  if (fieldId === "status") return fm.status || "";
  if (fieldId === "priority") return fm.priority || "";
  if (fieldId === "due") return fm.due || "";
  if (fieldId === "created") return fm.created || "";
  if (fieldId === "completed") return fm.completed || "";
  if (fieldId === "work_on") return {
    start: fm.work_start || "",
    end: fm.work_end || ""
  };
  if (fieldId === "notification") return {
    amount: fm.notification_amount ?? "",
    unit: fm.notification_unit ?? ""
  };
  const customField = task.pluginSettings && task.pluginSettings.customFields
    ? task.pluginSettings.customFields.find((field) => field.id === fieldId)
    : null;
  if (customField && customField.type === "date-range") {
    return {
      start: fm[`${fieldId}_start`] || "",
      end: fm[`${fieldId}_end`] || ""
    };
  }
  return fm[fieldId];
}

function getFieldType(plugin, fieldId) {
  if (fieldId === "title") return "text";
  if (fieldId === "status") return "select";
  if (fieldId === "priority") return "priority";
  if (fieldId === "due") return "datetime";
  if (fieldId === "created") return "datetime";
  if (fieldId === "completed") return "datetime";
  if (fieldId === "work_on") return "date-range";
  if (fieldId === "notification") return "notification";
  const custom = plugin.settings.customFields.find((field) => field.id === fieldId);
  return custom ? custom.type : "text";
}

function compareValues(type, a, b) {
  if (type === "priority") {
    return getPriorityWeight(a) - getPriorityWeight(b);
  }
  if (type === "notification") {
    return notificationValueToMs(a) - notificationValueToMs(b);
  }
  if (type === "number") {
    const left = Number(a);
    const right = Number(b);
    return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
  }
  if (type === "date" || type === "datetime") {
    const left = toDate(a);
    const right = toDate(b);
    return (left ? left.getTime() : 0) - (right ? right.getTime() : 0);
  }
  if (type === "date-range") {
    const left = toDate(a && a.start);
    const right = toDate(b && b.start);
    return (left ? left.getTime() : 0) - (right ? right.getTime() : 0);
  }
  if (type === "checkbox") {
    return Number(Boolean(a)) - Number(Boolean(b));
  }
  return String(a || "").localeCompare(String(b || ""));
}

function notificationValueToMs(value) {
  if (!value || !value.amount || !value.unit) return 0;
  return getNotificationLeadMs({
    notification_amount: value.amount,
    notification_unit: value.unit
  }) || 0;
}

function getBuiltInFields() {
  return [
    { id: "title", name: "Title", type: "text" },
    { id: "status", name: "Status", type: "select" },
    { id: "priority", name: "Priority", type: "priority" },
    { id: "due", name: "Due date", type: "datetime" },
    { id: "created", name: "Create date", type: "datetime" },
    { id: "completed", name: "Complete date", type: "datetime" },
    { id: "work_on", name: "Work on", type: "date-range" },
    { id: "notification", name: "Notification", type: "notification" }
  ];
}

function getAllFieldDefinitions(plugin) {
  return [...getBuiltInFields(), ...plugin.settings.customFields];
}

function getOperatorsForType(type) {
  if (type === "number") {
    return [
      ["equals", "="],
      ["not_equals", "!="],
      ["greater_than", ">"],
      ["less_than", "<"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "date" || type === "datetime") {
    return [
      ["on", "on"],
      ["before", "before"],
      ["after", "after"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "date-range") {
    return [
      ["contains_date", "contains date"],
      ["overlaps", "overlaps"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "select" || type === "priority") {
    return [
      ["equals", "="],
      ["not_equals", "!="],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "checkbox") {
    return [
      ["equals", "is"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "notification") {
    return [
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  return [
    ["contains", "contains"],
    ["equals", "="],
    ["not_equals", "!="],
    ["is_empty", "is empty"],
    ["not_empty", "is not empty"]
  ];
}

function isEmptyValue(value, type) {
  if (type === "date-range") {
    return !value || (!value.start && !value.end);
  }
  if (type === "notification") {
    return !value || (!value.amount && !value.unit);
  }
  return value === undefined || value === null || value === "";
}

function dateOnly(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function matchesFilter(task, filter, plugin) {
  const type = getFieldType(plugin, filter.field);
  const value = getFieldValue(task, filter.field);

  if (filter.operator === "is_empty") return isEmptyValue(value, type);
  if (filter.operator === "not_empty") return !isEmptyValue(value, type);

  if (type === "number") {
    const left = Number(value);
    const right = Number(filter.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (filter.operator === "equals") return left === right;
    if (filter.operator === "not_equals") return left !== right;
    if (filter.operator === "greater_than") return left > right;
    if (filter.operator === "less_than") return left < right;
    return false;
  }

  if (type === "date" || type === "datetime") {
    const left = toDate(value);
    const right = toDate(filter.value);
    if (!left || !right) return false;
    if (filter.operator === "on") return dateOnly(left) === dateOnly(right);
    if (filter.operator === "before") return left.getTime() < right.getTime();
    if (filter.operator === "after") return left.getTime() > right.getTime();
    return false;
  }

  if (type === "date-range") {
    const start = toDate(value && value.start);
    const end = toDate(value && value.end);
    if (filter.operator === "contains_date") {
      const target = toDate(filter.value);
      if (!target || (!start && !end)) return false;
      const targetTime = target.getTime();
      const startTime = start ? start.getTime() : Number.NEGATIVE_INFINITY;
      const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY;
      return targetTime >= startTime && targetTime <= endTime;
    }
    if (filter.operator === "overlaps") {
      const filterStart = toDate(filter.valueStart);
      const filterEnd = toDate(filter.valueEnd);
      if ((!start && !end) || (!filterStart && !filterEnd)) return false;
      const leftStart = start ? start.getTime() : Number.NEGATIVE_INFINITY;
      const leftEnd = end ? end.getTime() : Number.POSITIVE_INFINITY;
      const rightStart = filterStart ? filterStart.getTime() : Number.NEGATIVE_INFINITY;
      const rightEnd = filterEnd ? filterEnd.getTime() : Number.POSITIVE_INFINITY;
      return leftStart <= rightEnd && rightStart <= leftEnd;
    }
    return false;
  }

  if (type === "checkbox") {
    const expected = filter.value === "true";
    if (filter.operator === "equals") return Boolean(value) === expected;
    return false;
  }

  const left = String(value || "").toLowerCase();
  const right = String(filter.value || "").toLowerCase();
  if (filter.operator === "contains") return left.includes(right);
  if (filter.operator === "equals") return left === right;
  if (filter.operator === "not_equals") return left !== right;
  return false;
}

function setDropdownOptions(dropdown, options) {
  dropdown.selectEl.empty();
  options.forEach(([value, label]) => dropdown.addOption(value, label));
}

class FrontmatterKanbanPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerView(
      VIEW_TYPE_KANBAN,
      (leaf) => new KanbanView(leaf, this)
    );

    this.addRibbonIcon("kanban", "Open Kanban board", () => {
      this.activateView();
    });

    this.addCommand({
      id: "open-frontmatter-kanban-board",
      name: "Open Kanban board",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "k" }],
      callback: () => this.activateView()
    });

    this.addCommand({
      id: "create-frontmatter-kanban-task",
      name: "Create Kanban task",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "t" }],
      callback: () => new CreateTaskModal(this.app, this).open()
    });

    this.addSettingTab(new KanbanSettingTab(this.app, this));

    this.registerEvent(
      this.app.metadataCache.on("changed", () => {
        this.refreshViews();
        this.syncCompletionDates();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.refreshViews())
    );
    this.registerInterval(window.setInterval(() => this.checkNotifications(), 60 * 1000));
    this.syncCompletionDates();
    this.checkNotifications();
  }

  async loadSettings() {
    const savedSettings = await this.loadData() || {};
    this.settings = Object.assign({}, clone(DEFAULT_SETTINGS), savedSettings);
    const statusSource = Array.isArray(savedSettings.statuses)
      ? savedSettings.statuses
      : DEFAULT_SETTINGS.statuses;
    this.settings.statuses = Array.from(new Set(statusSource.map((status) => normalizeFieldId(status)).filter(Boolean)));
    if (!this.settings.statuses.length) {
      this.settings.statuses = ["backlog"];
    }
    this.settings.customFields = (this.settings.customFields || []).map((field) => ({
      id: normalizeFieldId(field.id || field.name || ""),
      name: field.name || field.id || "",
      type: FIELD_TYPES.includes(field.type) ? field.type : "text",
      options: field.options || "",
      showInCreate: Boolean(field.showInCreate)
    })).filter((field) => field.id && field.name);
    this.settings.createFormFields = Object.assign(
      {},
      clone(DEFAULT_SETTINGS.createFormFields),
      this.settings.createFormFields || {}
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshViews();
  }

  async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN);
    if (leaves.length) {
      this.app.workspace.revealLeaf(leaves[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    await leaf.setViewState({ type: VIEW_TYPE_KANBAN, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_KANBAN)) {
      if (leaf.view && leaf.view.refresh) {
        leaf.view.refresh();
      }
    }
  }

  getTaskFiles() {
    const folder = normalizePath(this.settings.taskFolder || "");
    return this.app.vault.getMarkdownFiles().filter((file) => {
      if (folder && !(file.path === folder || file.path.startsWith(`${folder}/`))) {
        return false;
      }
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache && cache.frontmatter;
      if (!frontmatter) return false;
      return frontmatter.kanban_task === true || frontmatter.kanban_task === "true" || Boolean(frontmatter.status);
    });
  }

  async getTasks() {
    const files = this.getTaskFiles();
    return files.map((file) => {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = Object.assign({}, (cache && cache.frontmatter) || {});
      delete frontmatter.position;
      return { file, frontmatter, pluginSettings: this.settings };
    });
  }

  async createTask(values) {
    const folder = normalizePath(this.settings.taskFolder || "Tasks");
    await this.ensureFolder(folder);

    const sanitizedTitle = sanitizeFileName(values.title);
    if (!sanitizedTitle) {
      new Notice("Task title is required.");
      return;
    }

    const path = normalizePath(`${folder}/${sanitizedTitle}.md`);
    if (this.app.vault.getAbstractFileByPath(path)) {
      new Notice("A task with this title already exists.");
      return;
    }

    const frontmatter = {
      kanban_task: true,
      title: values.title,
      status: values.status || this.settings.statuses[0] || "backlog",
      created: nowIso()
    };

    if (values.priority) frontmatter.priority = values.priority;
    if (values.due) frontmatter.due = values.due;
    if (values.work_start) frontmatter.work_start = values.work_start;
    if (values.work_end) frontmatter.work_end = values.work_end;
    if (values.notification_amount !== undefined && values.notification_amount !== "") {
      frontmatter.notification_amount = Number(values.notification_amount);
      frontmatter.notification_unit = values.notification_unit || "days";
    }

    if (frontmatter.status === DONE_STATUS) {
      frontmatter.completed = nowIso();
    }

    for (const field of this.settings.customFields) {
      if (!field.showInCreate) continue;
      if (field.type === "date-range") {
        if (values[`${field.id}_start`]) frontmatter[`${field.id}_start`] = values[`${field.id}_start`];
        if (values[`${field.id}_end`]) frontmatter[`${field.id}_end`] = values[`${field.id}_end`];
      } else if (values[field.id] !== undefined && values[field.id] !== "") {
        frontmatter[field.id] = field.type === "number" ? Number(values[field.id]) : values[field.id];
      }
    }

    const yaml = stringifyYaml(frontmatter).trim();
    await this.app.vault.create(path, `---\n${yaml}\n---\n\n# ${values.title}\n`);
    new Notice("Task created.");
    this.refreshViews();
  }

  async ensureFolder(folderPath) {
    const normalized = normalizePath(folderPath);
    if (!normalized) return;
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  async updateTaskStatus(file, status) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.status = status;
      if (status === DONE_STATUS) {
        if (!frontmatter.completed) frontmatter.completed = nowIso();
      } else {
        delete frontmatter.completed;
      }
    });
    this.refreshViews();
  }

  async renameStatus(oldStatus, nextStatus) {
    const normalized = normalizeFieldId(nextStatus);
    if (!normalized) {
      new Notice("Status is required.");
      return false;
    }
    if (normalized !== oldStatus && this.settings.statuses.includes(normalized)) {
      new Notice("Status already exists.");
      return false;
    }
    if (normalized === oldStatus) return true;

    this.settings.statuses = this.settings.statuses.map((status) => status === oldStatus ? normalized : status);
    await this.saveData(this.settings);

    for (const file of this.getTaskFiles()) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (frontmatter.status !== oldStatus) return;
        frontmatter.status = normalized;
        if (normalized === DONE_STATUS) {
          if (!frontmatter.completed) frontmatter.completed = nowIso();
        } else if (oldStatus === DONE_STATUS) {
          delete frontmatter.completed;
        }
      });
    }

    this.refreshViews();
    return true;
  }

  async removeStatus(status) {
    if (this.settings.statuses.length <= 1) {
      new Notice("At least one status is required.");
      return false;
    }
    this.settings.statuses = this.settings.statuses.filter((item) => item !== status);
    await this.saveSettings();
    return true;
  }

  async updateTask(file, values) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.kanban_task = true;
      frontmatter.title = values.title.trim();
      frontmatter.status = values.status || this.settings.statuses[0] || "backlog";

      if (values.priority) frontmatter.priority = values.priority;
      else delete frontmatter.priority;

      if (values.due) frontmatter.due = values.due;
      else delete frontmatter.due;

      if (values.work_start) frontmatter.work_start = values.work_start;
      else delete frontmatter.work_start;

      if (values.work_end) frontmatter.work_end = values.work_end;
      else delete frontmatter.work_end;

      if (values.notification_amount !== undefined && values.notification_amount !== "") {
        frontmatter.notification_amount = Number(values.notification_amount);
        frontmatter.notification_unit = values.notification_unit || "days";
      } else {
        delete frontmatter.notification_amount;
        delete frontmatter.notification_unit;
        delete frontmatter.notification_sent_for;
        delete frontmatter.notification_sent_at;
      }

      if (frontmatter.notification_sent_for && frontmatter.notification_sent_for !== frontmatter.due) {
        delete frontmatter.notification_sent_for;
        delete frontmatter.notification_sent_at;
      }

      if (frontmatter.status === DONE_STATUS) {
        if (!frontmatter.completed) frontmatter.completed = nowIso();
      } else {
        delete frontmatter.completed;
      }

      for (const field of this.settings.customFields) {
        if (field.type === "date-range") {
          if (values[`${field.id}_start`]) frontmatter[`${field.id}_start`] = values[`${field.id}_start`];
          else delete frontmatter[`${field.id}_start`];

          if (values[`${field.id}_end`]) frontmatter[`${field.id}_end`] = values[`${field.id}_end`];
          else delete frontmatter[`${field.id}_end`];
          continue;
        }

        if (field.type === "checkbox") {
          if (values[field.id] === undefined) delete frontmatter[field.id];
          else frontmatter[field.id] = Boolean(values[field.id]);
          continue;
        }

        if (values[field.id] !== undefined && values[field.id] !== "") {
          frontmatter[field.id] = field.type === "number" ? Number(values[field.id]) : values[field.id];
        } else {
          delete frontmatter[field.id];
        }
      }
    });
    new Notice("Task updated.");
    this.refreshViews();
  }

  async syncCompletionDates() {
    if (this.completionSyncRunning) return;
    this.completionSyncRunning = true;
    try {
      const tasks = await this.getTasks();
      for (const task of tasks) {
        const status = task.frontmatter.status;
        const hasCompleted = Boolean(task.frontmatter.completed);
        const shouldSetCompleted = status === DONE_STATUS && !hasCompleted;
        const shouldClearCompleted = status && status !== DONE_STATUS && hasCompleted;
        if (!shouldSetCompleted && !shouldClearCompleted) continue;

        await this.app.fileManager.processFrontMatter(task.file, (frontmatter) => {
          if (frontmatter.status === DONE_STATUS) {
            if (!frontmatter.completed) frontmatter.completed = nowIso();
          } else {
            delete frontmatter.completed;
          }
        });
      }
    } finally {
      this.completionSyncRunning = false;
    }
  }

  async checkNotifications() {
    const tasks = await this.getTasks();
    const now = Date.now();
    for (const task of tasks) {
      const fm = task.frontmatter;
      if (fm.status === DONE_STATUS) continue;
      const due = toDate(fm.due);
      const leadMs = getNotificationLeadMs(fm);
      if (!due || leadMs === null) continue;
      if (now < due.getTime() - leadMs) continue;
      if (fm.notification_sent_for === fm.due) continue;

      new Notice(`Due soon: ${getTaskTitle(task)}`, 8000);
      await this.app.fileManager.processFrontMatter(task.file, (frontmatter) => {
        frontmatter.notification_sent_for = frontmatter.due;
        frontmatter.notification_sent_at = nowIso();
      });
    }
  }
}

class KanbanView extends ItemView {
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
    return this.getFilterGroups().reduce((count, group) => count + group.filters.length, 0);
  }

  createDefaultFilter() {
    const firstField = getAllFieldDefinitions(this.plugin)[0];
    return {
      field: firstField.id,
      operator: getOperatorsForType(firstField.type)[0][0],
      value: ""
    };
  }

  async refresh() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("frontmatter-kanban");

    const toolbar = container.createDiv({ cls: "frontmatter-kanban-toolbar" });
    this.renderToolbar(toolbar);

    const board = container.createDiv({ cls: "frontmatter-kanban-board" });
    const tasks = this.applySortAndFilters(await this.plugin.getTasks());

    for (const status of this.plugin.settings.statuses) {
      this.renderColumn(board, status, tasks.filter((task) => (task.frontmatter.status || "") === status));
    }
  }

  renderToolbar(toolbar) {
    const actions = toolbar.createDiv({ cls: "frontmatter-kanban-toolbar-actions" });

    new ButtonComponent(actions)
      .setIcon("plus")
      .setTooltip("New task")
      .setCta()
      .onClick(() => new CreateTaskModal(this.app, this.plugin).open());

    new ButtonComponent(actions)
      .setIcon("refresh-cw")
      .setTooltip("Refresh")
      .onClick(() => this.refresh());

    const panels = toolbar.createDiv({ cls: "frontmatter-kanban-toolbar-panels" });
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
        this.getFilterGroups().push({ mode: "and", filters: [this.createDefaultFilter()] });
        this.refresh();
      });

    if (!this.getFilterCount()) {
      filters.createDiv({ cls: "frontmatter-kanban-filter-empty", text: "No filters" });
    }

    const groups = this.getFilterGroups();
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      this.renderFilterGroup(filters, groups[groupIndex], groupIndex);
    }
  }

  renderFilterGroup(container, group, groupIndex) {
    const groupEl = container.createDiv({ cls: "frontmatter-kanban-filter-group" });
    const header = groupEl.createDiv({ cls: "frontmatter-kanban-filter-group-header" });
    header.createSpan({ text: `Group ${groupIndex + 1}` });

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
      .setIcon("x")
      .setTooltip("Remove group")
      .onClick(() => {
        this.openToolbarPanel = "filters";
        this.getFilterGroups().splice(groupIndex, 1);
        if (!this.filterGroups.length) {
          this.filterGroups.push({ mode: "and", filters: [] });
        }
        this.refresh();
      });

    if (!group.filters.length) {
      groupEl.createDiv({ cls: "frontmatter-kanban-filter-empty", text: "No conditions" });
    }

    for (let filterIndex = 0; filterIndex < group.filters.length; filterIndex += 1) {
      this.renderFilterRow(groupEl, group, group.filters[filterIndex], filterIndex);
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
      const input = row.createEl("input", { type: "date" });
      input.value = filter.value || "";
      input.addEventListener("change", () => {
        this.openToolbarPanel = "filters";
        filter.value = input.value;
        this.refresh();
      });
      return;
    }

    if (type === "datetime") {
      const input = row.createEl("input", { type: "datetime-local" });
      input.value = filter.value || "";
      input.addEventListener("change", () => {
        this.openToolbarPanel = "filters";
        filter.value = input.value;
        this.refresh();
      });
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

  renderColumn(board, status, tasks) {
    const column = board.createDiv({ cls: "frontmatter-kanban-column" });
    column.dataset.status = status;
    column.createDiv({ cls: "frontmatter-kanban-column-title", text: status });

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

    const meta = card.createDiv({ cls: "frontmatter-kanban-card-meta" });
    if (task.frontmatter.priority) {
      meta.createSpan({ cls: `priority-${task.frontmatter.priority}`, text: task.frontmatter.priority });
    }
    if (task.frontmatter.due) {
      meta.createSpan({ text: `Due ${formatDateTimeForInput(task.frontmatter.due).replace("T", " ")}` });
    }
    const workOn = getWorkOnText(task.frontmatter);
    if (workOn) {
      meta.createSpan({ text: `Work ${workOn}` });
    }
  }

  applySortAndFilters(tasks) {
    let result = tasks.slice();
    const activeGroups = this.getFilterGroups().filter((group) => group.filters.length);
    if (activeGroups.length) {
      result = result.filter((task) => {
        const groupMatches = activeGroups.map((group) => {
          const conditionMatches = group.filters.map((filter) => matchesFilter(task, filter, this.plugin));
          return group.mode === "or" ? conditionMatches.some(Boolean) : conditionMatches.every(Boolean);
        });
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
}

class EditTaskModal extends Modal {
  constructor(app, plugin, task) {
    super(app);
    this.plugin = plugin;
    this.task = task;
    const fm = task.frontmatter;
    this.values = {
      title: getTaskTitle(task),
      status: fm.status || plugin.settings.statuses[0] || "backlog",
      priority: fm.priority || "",
      due: fm.due || "",
      work_start: fm.work_start || "",
      work_end: fm.work_end || "",
      notification_amount: fm.notification_amount ?? "",
      notification_unit: fm.notification_unit || "days"
    };

    for (const field of plugin.settings.customFields) {
      if (field.type === "date-range") {
        this.values[`${field.id}_start`] = fm[`${field.id}_start`] || "";
        this.values[`${field.id}_end`] = fm[`${field.id}_end`] || "";
      } else if (field.type === "checkbox") {
        const value = fm[field.id];
        if (value !== undefined) this.values[field.id] = value === true || value === "true";
      } else {
        this.values[field.id] = fm[field.id] ?? "";
      }
    }
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("frontmatter-kanban-modal");
    contentEl.createEl("h2", { text: "Edit task" });

    new Setting(contentEl)
      .setName("Title")
      .addText((text) => text
        .setPlaceholder("Task title")
        .setValue(this.values.title)
        .onChange((value) => {
          this.values.title = value;
        }));

    new Setting(contentEl)
      .setName("Status")
      .addDropdown((dropdown) => {
        for (const status of this.plugin.settings.statuses) {
          dropdown.addOption(status, status);
        }
        dropdown.setValue(this.values.status);
        dropdown.onChange((value) => {
          this.values.status = value;
        });
      });

    new Setting(contentEl)
      .setName("Priority")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "None");
        for (const priority of PRIORITIES) {
          dropdown.addOption(priority, priority);
        }
        dropdown.setValue(this.values.priority);
        dropdown.onChange((value) => {
          this.values.priority = value;
        });
      });

    this.renderDateTimeSetting(contentEl, "Due date", "due");
    this.renderDateRangeSetting(contentEl, "Work on", "work_start", "work_end");
    this.renderNotificationSetting(contentEl);

    for (const field of this.plugin.settings.customFields) {
      this.renderCustomField(contentEl, field);
    }

    const footer = contentEl.createDiv({ cls: "frontmatter-kanban-modal-footer" });
    new ButtonComponent(footer)
      .setButtonText("Cancel")
      .onClick(() => this.close());
    new ButtonComponent(footer)
      .setButtonText("Open note")
      .onClick(() => {
        this.close();
        this.app.workspace.getLeaf(false).openFile(this.task.file);
      });
    new ButtonComponent(footer)
      .setButtonText("Save")
      .setCta()
      .onClick(async () => {
        if (!this.values.title.trim()) {
          new Notice("Task title is required.");
          return;
        }
        await this.plugin.updateTask(this.task.file, this.values);
        this.close();
      });
  }

  renderDateTimeSetting(container, label, key) {
    const setting = new Setting(container).setName(label);
    const input = setting.controlEl.createEl("input", { type: "datetime-local" });
    input.value = formatDateTimeForInput(this.values[key]);
    input.addEventListener("change", () => {
      this.values[key] = readDateInputAsIso(input.value);
    });
  }

  renderDateRangeSetting(container, label, startKey, endKey) {
    const setting = new Setting(container).setName(label);
    const start = setting.controlEl.createEl("input", { type: "date" });
    start.value = formatDateForInput(this.values[startKey]);
    start.addEventListener("change", () => {
      this.values[startKey] = start.value;
    });
    const end = setting.controlEl.createEl("input", { type: "date" });
    end.value = formatDateForInput(this.values[endKey]);
    end.addEventListener("change", () => {
      this.values[endKey] = end.value;
    });
  }

  renderNotificationSetting(container) {
    const setting = new Setting(container).setName("Notify before due");
    const amount = setting.controlEl.createEl("input", { type: "number" });
    amount.min = "0";
    amount.placeholder = "Amount";
    amount.value = this.values.notification_amount === undefined ? "" : String(this.values.notification_amount);
    amount.addEventListener("change", () => {
      this.values.notification_amount = amount.value;
    });
    const unit = new DropdownComponent(setting.controlEl);
    unit.addOption("minutes", "minutes");
    unit.addOption("hours", "hours");
    unit.addOption("days", "days");
    unit.setValue(this.values.notification_unit);
    unit.onChange((value) => {
      this.values.notification_unit = value;
    });
  }

  renderCustomField(container, field) {
    if (field.type === "date-range") {
      this.renderDateRangeSetting(container, field.name, `${field.id}_start`, `${field.id}_end`);
      return;
    }

    const setting = new Setting(container).setName(field.name);
    if (field.type === "select") {
      setting.addDropdown((dropdown) => {
        dropdown.addOption("", "None");
        for (const option of field.options.split(",").map((item) => item.trim()).filter(Boolean)) {
          dropdown.addOption(option, option);
        }
        dropdown.setValue(this.values[field.id] || "");
        dropdown.onChange((value) => {
          this.values[field.id] = value;
        });
      });
      return;
    }

    if (field.type === "checkbox") {
      setting.addToggle((toggle) => toggle
        .setValue(Boolean(this.values[field.id]))
        .onChange((value) => {
          this.values[field.id] = value;
        }));
      return;
    }

    const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : "text";
    const input = setting.controlEl.createEl("input", { type: inputType });
    if (field.type === "datetime") {
      input.value = formatDateTimeForInput(this.values[field.id]);
    } else if (field.type === "date") {
      input.value = formatDateForInput(this.values[field.id]);
    } else {
      input.value = this.values[field.id] === undefined ? "" : String(this.values[field.id]);
    }
    input.addEventListener("change", () => {
      this.values[field.id] = field.type === "datetime" ? readDateInputAsIso(input.value) : input.value;
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}
class CreateTaskModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.values = {
      title: "",
      status: plugin.settings.statuses[0] || "backlog",
      notification_unit: "days"
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("frontmatter-kanban-modal");
    contentEl.createEl("h2", { text: "Create task" });

    new Setting(contentEl)
      .setName("Title")
      .addText((text) => text
        .setPlaceholder("Task title")
        .onChange((value) => {
          this.values.title = value;
        }));

    if (this.plugin.settings.createFormFields.status) {
      new Setting(contentEl)
        .setName("Status")
        .addDropdown((dropdown) => {
          for (const status of this.plugin.settings.statuses) {
            dropdown.addOption(status, status);
          }
          dropdown.setValue(this.values.status);
          dropdown.onChange((value) => {
            this.values.status = value;
          });
        });
    }

    if (this.plugin.settings.createFormFields.priority) {
      this.values.priority = this.values.priority || "medium";
      new Setting(contentEl)
        .setName("Priority")
        .addDropdown((dropdown) => {
          for (const priority of PRIORITIES) {
            dropdown.addOption(priority, priority);
          }
          dropdown.setValue(this.values.priority);
          dropdown.onChange((value) => {
            this.values.priority = value;
          });
        });
    }

    if (this.plugin.settings.createFormFields.due) {
      this.renderDateTimeSetting(contentEl, "Due date", "due");
    }

    if (this.plugin.settings.createFormFields.workOn) {
      this.renderDateRangeSetting(contentEl, "Work on", "work_start", "work_end");
    }

    if (this.plugin.settings.createFormFields.notification) {
      this.renderNotificationSetting(contentEl);
    }

    for (const field of this.plugin.settings.customFields.filter((item) => item.showInCreate)) {
      this.renderCustomField(contentEl, field);
    }

    const footer = contentEl.createDiv({ cls: "frontmatter-kanban-modal-footer" });
    new ButtonComponent(footer)
      .setButtonText("Cancel")
      .onClick(() => this.close());
    new ButtonComponent(footer)
      .setButtonText("Create")
      .setCta()
      .onClick(async () => {
        if (!this.values.title.trim()) {
          new Notice("Task title is required.");
          return;
        }
        await this.plugin.createTask(this.values);
        this.close();
      });
  }

  renderDateTimeSetting(container, label, key) {
    const setting = new Setting(container).setName(label);
    const input = setting.controlEl.createEl("input", { type: "datetime-local" });
    input.addEventListener("change", () => {
      this.values[key] = readDateInputAsIso(input.value);
    });
  }

  renderDateRangeSetting(container, label, startKey, endKey) {
    const setting = new Setting(container).setName(label);
    const start = setting.controlEl.createEl("input", { type: "date" });
    start.addEventListener("change", () => {
      this.values[startKey] = start.value;
    });
    const end = setting.controlEl.createEl("input", { type: "date" });
    end.addEventListener("change", () => {
      this.values[endKey] = end.value;
    });
  }

  renderNotificationSetting(container) {
    const setting = new Setting(container).setName("Notify before due");
    const amount = setting.controlEl.createEl("input", { type: "number" });
    amount.min = "0";
    amount.placeholder = "Amount";
    amount.addEventListener("change", () => {
      this.values.notification_amount = amount.value;
    });
    const unit = new DropdownComponent(setting.controlEl);
    unit.addOption("minutes", "minutes");
    unit.addOption("hours", "hours");
    unit.addOption("days", "days");
    unit.setValue(this.values.notification_unit);
    unit.onChange((value) => {
      this.values.notification_unit = value;
    });
  }

  renderCustomField(container, field) {
    if (field.type === "date-range") {
      this.renderDateRangeSetting(container, field.name, `${field.id}_start`, `${field.id}_end`);
      return;
    }

    const setting = new Setting(container).setName(field.name);
    if (field.type === "select") {
      setting.addDropdown((dropdown) => {
        for (const option of field.options.split(",").map((item) => item.trim()).filter(Boolean)) {
          dropdown.addOption(option, option);
        }
        dropdown.onChange((value) => {
          this.values[field.id] = value;
        });
      });
      return;
    }

    if (field.type === "checkbox") {
      setting.addToggle((toggle) => toggle.onChange((value) => {
        this.values[field.id] = value;
      }));
      return;
    }

    const inputType = field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : "text";
    const input = setting.controlEl.createEl("input", { type: inputType });
    input.addEventListener("change", () => {
      this.values[field.id] = field.type === "datetime" ? readDateInputAsIso(input.value) : input.value;
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

class KanbanSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("frontmatter-kanban-settings");

    containerEl.createEl("h2", { text: "Frontmatter Kanban Board" });

    new Setting(containerEl)
      .setName("Task folder")
      .setDesc("Markdown task notes are created and read from this folder.")
      .addText((text) => text
        .setPlaceholder("Tasks")
        .setValue(this.plugin.settings.taskFolder)
        .onChange(async (value) => {
          this.plugin.settings.taskFolder = value.trim() || "Tasks";
          await this.plugin.saveSettings();
        }));

    this.renderStatuses(containerEl);
    this.renderCreateFormFields(containerEl);
    this.renderCustomFields(containerEl);
  }

  renderStatuses(container) {
    container.createEl("h3", { text: "Statuses" });
    const list = container.createDiv({ cls: "frontmatter-kanban-settings-list" });
    for (const status of this.plugin.settings.statuses) {
      const row = list.createDiv({ cls: "frontmatter-kanban-settings-row frontmatter-kanban-status-row" });
      const input = new TextComponent(row).setValue(status);

      new ButtonComponent(row)
        .setButtonText("Save")
        .onClick(async () => {
          const renamed = await this.plugin.renameStatus(status, input.getValue());
          if (renamed) this.display();
        });

      new ButtonComponent(row)
        .setButtonText("Remove")
        .onClick(async () => {
          const removed = await this.plugin.removeStatus(status);
          if (removed) this.display();
        });
    }

    const addRow = container.createDiv({ cls: "frontmatter-kanban-settings-add-row" });
    const input = new TextComponent(addRow).setPlaceholder("New status");
    new ButtonComponent(addRow)
      .setButtonText("Add status")
      .onClick(async () => {
        const status = normalizeFieldId(input.getValue());
        if (!status) {
          new Notice("Status is required.");
          return;
        }
        if (this.plugin.settings.statuses.includes(status)) {
          new Notice("Status already exists.");
          return;
        }
        this.plugin.settings.statuses.push(status);
        await this.plugin.saveSettings();
        this.display();
      });
  }

  renderCreateFormFields(container) {
    container.createEl("h3", { text: "Create task form" });
    const options = [
      ["status", "Status"],
      ["priority", "Priority"],
      ["due", "Due date"],
      ["workOn", "Work on"],
      ["notification", "Notification"]
    ];
    for (const [key, label] of options) {
      new Setting(container)
        .setName(label)
        .addToggle((toggle) => toggle
          .setValue(Boolean(this.plugin.settings.createFormFields[key]))
          .onChange(async (value) => {
            this.plugin.settings.createFormFields[key] = value;
            await this.plugin.saveSettings();
          }));
    }
  }

  renderCustomFields(container) {
    container.createEl("h3", { text: "Custom fields" });
    const list = container.createDiv({ cls: "frontmatter-kanban-settings-list" });
    for (const field of this.plugin.settings.customFields) {
      this.renderCustomFieldRow(list, field);
    }

    container.createEl("h4", { text: "Add field" });
    const add = container.createDiv({ cls: "frontmatter-kanban-custom-field-editor" });
    const name = new TextComponent(add).setPlaceholder("Name");
    const type = new DropdownComponent(add);
    for (const fieldType of FIELD_TYPES) {
      type.addOption(fieldType, fieldType);
    }
    const options = new TextComponent(add).setPlaceholder("Select options, comma separated");
    const showInCreate = add.createEl("label", { cls: "frontmatter-kanban-inline-toggle" });
    const showInCreateInput = showInCreate.createEl("input", { type: "checkbox" });
    showInCreate.createSpan({ text: "Show in create form" });

    new ButtonComponent(add)
      .setButtonText("Add field")
      .onClick(async () => {
        const fieldName = name.getValue().trim();
        const id = normalizeFieldId(fieldName);
        if (!fieldName || !id) {
          new Notice("Field name is required.");
          return;
        }
        const existingIds = new Set(getAllFieldDefinitions(this.plugin).map((field) => field.id));
        if (existingIds.has(id)) {
          new Notice("Field already exists.");
          return;
        }
        this.plugin.settings.customFields.push({
          id,
          name: fieldName,
          type: type.getValue(),
          options: options.getValue(),
          showInCreate: showInCreateInput.checked
        });
        await this.plugin.saveSettings();
        this.display();
      });
  }

  renderCustomFieldRow(container, field) {
    const row = container.createDiv({ cls: "frontmatter-kanban-custom-field-row" });
    const name = new TextComponent(row).setValue(field.name);
    const type = new DropdownComponent(row);
    for (const fieldType of FIELD_TYPES) {
      type.addOption(fieldType, fieldType);
    }
    type.setValue(field.type);
    const options = new TextComponent(row)
      .setPlaceholder("Select options")
      .setValue(field.options || "");
    const showInCreate = row.createEl("label", { cls: "frontmatter-kanban-inline-toggle" });
    const showInCreateInput = showInCreate.createEl("input", { type: "checkbox" });
    showInCreateInput.checked = Boolean(field.showInCreate);
    showInCreate.createSpan({ text: "Create form" });

    new ButtonComponent(row)
      .setButtonText("Save")
      .onClick(async () => {
        const nextName = name.getValue().trim();
        if (!nextName) {
          new Notice("Field name is required.");
          return;
        }
        field.name = nextName;
        field.type = type.getValue();
        field.options = options.getValue();
        field.showInCreate = showInCreateInput.checked;
        await this.plugin.saveSettings();
        this.display();
      });

    new ButtonComponent(row)
      .setButtonText("Remove")
      .onClick(async () => {
        this.plugin.settings.customFields = this.plugin.settings.customFields.filter((item) => item.id !== field.id);
        await this.plugin.saveSettings();
        this.display();
      });
  }
}

module.exports = FrontmatterKanbanPlugin;
