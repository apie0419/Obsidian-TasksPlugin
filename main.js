var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FrontmatterKanbanPlugin
});
module.exports = __toCommonJS(main_exports);

// src/plugin.ts
var import_obsidian6 = require("obsidian");

// src/constants.ts
var BASES_KANBAN_VIEW_TYPE = "frontmatterkanban";
var BASES_TIMELINE_VIEW_TYPE = "frontmattertimeline";
var ROOT_FOLDER = "TaskManagement";
var TASK_FOLDER = `${ROOT_FOLDER}/Tasks`;
var VIEWS_FOLDER = `${ROOT_FOLDER}/Views`;
var PROJECT_FOLDER = `${ROOT_FOLDER}/Projects`;
var FEATURE_FOLDER = `${PROJECT_FOLDER}/Features`;
var DEFAULT_KANBAN_BASE_FILE = `${VIEWS_FOLDER}/Kanban.base`;
var DEFAULT_TIMELINE_BASE_FILE = `${VIEWS_FOLDER}/Timeline.base`;
var DONE_STATUS = "done";
var TASK_TAG = "task";
var LEGACY_TASK_TAG = "tasks";
var BUILT_IN_STATUSES = ["backlog", "nextup", "ongoing", "done"];
var PRIORITIES = ["high", "medium", "low"];
var PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1
};
var DEFAULT_SETTINGS = {
  taskFolder: TASK_FOLDER,
  baseFilePath: DEFAULT_KANBAN_BASE_FILE,
  projectFolder: PROJECT_FOLDER,
  statuses: [...BUILT_IN_STATUSES],
  createFormFields: {
    status: true,
    priority: true,
    project: true,
    feature: true,
    due: true,
    workOn: true,
    notification: true
  },
  customFields: []
};
var FIELD_TYPES = [
  "text",
  "number",
  "date",
  "datetime",
  "date-range",
  "select",
  "checkbox"
];

// src/bases/KanbanBasesView.ts
var import_obsidian3 = require("obsidian");

// src/modals/TaskModals.ts
var import_obsidian = require("obsidian");

// src/status.ts
function cleanStatus(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function getStatusKey(value) {
  return cleanStatus(value).toLowerCase();
}
function statusEquals(left, right) {
  return getStatusKey(left) === getStatusKey(right);
}
function isDoneStatus(status) {
  return statusEquals(status, DONE_STATUS);
}
function dedupeStatuses(statuses) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const status of statuses) {
    const cleaned = cleanStatus(status);
    const key = getStatusKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}

// src/utils/date.ts
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function formatTimestampForFileName(value = /* @__PURE__ */ new Date()) {
  const date = toDate(value) || /* @__PURE__ */ new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 6e4);
  return local.toISOString().slice(0, 19).replace("T", " ").replace(/:/g, "-");
}
function toDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
function formatDateTimeForInput(value) {
  const date = toDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 6e4);
  return local.toISOString().slice(0, 16);
}
function formatDateForInput(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}
function formatDateLabel(value) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString(void 0, {
    month: "short",
    day: "numeric"
  });
}
function readDateInputAsIso(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}
function getWorkOnText(frontmatter) {
  const start = String(frontmatter.work_start || "");
  const end = String(frontmatter.work_end || "");
  if (!start && !end) return "";
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

// src/taskFields.ts
function getTaskTitle(task) {
  const title = String(task.frontmatter.title || "").trim();
  if (title) return title;
  const basename = String(task.file.basename || "").trim();
  const titledTimestamp = basename.match(/^(.+)\s+\(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}[-:]\d{2}(?:[-:]\d{2})?)?\)$/);
  if (titledTimestamp) return titledTimestamp[1].trim() || "Untitled task";
  const timestampedTitle = basename.match(/^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}[-:]\d{2}(?:[-:]\d{2})?)?\s+-\s+(.+)$/);
  return (timestampedTitle ? timestampedTitle[1].trim() : basename) || "Untitled task";
}
function getPriorityWeight(priority) {
  return PRIORITY_WEIGHTS[String(priority || "").toLowerCase()] || 0;
}
function getNotificationLeadMs(frontmatter) {
  const rawAmount = frontmatter.notification_amount;
  if (rawAmount === void 0 || rawAmount === null || rawAmount === "") return null;
  const amount = Number(frontmatter.notification_amount);
  const unit = frontmatter.notification_unit;
  if (!Number.isFinite(amount) || amount < 0 || !unit) return null;
  if (unit === "minutes") return amount * 60 * 1e3;
  if (unit === "hours") return amount * 60 * 60 * 1e3;
  if (unit === "days") return amount * 24 * 60 * 60 * 1e3;
  return null;
}
function getDueClass(task) {
  if (isDoneStatus(task.frontmatter.status)) return "";
  const due = toDate(task.frontmatter.due);
  if (!due) return "";
  const diffMs = due.getTime() - Date.now();
  const diffDays = diffMs / (24 * 60 * 60 * 1e3);
  if (diffDays <= 3) return "is-due-red";
  if (diffDays <= 10) return "is-due-yellow";
  return "is-due-safe";
}
function getBuiltInFields() {
  return [
    { id: "title", name: "Title", type: "text" },
    { id: "status", name: "Status", type: "select" },
    { id: "project", name: "Project", type: "text" },
    { id: "feature", name: "Feature", type: "text" },
    { id: "priority", name: "Priority", type: "priority" },
    { id: "priority_weight", name: "Priority weight", type: "number" },
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

// src/modals/TaskModals.ts
function markButtonDestructive(button) {
  if (typeof button.setDestructive === "function") {
    return button.setDestructive();
  }
  if (typeof button.setWarning === "function") {
    return button.setWarning();
  }
  return button;
}
function parseCheckboxValue(value) {
  if (value === true || value === false) return value;
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "true" || normalized === "yes" || normalized === "1" || normalized === "checked";
}
function parseDateRangeDefault(value) {
  const parts = String(value || "").split(/\s*(?:,|\.\.| to )\s*/i).map((item) => item.trim()).filter(Boolean);
  return {
    start: parts[0] || "",
    end: parts[1] || ""
  };
}
function getDefaultFieldValue(field) {
  var _a;
  const value = (_a = field.defaultValue) != null ? _a : "";
  if (value === "") return void 0;
  if (field.type === "checkbox") return parseCheckboxValue(value);
  if (field.type === "number") return Number.isFinite(Number(value)) ? Number(value) : void 0;
  return value;
}
function formatTaskInfoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).replace(/, (?=\d{2}:\d{2}$)/, " ");
}
var MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function pad2(value) {
  return String(value).padStart(2, "0");
}
function parsePickerDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const dateMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (dateMatch) {
      return new Date(
        Number(dateMatch[1]),
        Number(dateMatch[2]) - 1,
        Number(dateMatch[3]),
        Number(dateMatch[4] || "0"),
        Number(dateMatch[5] || "0")
      );
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}
function formatPickerDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function formatPickerDateTime(date) {
  return `${formatPickerDate(date)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function formatPickerDisplay(value, includeTime) {
  const date = parsePickerDate(value);
  if (!date) return includeTime ? "Select date and time" : "Select date";
  return includeTime ? formatPickerDateTime(date) : formatPickerDate(date);
}
function isSameDate(left, right) {
  return Boolean(left && right && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate());
}
function getReferenceLabel(kind) {
  return kind === "feature" ? "feature" : "project";
}
function getReferenceEmoji(kind) {
  return kind === "feature" ? "\u{1F6E0}\uFE0F" : "\u{1F680}";
}
function getReferenceDisplayValue(plugin, value) {
  return plugin.getReferenceName(value) || String(value || "").trim();
}
var DatePickerModal = class extends import_obsidian.Modal {
  constructor(app, options) {
    super(app);
    this.titleText = options.title;
    this.includeTime = Boolean(options.includeTime);
    this.onApply = options.onApply;
    this.selectedDate = parsePickerDate(options.value);
    const seed = this.selectedDate || /* @__PURE__ */ new Date();
    this.viewDate = new Date(seed.getFullYear(), seed.getMonth(), 1);
    this.hour = this.selectedDate ? this.selectedDate.getHours() : 9;
    this.minute = this.selectedDate ? this.selectedDate.getMinutes() : 0;
  }
  onOpen() {
    this.modalEl.addClass("frontmatter-kanban-date-picker-shell");
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("frontmatter-kanban-date-picker-modal");
    contentEl.createEl("h2", { text: this.titleText });
    const pickerBlock = contentEl.createDiv({ cls: "frontmatter-kanban-date-picker-block" });
    const header = pickerBlock.createDiv({ cls: "frontmatter-kanban-date-picker-header" });
    const previous = header.createEl("button", { type: "button", text: "<" });
    previous.addEventListener("click", () => {
      this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() - 1, 1);
      this.render();
    });
    header.createDiv({
      cls: "frontmatter-kanban-date-picker-month",
      text: `${MONTH_LABELS[this.viewDate.getMonth()]} ${this.viewDate.getFullYear()}`
    });
    const next = header.createEl("button", { type: "button", text: ">" });
    next.addEventListener("click", () => {
      this.viewDate = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 1);
      this.render();
    });
    const grid = pickerBlock.createDiv({ cls: "frontmatter-kanban-date-picker-grid" });
    for (const weekday of WEEKDAY_LABELS) {
      grid.createDiv({ cls: "frontmatter-kanban-date-picker-weekday", text: weekday });
    }
    const firstDay = this.viewDate.getDay();
    const daysInMonth = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth() + 1, 0).getDate();
    for (let index = 0; index < firstDay; index += 1) {
      grid.createDiv({ cls: "frontmatter-kanban-date-picker-empty" });
    }
    const today = /* @__PURE__ */ new Date();
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(this.viewDate.getFullYear(), this.viewDate.getMonth(), day, this.hour, this.minute);
      const button = grid.createEl("button", {
        type: "button",
        cls: "frontmatter-kanban-date-picker-day",
        text: String(day)
      });
      if (isSameDate(date, this.selectedDate)) button.addClass("is-selected");
      if (isSameDate(date, today)) button.addClass("is-today");
      button.addEventListener("click", () => {
        this.selectedDate = date;
        this.render();
      });
    }
    const occupiedCells = firstDay + daysInMonth;
    for (let index = occupiedCells; index < 42; index += 1) {
      grid.createDiv({ cls: "frontmatter-kanban-date-picker-empty" });
    }
    if (this.includeTime) {
      const time = pickerBlock.createDiv({ cls: "frontmatter-kanban-date-picker-time" });
      time.createSpan({ text: "Time" });
      const hour = time.createEl("select");
      for (let value = 0; value < 24; value += 1) {
        hour.createEl("option", { value: String(value), text: pad2(value) });
      }
      hour.value = String(this.hour);
      hour.addEventListener("change", () => {
        this.hour = Number(hour.value);
        if (this.selectedDate) this.selectedDate.setHours(this.hour);
      });
      time.createSpan({ text: ":" });
      const minute = time.createEl("select");
      for (let value = 0; value < 60; value += 1) {
        minute.createEl("option", { value: String(value), text: pad2(value) });
      }
      minute.value = String(this.minute);
      minute.addEventListener("change", () => {
        this.minute = Number(minute.value);
        if (this.selectedDate) this.selectedDate.setMinutes(this.minute);
      });
    }
    const footer = contentEl.createDiv({ cls: "frontmatter-kanban-date-picker-footer" });
    const clear = footer.createEl("button", { type: "button", text: "Clear" });
    clear.addEventListener("click", () => {
      this.onApply("");
      this.close();
    });
    const todayButton = footer.createEl("button", { type: "button", text: "Today" });
    todayButton.addEventListener("click", () => {
      const nextToday = /* @__PURE__ */ new Date();
      nextToday.setHours(this.hour, this.minute, 0, 0);
      this.selectedDate = nextToday;
      this.viewDate = new Date(nextToday.getFullYear(), nextToday.getMonth(), 1);
      this.render();
    });
    const cancel = footer.createEl("button", { type: "button", text: "Cancel" });
    cancel.addEventListener("click", () => this.close());
    const apply = footer.createEl("button", {
      type: "button",
      cls: "mod-cta",
      text: "Apply"
    });
    apply.addEventListener("click", () => {
      if (!this.selectedDate) {
        new import_obsidian.Notice("Select a date first.");
        return;
      }
      const selected = new Date(this.selectedDate);
      selected.setHours(this.hour, this.minute, 0, 0);
      this.onApply(this.includeTime ? selected.toISOString() : formatPickerDate(selected));
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ReferenceNoteSuggestModal = class extends import_obsidian.SuggestModal {
  constructor(app, plugin, kind, sourcePath, projectValue, onChoose) {
    super(app);
    this.plugin = plugin;
    this.kind = kind;
    this.sourcePath = sourcePath;
    this.projectValue = projectValue;
    this.onChoose = onChoose;
    this.limit = 50;
    this.emptyStateText = `No ${getReferenceLabel(kind)} notes found.`;
    this.setPlaceholder(`Search ${getReferenceLabel(kind)} notes`);
  }
  getSuggestions(query) {
    const normalizedQuery = query.trim().toLowerCase();
    return this.plugin.getReferenceFiles(this.kind, this.projectValue, this.sourcePath).filter((file) => {
      if (!normalizedQuery) return true;
      return file.basename.toLowerCase().includes(normalizedQuery) || file.path.toLowerCase().includes(normalizedQuery);
    });
  }
  renderSuggestion(file, el) {
    const title = el.createDiv({ cls: "frontmatter-kanban-suggestion-title" });
    title.createSpan({ cls: "frontmatter-kanban-suggestion-emoji", text: getReferenceEmoji(this.kind) });
    title.createSpan({ text: file.basename });
  }
  onChooseSuggestion(file) {
    this.onChoose(this.plugin.getNoteLink(file, this.sourcePath));
  }
};
function renderReferenceSetting(modal, container, label, key, sourcePath = "") {
  const setting = new import_obsidian.Setting(container).setName(label);
  if (key === "feature") {
    setting.setDesc("Requires a project. New feature notes are created under that project.");
  }
  const input = setting.controlEl.createEl("input", {
    type: "text",
    cls: "frontmatter-kanban-reference-input",
    placeholder: `${label} name`
  });
  input.value = getReferenceDisplayValue(modal.plugin, modal.values[key]);
  input.addEventListener("input", () => {
    modal.values[key] = input.value;
  });
  new import_obsidian.ButtonComponent(setting.controlEl).setButtonText(`Add ${label.toLowerCase()}`).setIcon("link").onClick(() => {
    if (key === "feature" && !String(modal.values.project || "").trim()) {
      new import_obsidian.Notice("Create or select a project before adding a feature.");
      return;
    }
    const files = modal.plugin.getReferenceFiles(key, modal.values.project, sourcePath);
    if (!files.length) {
      const folder = modal.plugin.getReferenceFolder(key, modal.values.project, sourcePath);
      new import_obsidian.Notice(folder ? `No Markdown notes found in ${folder}.` : "No Markdown notes found.");
      return;
    }
    new ReferenceNoteSuggestModal(modal.app, modal.plugin, key, sourcePath, modal.values.project, (link) => {
      modal.values[key] = link;
      input.value = getReferenceDisplayValue(modal.plugin, link);
    }).open();
  });
  new import_obsidian.ButtonComponent(setting.controlEl).setIcon("x").setTooltip("Clear").onClick(() => {
    modal.values[key] = "";
    input.value = "";
  });
}
var EditTaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, task) {
    var _a, _b;
    super(app);
    this.plugin = plugin;
    this.task = task;
    const fm = task.frontmatter;
    this.values = {
      title: getTaskTitle(task),
      status: fm.status || plugin.settings.statuses[0] || "backlog",
      project: fm.project || "",
      feature: fm.feature || "",
      priority: fm.priority || "",
      due: fm.due || "",
      work_start: fm.work_start || "",
      work_end: fm.work_end || "",
      notification_amount: (_a = fm.notification_amount) != null ? _a : "",
      notification_unit: fm.notification_unit || "days"
    };
    if (!PRIORITIES.includes(this.values.priority)) {
      this.values.priority = "medium";
    }
    for (const field of plugin.settings.customFields) {
      if (field.type === "date-range") {
        this.values[`${field.id}_start`] = fm[`${field.id}_start`] || "";
        this.values[`${field.id}_end`] = fm[`${field.id}_end`] || "";
      } else if (field.type === "checkbox") {
        const value = fm[field.id];
        if (value !== void 0) this.values[field.id] = value === true || value === "true";
      } else {
        this.values[field.id] = (_b = fm[field.id]) != null ? _b : "";
      }
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("frontmatter-kanban-modal");
    contentEl.createEl("h2", { text: "Edit task" });
    this.renderTaskInfo(contentEl);
    new import_obsidian.Setting(contentEl).setName("Title").addText((text) => text.setPlaceholder("Task title").setValue(this.values.title).onChange((value) => {
      this.values.title = value;
    }));
    new import_obsidian.Setting(contentEl).setName("Status").addDropdown((dropdown) => {
      for (const status of this.plugin.settings.statuses) {
        dropdown.addOption(status, status);
      }
      dropdown.setValue(this.values.status);
      dropdown.onChange((value) => {
        this.values.status = value;
      });
    });
    new import_obsidian.Setting(contentEl).setName("Priority").addDropdown((dropdown) => {
      for (const priority of PRIORITIES) {
        dropdown.addOption(priority, priority);
      }
      dropdown.setValue(this.values.priority);
      dropdown.onChange((value) => {
        this.values.priority = value;
      });
    });
    renderReferenceSetting(this, contentEl, "Project", "project", this.task.file.path);
    renderReferenceSetting(this, contentEl, "Feature", "feature", this.task.file.path);
    this.renderDateTimeSetting(contentEl, "Due date", "due");
    this.renderDateRangeSetting(contentEl, "Work on", "work_start", "work_end");
    this.renderNotificationSetting(contentEl);
    for (const field of this.plugin.settings.customFields) {
      this.renderCustomField(contentEl, field);
    }
    const footer = contentEl.createDiv({ cls: "frontmatter-kanban-modal-footer" });
    const deleteButton = new import_obsidian.ButtonComponent(footer).setButtonText("Delete").setIcon("trash-2").setClass("frontmatter-kanban-delete-button");
    markButtonDestructive(deleteButton).onClick(async () => {
      const deleted = await this.plugin.deleteTask(this.task.file);
      if (deleted) this.close();
    });
    new import_obsidian.ButtonComponent(footer).setButtonText("Cancel").onClick(() => this.close());
    new import_obsidian.ButtonComponent(footer).setButtonText("Open note").onClick(() => {
      this.close();
      this.plugin.openTaskFile(this.task.file);
    });
    new import_obsidian.ButtonComponent(footer).setButtonText("Save").setCta().onClick(async () => {
      if (!this.values.title.trim()) {
        new import_obsidian.Notice("Task title is required.");
        return;
      }
      const updated = await this.plugin.updateTask(this.task.file, this.values);
      if (updated) this.close();
    });
  }
  renderTaskInfo(container) {
    const info = container.createDiv({ cls: "frontmatter-kanban-task-info" });
    info.createDiv({ cls: "frontmatter-kanban-task-info-title", text: "Task information" });
    this.renderTaskInfoRow(info, "Created", formatTaskInfoDate(this.task.frontmatter.created || this.task.file.stat.ctime));
    this.renderTaskInfoRow(info, "Modified", formatTaskInfoDate(this.task.file.stat.mtime));
    this.renderTaskInfoRow(info, "File", this.task.file.path);
  }
  renderTaskInfoRow(container, label, value) {
    const row = container.createDiv({ cls: "frontmatter-kanban-task-info-row" });
    row.createSpan({ cls: "frontmatter-kanban-task-info-label", text: `${label}:` });
    row.createSpan({ cls: "frontmatter-kanban-task-info-value", text: value || "None" });
  }
  renderDateTimeSetting(container, label, key) {
    const setting = new import_obsidian.Setting(container).setName(label);
    setting.controlEl.addClass("frontmatter-kanban-date-picker-control");
    const button = setting.controlEl.createEl("button", {
      type: "button",
      cls: "frontmatter-kanban-date-picker-trigger",
      text: formatPickerDisplay(this.values[key], true)
    });
    button.addEventListener("click", () => {
      new DatePickerModal(this.app, {
        title: label,
        value: this.values[key],
        includeTime: true,
        onApply: (value) => {
          this.values[key] = value;
          button.textContent = formatPickerDisplay(value, true);
        }
      }).open();
    });
  }
  renderDateRangeSetting(container, label, startKey, endKey) {
    const setting = new import_obsidian.Setting(container).setName(label);
    setting.controlEl.addClass("frontmatter-kanban-date-range-control");
    const start = setting.controlEl.createEl("button", {
      type: "button",
      cls: "frontmatter-kanban-date-picker-trigger",
      text: formatPickerDisplay(this.values[startKey], false)
    });
    start.addEventListener("click", () => {
      new DatePickerModal(this.app, {
        title: `${label} start`,
        value: this.values[startKey],
        onApply: (value) => {
          this.values[startKey] = value;
          start.textContent = formatPickerDisplay(value, false);
        }
      }).open();
    });
    setting.controlEl.createSpan({ cls: "frontmatter-kanban-date-range-arrow", text: "->" });
    const end = setting.controlEl.createEl("button", {
      type: "button",
      cls: "frontmatter-kanban-date-picker-trigger",
      text: formatPickerDisplay(this.values[endKey], false)
    });
    end.addEventListener("click", () => {
      new DatePickerModal(this.app, {
        title: `${label} end`,
        value: this.values[endKey],
        onApply: (value) => {
          this.values[endKey] = value;
          end.textContent = formatPickerDisplay(value, false);
        }
      }).open();
    });
  }
  renderNotificationSetting(container) {
    const setting = new import_obsidian.Setting(container).setName("Notify before due");
    const amount = setting.controlEl.createEl("input", { type: "number" });
    amount.min = "0";
    amount.placeholder = "Amount";
    amount.value = this.values.notification_amount === void 0 ? "" : String(this.values.notification_amount);
    amount.addEventListener("change", () => {
      this.values.notification_amount = amount.value;
    });
    const unit = new import_obsidian.DropdownComponent(setting.controlEl);
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
    const setting = new import_obsidian.Setting(container).setName(field.name);
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
      setting.addToggle((toggle) => toggle.setValue(Boolean(this.values[field.id])).onChange((value) => {
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
      input.value = this.values[field.id] === void 0 ? "" : String(this.values[field.id]);
    }
    input.addEventListener("change", () => {
      this.values[field.id] = field.type === "datetime" ? readDateInputAsIso(input.value) : input.value;
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var CreateTaskModal = class extends import_obsidian.Modal {
  constructor(app, plugin, initialValues = {}) {
    super(app);
    this.plugin = plugin;
    this.values = Object.assign({
      title: "",
      status: plugin.settings.statuses[0] || "backlog",
      project: "",
      feature: "",
      notification_unit: "days"
    }, initialValues);
    for (const field of plugin.settings.customFields) {
      if (field.type === "date-range") {
        const range = parseDateRangeDefault(field.defaultValue);
        if (range.start && this.values[`${field.id}_start`] === void 0) this.values[`${field.id}_start`] = range.start;
        if (range.end && this.values[`${field.id}_end`] === void 0) this.values[`${field.id}_end`] = range.end;
        continue;
      }
      const defaultValue = getDefaultFieldValue(field);
      if (defaultValue !== void 0 && this.values[field.id] === void 0) {
        this.values[field.id] = defaultValue;
      }
    }
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("frontmatter-kanban-modal");
    contentEl.createEl("h2", { text: "Create task" });
    new import_obsidian.Setting(contentEl).setName("Title").addText((text) => text.setPlaceholder("Task title").onChange((value) => {
      this.values.title = value;
    }));
    if (this.plugin.settings.createFormFields.status) {
      new import_obsidian.Setting(contentEl).setName("Status").addDropdown((dropdown) => {
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
      new import_obsidian.Setting(contentEl).setName("Priority").addDropdown((dropdown) => {
        for (const priority of PRIORITIES) {
          dropdown.addOption(priority, priority);
        }
        dropdown.setValue(this.values.priority);
        dropdown.onChange((value) => {
          this.values.priority = value;
        });
      });
    }
    if (this.plugin.settings.createFormFields.project) {
      renderReferenceSetting(this, contentEl, "Project", "project");
    }
    if (this.plugin.settings.createFormFields.feature) {
      renderReferenceSetting(this, contentEl, "Feature", "feature");
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
    new import_obsidian.ButtonComponent(footer).setButtonText("Cancel").onClick(() => this.close());
    new import_obsidian.ButtonComponent(footer).setButtonText("Create").setCta().onClick(async () => {
      if (!this.values.title.trim()) {
        new import_obsidian.Notice("Task title is required.");
        return;
      }
      const created = await this.plugin.createTask(this.values);
      if (created) this.close();
    });
  }
  renderDateTimeSetting(container, label, key) {
    const setting = new import_obsidian.Setting(container).setName(label);
    setting.controlEl.addClass("frontmatter-kanban-date-picker-control");
    const button = setting.controlEl.createEl("button", {
      type: "button",
      cls: "frontmatter-kanban-date-picker-trigger",
      text: formatPickerDisplay(this.values[key], true)
    });
    button.addEventListener("click", () => {
      new DatePickerModal(this.app, {
        title: label,
        value: this.values[key],
        includeTime: true,
        onApply: (value) => {
          this.values[key] = value;
          button.textContent = formatPickerDisplay(value, true);
        }
      }).open();
    });
  }
  renderDateRangeSetting(container, label, startKey, endKey) {
    const setting = new import_obsidian.Setting(container).setName(label);
    setting.controlEl.addClass("frontmatter-kanban-date-range-control");
    const start = setting.controlEl.createEl("button", {
      type: "button",
      cls: "frontmatter-kanban-date-picker-trigger",
      text: formatPickerDisplay(this.values[startKey], false)
    });
    start.addEventListener("click", () => {
      new DatePickerModal(this.app, {
        title: `${label} start`,
        value: this.values[startKey],
        onApply: (value) => {
          this.values[startKey] = value;
          start.textContent = formatPickerDisplay(value, false);
        }
      }).open();
    });
    setting.controlEl.createSpan({ cls: "frontmatter-kanban-date-range-arrow", text: "->" });
    const end = setting.controlEl.createEl("button", {
      type: "button",
      cls: "frontmatter-kanban-date-picker-trigger",
      text: formatPickerDisplay(this.values[endKey], false)
    });
    end.addEventListener("click", () => {
      new DatePickerModal(this.app, {
        title: `${label} end`,
        value: this.values[endKey],
        onApply: (value) => {
          this.values[endKey] = value;
          end.textContent = formatPickerDisplay(value, false);
        }
      }).open();
    });
  }
  renderNotificationSetting(container) {
    const setting = new import_obsidian.Setting(container).setName("Notify before due");
    const amount = setting.controlEl.createEl("input", { type: "number" });
    amount.min = "0";
    amount.placeholder = "Amount";
    amount.addEventListener("change", () => {
      this.values.notification_amount = amount.value;
    });
    const unit = new import_obsidian.DropdownComponent(setting.controlEl);
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
    const setting = new import_obsidian.Setting(container).setName(field.name);
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
      setting.addToggle((toggle) => toggle.setValue(Boolean(this.values[field.id])).onChange((value) => {
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
      input.value = this.values[field.id] === void 0 ? "" : String(this.values[field.id]);
    }
    input.addEventListener("change", () => {
      this.values[field.id] = field.type === "datetime" ? readDateInputAsIso(input.value) : input.value;
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/bases/TaskCard.ts
var import_obsidian2 = require("obsidian");
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
function getCardSummary(task) {
  const fm = task.frontmatter;
  return String(fm.description || fm.summary || fm.notes || "").trim();
}
function openTaskMenu(host, event, task) {
  const menu = new import_obsidian2.Menu();
  menu.addItem((item) => item.setTitle("Edit task").setIcon("pencil").onClick(() => new EditTaskModal(host.plugin.app, host.plugin, task).open()));
  menu.addItem((item) => item.setTitle("Open note").setIcon("file-text").onClick(() => host.plugin.openTaskFile(task.file)));
  if (host.plugin.settings && Array.isArray(host.plugin.settings.statuses)) {
    menu.addSeparator();
    for (const status of host.plugin.settings.statuses) {
      const isCurrent = String(task.frontmatter.status || host.plugin.getDefaultStatus()).toLowerCase() === String(status).toLowerCase();
      menu.addItem((item) => item.setTitle(`Status: ${status}`).setIcon(isCurrent ? "check" : "circle").onClick(() => host.plugin.updateTaskStatus(task.file, status)));
    }
  }
  menu.addSeparator();
  menu.addItem((item) => item.setTitle("Delete task").setIcon("trash-2").setWarning(true).onClick(() => host.plugin.deleteTask(task.file)));
  menu.showAtMouseEvent(event);
}
function renderTaskCard(host, cards, task, options = {}) {
  const priority = String(task.frontmatter.priority || "").trim().toLowerCase();
  const priorityClass = priority ? `priority-${priority}` : "";
  const doneClass = isDoneStatus(task.frontmatter.status) ? "is-done" : "";
  const extraClass = options.extraClass || "";
  const card = cards.createDiv({ cls: `frontmatter-kanban-card ${priorityClass} ${doneClass} ${extraClass}`.trim() });
  if (options.accent) card.setCssProps({ "--kanban-column-accent": options.accent });
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
  } else if (workRange && !options.hideWorkBadge) {
    titleTags.createSpan({ cls: "frontmatter-kanban-card-work-tag", text: workRange });
  }
  if (options.compactDueInTitle && dueDateParts) {
    const titleLine = titleText.createDiv({ cls: "frontmatter-kanban-card-title-line" });
    titleLine.createDiv({ cls: "frontmatter-kanban-card-title", text: getTaskTitle(task) });
    const compactDue = titleLine.createSpan({ cls: `frontmatter-kanban-card-compact-due ${getDueClass(task)}` });
    (0, import_obsidian2.setIcon)(compactDue.createSpan({ cls: "frontmatter-kanban-card-compact-due-icon" }), "calendar");
    compactDue.createSpan({ text: dueDateParts.dayMonth });
  } else {
    titleText.createDiv({ cls: "frontmatter-kanban-card-title", text: getTaskTitle(task) });
  }
  const summary = options.hideSummary ? "" : getCardSummary(task);
  if (summary) {
    card.createDiv({ cls: "frontmatter-kanban-card-summary", text: summary });
  }
  if (!options.hideTodos) {
    renderTodoProgress(host, card, task);
  }
  const project = formatReferenceLabel(task.frontmatter.project);
  const feature = formatReferenceLabel(task.frontmatter.feature);
  const visibleProject = options.hideProjectDetail ? "" : project;
  const visibleFeature = options.hideFeatureDetail ? "" : feature;
  const visibleDueDateParts = options.hideDueDetail ? null : dueDateParts;
  if (!options.hideDetails && (visibleProject || visibleFeature || visibleDueDateParts)) {
    card.createDiv({ cls: "frontmatter-kanban-card-divider" });
    const details = card.createDiv({ cls: "frontmatter-kanban-card-details" });
    if (visibleProject || visibleFeature) {
      const stats = details.createDiv({ cls: "frontmatter-kanban-card-stats" });
      if (visibleProject) {
        const item = stats.createDiv({ cls: "frontmatter-kanban-card-stat is-project" });
        (0, import_obsidian2.setIcon)(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "rocket");
        const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Project" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-value", text: visibleProject });
      }
      if (visibleFeature) {
        const item = stats.createDiv({ cls: "frontmatter-kanban-card-stat is-feature" });
        (0, import_obsidian2.setIcon)(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "wrench");
        const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Feature" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-value", text: visibleFeature });
      }
    }
    if (visibleDueDateParts) {
      const item = details.createDiv({ cls: `frontmatter-kanban-card-stat is-due ${getDueClass(task)}` });
      (0, import_obsidian2.setIcon)(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "calendar");
      const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
      body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Due date" });
      const value = body.createSpan({ cls: "frontmatter-kanban-card-stat-value is-due-date" });
      value.createSpan({ cls: "frontmatter-kanban-card-due-year", text: visibleDueDateParts.year });
      value.createSpan({ cls: "frontmatter-kanban-card-due-day-month", text: visibleDueDateParts.dayMonth });
    }
  }
  if (task.frontmatter.completed && !options.hideCompletedFooter) {
    const footer = card.createDiv({ cls: "frontmatter-kanban-card-footer" });
    const completed = footer.createSpan({ cls: "frontmatter-kanban-card-date is-complete" });
    (0, import_obsidian2.setIcon)(completed.createSpan(), "check-circle-2");
    completed.createSpan({ text: formatDateLabel(task.frontmatter.completed) || formatDateTimeForInput(task.frontmatter.completed).replace("T", " ") });
  }
  return card;
}
function renderTodoProgress(host, card, task) {
  const todo = card.createDiv({ cls: "frontmatter-kanban-card-todos is-loading" });
  host.plugin.getTaskTodoStats(task.file).then((stats) => {
    if (!todo.isConnected) return;
    todo.empty();
    todo.removeClass("is-loading");
    if (!stats.total) {
      todo.detach();
      return;
    }
    const progress = todo.createDiv({ cls: "frontmatter-kanban-card-todo-progress" });
    const fill = progress.createDiv({ cls: "frontmatter-kanban-card-todo-progress-fill" });
    fill.setCssStyles({ width: `${Math.round(stats.completed / stats.total * 100)}%` });
    todo.createSpan({
      cls: "frontmatter-kanban-card-todo-count",
      text: `${stats.completed}/${stats.total}`
    });
  }).catch(() => {
    todo.detach();
  });
}

// src/bases/KanbanBasesView.ts
var COLUMN_ACCENTS = [
  "#829C92",
  "#8D7896",
  "#70899D",
  "#A68A5D"
];
var STATUS_ACCENTS = {
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
  if (value === void 0 || value === null) return "";
  if (value.constructor && value.constructor.name === "NullValue") return "";
  const text = String(value).trim();
  if (text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return "";
  return text;
}
function getEntryFile(entry) {
  return entry && entry.file instanceof import_obsidian3.TFile ? entry.file : null;
}
function getStatusAccent(status, fallback) {
  const normalized = String(status || "").trim().toLowerCase().replace(/[-_]+/g, " ");
  const compact = normalized.replace(/\s+/g, "");
  return STATUS_ACCENTS[normalized] || STATUS_ACCENTS[compact] || fallback;
}
var KanbanBasesView = class extends import_obsidian3.BasesView {
  constructor(controller, containerEl, plugin) {
    super(controller);
    this.type = BASES_KANBAN_VIEW_TYPE;
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
    const configured = this.config && typeof this.config.get === "function" ? Number(this.config.get("columnWidth")) : 380;
    if (!Number.isFinite(configured)) return 380;
    return Math.min(560, Math.max(280, configured));
  }
  getGroups() {
    const groupedData = this.data && Array.isArray(this.data.groupedData) ? this.data.groupedData : [];
    if (groupedData.length > 1 || groupedData[0] && groupedData[0].hasKey && groupedData[0].hasKey()) {
      return this.mergeConfiguredStatuses(groupedData.map((group) => ({
        status: this.normalizeStatus(valueToString(group.key)),
        entries: this.getTaskFolderEntries(group.entries || [])
      })));
    }
    const entries = this.getTaskFolderEntries(this.data && Array.isArray(this.data.data) ? this.data.data : []);
    const groupsByStatus = /* @__PURE__ */ new Map();
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
    const used = /* @__PURE__ */ new Set();
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
    return Object.assign({}, cache && cache.frontmatter || {});
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
    (0, import_obsidian3.setIcon)(newTaskButton.createSpan({ cls: "frontmatter-kanban-column-new-icon" }), "plus");
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
      if (file instanceof import_obsidian3.TFile) {
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
};
function buildKanbanBasesViewFactory(plugin) {
  return function(controller, containerEl) {
    return new KanbanBasesView(controller, containerEl, plugin);
  };
}

// src/bases/TimelineBasesView.ts
var import_obsidian4 = require("obsidian");
var DAY_MS = 24 * 60 * 60 * 1e3;
var PRIORITY_ACCENTS = {
  high: "#C98282",
  medium: "#C2A667",
  low: "#79A99F",
  none: "#70899D",
  done: "#777E8F"
};
var WEEKDAY_LABELS2 = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
var MONTH_LABELS2 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function getEntryFile2(entry) {
  return entry && entry.file instanceof import_obsidian4.TFile ? entry.file : null;
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
  return Math.ceil(((target.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}
function formatDisplayDate(date, includeYear = true) {
  const month = MONTH_LABELS2[date.getMonth()];
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
var TimelineBasesView = class extends import_obsidian4.BasesView {
  constructor(controller, containerEl, plugin) {
    super(controller);
    this.type = BASES_TIMELINE_VIEW_TYPE;
    this.controller = controller;
    this.containerEl = containerEl;
    this.plugin = plugin;
    this.cardClickTimer = null;
    this.suppressNextCardClick = false;
    this.periodMode = "week";
    this.anchorDate = /* @__PURE__ */ new Date();
    this.collapsedSidebarGroups = /* @__PURE__ */ new Set();
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
    return document.body.classList.contains("is-mobile") || document.body.classList.contains("is-phone") || window.matchMedia("(max-width: 720px)").matches;
  }
  shouldUseTimelineResizeHandles() {
    return !this.isMobileLayout();
  }
  openCreateTaskModal(initialValues = {}) {
    new CreateTaskModal(this.plugin.app, this.plugin, initialValues).open();
  }
  openCreateTaskMenu(event, date) {
    const dateText = formatDateOnly(date);
    const menu = new import_obsidian4.Menu();
    menu.addItem((item) => item.setTitle(`New task on ${dateText}`).setIcon("plus").onClick(() => this.openCreateTaskModal({
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
    const configured = this.config && typeof this.config.get === "function" ? Number(this.config.get("dayWidth")) : 150;
    if (!Number.isFinite(configured)) return 150;
    return Math.min(240, Math.max(104, configured));
  }
  getLaneHeight() {
    const configured = this.config && typeof this.config.get === "function" ? Number(this.config.get("laneHeight")) : 118;
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
    new import_obsidian4.ButtonComponent(nav).setIcon("chevron-left").setTooltip("Previous").onClick(() => {
      this.shiftPeriod(-1);
      this.render();
    });
    nav.createDiv({ cls: "frontmatter-timeline-period-label", text: this.formatPeriodLabel(period) });
    new import_obsidian4.ButtonComponent(nav).setIcon("chevron-right").setTooltip("Next").onClick(() => {
      this.shiftPeriod(1);
      this.render();
    });
    new import_obsidian4.ButtonComponent(toolbar).setButtonText("Today").setClass("frontmatter-timeline-today").onClick(() => {
      this.anchorDate = /* @__PURE__ */ new Date();
      this.render();
    });
    const weekendsButton = new import_obsidian4.ButtonComponent(toolbar).setButtonText(this.getHideWeekends() ? "Show weekends" : "Hide weekends").setTooltip("Toggle weekend columns").setClass("frontmatter-timeline-weekends-toggle").onClick(() => {
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
    (0, import_obsidian4.setIcon)(newTaskButton.createSpan({ cls: "frontmatter-timeline-new-icon" }), "plus");
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
    if (this.periodMode === "month") return `${MONTH_LABELS2[period.start.getMonth()]} ${period.start.getFullYear()}`;
    const sameYear = period.start.getFullYear() === period.end.getFullYear();
    const endLabel = formatDisplayDate(period.end, !sameYear);
    return `${formatDisplayDate(period.start)} - ${endLabel} (Week ${getIsoWeekNumber(period.start)})`;
  }
  getTasks() {
    const entries = this.getTaskFolderEntries(this.data && Array.isArray(this.data.data) ? this.data.data : []);
    return entries.map((entry) => this.entryToTask(entry)).filter(Boolean);
  }
  getTaskFolderEntries(entries) {
    return entries.filter((entry) => {
      const file = getEntryFile2(entry);
      return this.plugin.isKanbanTaskFile(file);
    });
  }
  getFrontmatter(file) {
    const cache = this.plugin.app.metadataCache.getFileCache(file);
    return Object.assign({}, cache && cache.frontmatter || {});
  }
  entryToTask(entry) {
    const file = getEntryFile2(entry);
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
    return tasks.map((task) => ({ task, range: this.getTaskRange(task) })).filter((item) => item.range);
  }
  getVisibleScheduledTasks(tasks, period) {
    return this.getScheduledTasks(tasks).filter((item) => item.range.start <= period.end && item.range.end >= period.start);
  }
  getTasksForDate(tasks, date) {
    return this.getScheduledTasks(tasks).filter((item) => item.range.start <= date && item.range.end >= date).map((item) => item.task);
  }
  renderWeekTimeline(shell, tasks, period) {
    const visibleDays = this.getVisibleDays(period.days);
    const scheduled = this.getVisibleScheduledTasks(tasks, period).filter((item) => visibleDays.some((date) => item.range.start <= date && item.range.end >= date));
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
      if (!(file instanceof import_obsidian4.TFile)) return;
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
      if (sameDate(date, /* @__PURE__ */ new Date())) header.addClass("is-today");
      if (date.getDay() === 0 || date.getDay() === 6) header.addClass("is-weekend");
      header.setCssStyles({
        gridColumn: String(index + 1),
        gridRow: "1"
      });
      header.createDiv({ cls: "frontmatter-timeline-day-number", text: `${date.getMonth() + 1}/${date.getDate()}` });
      header.createDiv({ cls: "frontmatter-timeline-weekday", text: WEEKDAY_LABELS2[date.getDay()] });
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
      onDragEnd: () => {
        var _a;
        return (_a = this.containerEl.querySelector(".frontmatter-timeline-grid")) == null ? void 0 : _a.removeClass("is-drag-over");
      }
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
        void this.plugin.updateTaskWorkRange(item.task.file, formatDateOnly(state.nextStart), formatDateOnly(state.nextEnd)).finally(() => {
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
    const labels = hideWeekends ? ["Mon", "Tue", "Wed", "Thu", "Fri"] : WEEKDAY_LABELS2;
    const isMobileLayout = this.isMobileLayout();
    if (isMobileLayout) {
      panel.addClass("is-mobile-month");
      calendar.addClass("is-mobile-month");
    }
    calendar.setCssStyles({
      gridTemplateColumns: isMobileLayout ? `repeat(${labels.length}, minmax(0, 1fr))` : `repeat(${labels.length}, minmax(120px, 1fr))`
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
      gridTemplateRows: isMobileLayout ? `28px repeat(${weeks.length}, minmax(58px, 1fr))` : `34px repeat(${weeks.length}, minmax(132px, 1fr))`
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
      if (!(file instanceof import_obsidian4.TFile)) return;
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
        if (sameDate(date, /* @__PURE__ */ new Date())) cell.addClass("is-today");
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
          if (!(file instanceof import_obsidian4.TFile)) return;
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
    const lanesByWeek = /* @__PURE__ */ new Map();
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
      marginTop: isMobileLayout ? `${20 + placement.lane * 17}px` : `${30 + placement.lane * 24}px`
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
      const range = this.getTaskRange(task) || { start: /* @__PURE__ */ new Date(), end: /* @__PURE__ */ new Date() };
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
        void this.plugin.updateTaskWorkRange(task.file, formatDateOnly(state.nextStart), formatDateOnly(state.nextEnd)).finally(() => {
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
    const extras = dayTasks.map((task) => String(task.frontmatter.status || this.plugin.getDefaultStatus()).trim()).filter((status) => status && !statuses.some((item) => item.toLowerCase() === status.toLowerCase()));
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
      const detailsButton = new import_obsidian4.ButtonComponent(header).setButtonText("Show details").setTooltip("Toggle detailed task cards").setClass("frontmatter-timeline-sidebar-details-toggle").onClick(() => {
        this.showSidebarDetails = !this.showSidebarDetails;
        this.render();
      });
      if (this.showSidebarDetails) {
        detailsButton.buttonEl.addClass("is-active");
      }
    }
    new import_obsidian4.ButtonComponent(header).setIcon(this.isSidebarCollapsed ? "panel-left-open" : "panel-right-close").setTooltip(this.isSidebarCollapsed ? "Show task list" : "Hide task list").setClass("frontmatter-timeline-sidebar-toggle").onClick(() => {
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
        const upButton = controls.createEl("button", { text: "\u2191" });
        upButton.setAttr("aria-label", `Move ${group.status} up`);
        const downButton = controls.createEl("button", { text: "\u2193" });
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
      onDragEnd: () => {
        var _a;
        return (_a = this.containerEl.querySelector(".frontmatter-timeline-grid")) == null ? void 0 : _a.removeClass("is-drag-over");
      }
    });
  }
  renderFullTaskCard(container, task, extraClass = "") {
    return renderTaskCard(this, container, task, {
      extraClass,
      accent: getPriorityAccent(task),
      hideCompletedFooter: true,
      onDragEnd: () => {
        var _a;
        return (_a = this.containerEl.querySelector(".frontmatter-timeline-grid")) == null ? void 0 : _a.removeClass("is-drag-over");
      }
    });
  }
  getStatusGroups(tasks) {
    const configured = [...this.plugin.settings.statuses];
    const extras = tasks.map((task) => String(task.frontmatter.status || this.plugin.getDefaultStatus()).trim()).filter((status) => status && !configured.some((item) => statusEquals(item, status)));
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
};
function buildTimelineBasesViewFactory(plugin) {
  return function(controller, containerEl) {
    return new TimelineBasesView(controller, containerEl, plugin);
  };
}

// src/bases/defaultKanbanBase.ts
function escapeBaseString(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function formatPriorityWeightFormula() {
  const entries = Object.entries(PRIORITY_WEIGHTS);
  return entries.reduceRight((expression, [priority, weight]) => `if(note.priority == "${priority}", ${weight}, ${expression})`, "0");
}
function generateDefaultKanbanBase(taskFolder = TASK_FOLDER) {
  const folder = escapeBaseString(taskFolder || TASK_FOLDER);
  return `filters:
  and:
    - note.tags.contains("${TASK_TAG}")
    - file.path.startsWith("${folder}/")
formulas:
  priorityWeight: ${formatPriorityWeightFormula()}
  isOverdue: note.due && date(note.due) < today() && note.status != "done"
  daysUntilDue: if(note.due, ((number(date(note.due)) - number(today())) / 86400000).floor(), null)
views:
  - type: ${BASES_KANBAN_VIEW_TYPE}
    name: Kanban Board
    groupBy:
      property: note.status
      direction: ASC
    order:
      - note.status
      - note.project
      - note.feature
      - note.priority
      - formula.priorityWeight
      - note.due
      - note.work_start
      - note.work_end
      - note.completed
      - file.name
    sort:
      - property: formula.priorityWeight
        direction: DESC
      - property: note.due
        direction: ASC
    options:
      columnWidth: 380
${generateTimelineBaseViewBlock()}
`;
}
function generateDefaultTimelineBase(taskFolder = TASK_FOLDER) {
  const folder = escapeBaseString(taskFolder || TASK_FOLDER);
  return `filters:
  and:
    - note.tags.contains("${TASK_TAG}")
    - file.path.startsWith("${folder}/")
formulas:
  priorityWeight: ${formatPriorityWeightFormula()}
  isOverdue: note.due && date(note.due) < today() && note.status != "done"
  daysUntilDue: if(note.due, ((number(date(note.due)) - number(today())) / 86400000).floor(), null)
views:
${generateTimelineBaseViewBlock()}
`;
}
function generateTimelineBaseViewBlock() {
  return `  - type: ${BASES_TIMELINE_VIEW_TYPE}
    name: Timeline
    order:
      - note.status
      - note.project
      - note.feature
      - note.priority
      - formula.priorityWeight
      - note.due
      - note.work_start
      - note.work_end
      - note.completed
      - file.name
    sort:
      - property: note.work_start
        direction: ASC
      - property: formula.priorityWeight
        direction: DESC
      - property: note.due
        direction: ASC
    options:
      dayWidth: 150
      laneHeight: 118
      hideWeekends: false
`;
}

// src/settings/KanbanSettingTab.ts
var import_obsidian5 = require("obsidian");

// src/utils/text.ts
function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
function sanitizeFileName(title) {
  return title.replace(/[\\/:*?"<>|#^[\]]/g, " ").replace(/\s+/g, " ").trim();
}
function normalizeFieldId(value) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
}

// src/settings/KanbanSettingTab.ts
var KanbanSettingTab = class extends import_obsidian5.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  refreshSettings() {
    if (typeof this.update === "function") {
      this.update();
      return;
    }
    this.renderSettings(this.containerEl);
  }
  getSettingDefinitions() {
    return [
      {
        name: "TaskManagement",
        desc: "Task form, statuses, and custom field settings",
        aliases: [
          "Task form",
          "Statuses",
          "Custom fields",
          "Kanban board"
        ],
        render: (setting) => {
          this.renderSettings(setting.settingEl);
        }
      }
    ];
  }
  renderSettings(containerEl) {
    containerEl.empty();
    containerEl.addClass("frontmatter-kanban-settings");
    new import_obsidian5.Setting(containerEl).setName("Task preferences").setHeading();
    this.renderCreateFormFields(containerEl);
    this.renderStatuses(containerEl);
    this.renderCustomFields(containerEl);
  }
  renderSection(container, title, desc = "") {
    const section = container.createEl("details", { cls: "frontmatter-kanban-settings-section" });
    section.open = true;
    const summary = section.createEl("summary");
    summary.createSpan({ cls: "frontmatter-kanban-settings-section-title", text: title });
    if (desc) {
      summary.createSpan({ cls: "frontmatter-kanban-settings-section-desc", text: ` ${desc}` });
    }
    return section;
  }
  renderStatuses(container) {
    const section = this.renderSection(container, "Statuses", "Columns shown on the Kanban board");
    const containerEl = section;
    const list = containerEl.createDiv({ cls: "frontmatter-kanban-settings-list" });
    for (const status of this.plugin.settings.statuses) {
      const row = list.createDiv({ cls: "frontmatter-kanban-settings-row frontmatter-kanban-status-row" });
      const input2 = new import_obsidian5.TextComponent(row).setValue(status);
      new import_obsidian5.ButtonComponent(row).setButtonText("Save").onClick(async () => {
        const renamed = await this.plugin.renameStatus(status, input2.getValue());
        if (renamed) this.refreshSettings();
      });
      new import_obsidian5.ButtonComponent(row).setButtonText("Remove").onClick(async () => {
        const removed = await this.plugin.removeStatus(status);
        if (removed) this.refreshSettings();
      });
    }
    const addRow = containerEl.createDiv({ cls: "frontmatter-kanban-settings-add-row" });
    const input = new import_obsidian5.TextComponent(addRow).setPlaceholder("New status");
    new import_obsidian5.ButtonComponent(addRow).setButtonText("Add status").onClick(async () => {
      const status = cleanStatus(input.getValue());
      if (!status) {
        new import_obsidian5.Notice("Status is required.");
        return;
      }
      if (this.plugin.settings.statuses.some((item) => statusEquals(item, status))) {
        new import_obsidian5.Notice("Status already exists.");
        return;
      }
      this.plugin.settings.statuses.push(status);
      await this.plugin.saveSettings();
      this.refreshSettings();
    });
  }
  renderCreateFormFields(container) {
    const section = this.renderSection(container, "Task form", "Fields shown when creating tasks");
    const options = [
      ["status", "Status"],
      ["priority", "Priority"],
      ["project", "Project"],
      ["feature", "Feature"],
      ["due", "Due date"],
      ["workOn", "Work on"],
      ["notification", "Notification"]
    ];
    for (const [key, label] of options) {
      new import_obsidian5.Setting(section).setName(label).addToggle((toggle) => toggle.setValue(Boolean(this.plugin.settings.createFormFields[key])).onChange(async (value) => {
        this.plugin.settings.createFormFields[key] = value;
        await this.plugin.saveSettings();
      }));
    }
  }
  renderCustomFields(container) {
    const section = this.renderSection(container, "Custom fields", "Additional frontmatter fields");
    const list = section.createDiv({ cls: "frontmatter-kanban-settings-list" });
    for (const field of this.plugin.settings.customFields) {
      this.renderCustomFieldRow(list, field);
    }
    new import_obsidian5.Setting(section).setName("Add field").setHeading();
    const add = section.createDiv({ cls: "frontmatter-kanban-custom-field-editor" });
    const name = new import_obsidian5.TextComponent(add).setPlaceholder("Name");
    const type = new import_obsidian5.DropdownComponent(add);
    for (const fieldType of FIELD_TYPES) {
      type.addOption(fieldType, fieldType);
    }
    const options = new import_obsidian5.TextComponent(add).setPlaceholder("Select options, comma separated");
    const defaultValue = new import_obsidian5.TextComponent(add).setPlaceholder("Default value");
    const showInCreate = add.createEl("label", { cls: "frontmatter-kanban-inline-toggle" });
    const showInCreateInput = showInCreate.createEl("input", { type: "checkbox" });
    showInCreate.createSpan({ text: "Show in create form" });
    new import_obsidian5.ButtonComponent(add).setButtonText("Add field").onClick(async () => {
      const fieldName = name.getValue().trim();
      const id = normalizeFieldId(fieldName);
      if (!fieldName || !id) {
        new import_obsidian5.Notice("Field name is required.");
        return;
      }
      const existingIds = new Set(getAllFieldDefinitions(this.plugin).map((field) => field.id));
      if (existingIds.has(id)) {
        new import_obsidian5.Notice("Field already exists.");
        return;
      }
      this.plugin.settings.customFields.push({
        id,
        name: fieldName,
        type: type.getValue(),
        options: options.getValue(),
        defaultValue: defaultValue.getValue(),
        showInCreate: showInCreateInput.checked
      });
      await this.plugin.saveSettings();
      this.refreshSettings();
    });
  }
  renderCustomFieldRow(container, field) {
    const row = container.createDiv({ cls: "frontmatter-kanban-custom-field-row" });
    const name = new import_obsidian5.TextComponent(row).setValue(field.name);
    const type = new import_obsidian5.DropdownComponent(row);
    for (const fieldType of FIELD_TYPES) {
      type.addOption(fieldType, fieldType);
    }
    type.setValue(field.type);
    const options = new import_obsidian5.TextComponent(row).setPlaceholder("Select options").setValue(field.options || "");
    const defaultValue = new import_obsidian5.TextComponent(row).setPlaceholder("Default value").setValue(field.defaultValue || "");
    const showInCreate = row.createEl("label", { cls: "frontmatter-kanban-inline-toggle" });
    const showInCreateInput = showInCreate.createEl("input", { type: "checkbox" });
    showInCreateInput.checked = Boolean(field.showInCreate);
    showInCreate.createSpan({ text: "Create form" });
    new import_obsidian5.ButtonComponent(row).setButtonText("Save").onClick(async () => {
      const nextName = name.getValue().trim();
      if (!nextName) {
        new import_obsidian5.Notice("Field name is required.");
        return;
      }
      field.name = nextName;
      field.type = type.getValue();
      field.options = options.getValue();
      field.defaultValue = defaultValue.getValue();
      field.showInCreate = showInCreateInput.checked;
      await this.plugin.saveSettings();
      this.refreshSettings();
    });
    new import_obsidian5.ButtonComponent(row).setButtonText("Remove").onClick(async () => {
      this.plugin.settings.customFields = this.plugin.settings.customFields.filter((item) => item.id !== field.id);
      await this.plugin.saveSettings();
      this.refreshSettings();
    });
  }
};

// src/utils/tags.ts
function normalizeTag(tag) {
  return String(tag || "").trim().replace(/^#/, "");
}
function getFrontmatterTags(frontmatter) {
  const tags = frontmatter && frontmatter.tags;
  if (Array.isArray(tags)) {
    return tags.map(normalizeTag).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
  }
  return [];
}
function hasFrontmatterTag(frontmatter, tag) {
  const expected = normalizeTag(tag).toLowerCase();
  return getFrontmatterTags(frontmatter).some((item) => {
    const normalized = normalizeTag(item).toLowerCase();
    return normalized === expected || normalized.startsWith(`${expected}/`);
  });
}
function ensureFrontmatterTag(frontmatter, tag) {
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag || hasFrontmatterTag(frontmatter, normalizedTag)) return;
  const tags = frontmatter.tags;
  if (Array.isArray(tags)) {
    const nextTags = tags;
    nextTags.push(normalizedTag);
    frontmatter.tags = nextTags;
    return;
  }
  if (typeof tags === "string" && tags.trim()) {
    frontmatter.tags = `${tags.trim()} ${normalizedTag}`;
    return;
  }
  frontmatter.tags = [normalizedTag];
}

// src/plugin.ts
function markButtonDestructive2(button) {
  if (typeof button.setDestructive === "function") {
    return button.setDestructive();
  }
  if (typeof button.setWarning === "function") {
    return button.setWarning();
  }
  return button;
}
function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
var RELATED_TASKS_CODE_BLOCK = "taskmanagement-related-tasks";
var ConfirmDeleteTaskModal = class extends import_obsidian6.Modal {
  constructor(app, taskName) {
    super(app);
    this.taskName = taskName;
    this.resolve = () => {
    };
  }
  openAndAwait() {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.open();
    });
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    new import_obsidian6.Setting(contentEl).setName("Delete task?").setDesc(`Move "${this.taskName}" to trash.`).setHeading();
    const footer = contentEl.createDiv({ cls: "frontmatter-kanban-modal-footer" });
    new import_obsidian6.ButtonComponent(footer).setButtonText("Cancel").onClick(() => {
      this.resolve(false);
      this.close();
    });
    const deleteButton = new import_obsidian6.ButtonComponent(footer).setButtonText("Delete");
    markButtonDestructive2(deleteButton).setCta().onClick(() => {
      this.resolve(true);
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var RelatedTasksRenderChild = class extends import_obsidian6.MarkdownRenderChild {
  constructor(containerEl, plugin, referenceFile, kind) {
    super(containerEl);
    this.plugin = plugin;
    this.referenceFile = referenceFile;
    this.kind = kind;
  }
  onload() {
    void this.render();
  }
  async render() {
    const tasks = await this.plugin.getTasksForReferenceFile(this.referenceFile, this.kind);
    if (!this.containerEl.isConnected) return;
    this.containerEl.empty();
    const header = this.containerEl.createDiv({ cls: "frontmatter-kanban-related-tasks-header" });
    header.createDiv({ cls: "frontmatter-kanban-related-tasks-title", text: "Related tasks" });
    header.createDiv({ cls: "frontmatter-kanban-related-tasks-count", text: String(tasks.length) });
    if (!tasks.length) {
      this.containerEl.createDiv({ cls: "frontmatter-kanban-related-tasks-empty", text: "No related tasks" });
      return;
    }
    const list = this.containerEl.createDiv({ cls: "frontmatter-kanban-related-tasks-list" });
    for (const task of tasks) {
      this.renderTaskRow(list, task);
    }
  }
  renderTaskRow(list, task) {
    const row = list.createEl("button", { cls: "frontmatter-kanban-related-task", type: "button" });
    if (isDoneStatus(task.frontmatter.status)) row.addClass("is-done");
    row.createSpan({
      cls: "frontmatter-kanban-related-task-status",
      text: String(task.frontmatter.status || this.plugin.getDefaultStatus())
    });
    row.createSpan({ cls: "frontmatter-kanban-related-task-title", text: getTaskTitle(task) });
    const meta = [];
    const workOn = getWorkOnText(task.frontmatter);
    if (workOn) meta.push(workOn);
    const due = formatDateForInput(task.frontmatter.due);
    if (due) meta.push(`Due ${due}`);
    if (meta.length) row.createSpan({ cls: "frontmatter-kanban-related-task-meta", text: meta.join(" | ") });
    this.registerDomEvent(row, "click", () => {
      new EditTaskModal(this.plugin.app, this.plugin, task).open();
    });
    this.registerDomEvent(row, "contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openTaskMenu(this, event, task);
    });
  }
};
var FrontmatterKanbanPlugin = class extends import_obsidian6.Plugin {
  async onload() {
    await this.loadSettings();
    this.basesIntegrationRegistered = false;
    this.basesIntegrationRetryTimer = null;
    this.ensureBasesIntegration();
    this.addRibbonIcon("kanban", "Open Kanban Board", () => {
      void this.activateView();
    });
    this.addCommand({
      id: "open-taskmanagement-kanban-board",
      name: "Open Kanban board",
      callback: () => {
        void this.activateView();
      }
    });
    this.addCommand({
      id: "open-taskmanagement-timeline",
      name: "Open Timeline",
      callback: () => {
        void this.activateTimelineView();
      }
    });
    this.addCommand({
      id: "create-frontmatter-kanban-task",
      name: "Create Kanban task",
      callback: () => new CreateTaskModal(this.app, this).open()
    });
    this.addSettingTab(new KanbanSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, info) => {
        this.addRelatedTasksInsertMenuItem(menu, info);
      })
    );
    this.registerMarkdownCodeBlockProcessor(RELATED_TASKS_CODE_BLOCK, (source, el, ctx) => {
      this.renderRelatedTasksBlock(el, ctx);
    });
    this.registerMarkdownPostProcessor((el, ctx) => {
      void this.renderRelatedTasksPostProcessor(el, ctx);
    }, 1e3);
    this.derivedFieldSyncRunning = /* @__PURE__ */ new Set();
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        this.scheduleRefreshViews();
        this.syncDerivedFieldsForFile(file).catch((error) => console.error("Failed to sync task fields", error));
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.refreshViews())
    );
    this.registerInterval(window.setInterval(() => {
      void this.checkNotifications();
    }, 60 * 1e3));
    await this.ensureStorageFolders();
    await this.ensureKanbanBaseFile();
    await this.ensureTimelineBaseFile();
    await this.migrateLegacyTaskTags();
    this.app.workspace.onLayoutReady(() => {
      this.ensureBasesIntegration();
      this.scheduleRefreshViews(500);
    });
    void this.syncDerivedFields();
    void this.checkNotifications();
  }
  async loadSettings() {
    const savedSettings = await this.loadData() || {};
    this.settings = Object.assign({}, clone(DEFAULT_SETTINGS), savedSettings);
    const statusSource = Array.isArray(savedSettings.statuses) ? savedSettings.statuses : DEFAULT_SETTINGS.statuses;
    this.settings.statuses = dedupeStatuses(statusSource);
    if (!this.settings.statuses.length) {
      this.settings.statuses = ["backlog"];
    }
    this.settings.customFields = (this.settings.customFields || []).map((field) => {
      var _a;
      return {
        id: normalizeFieldId(field.id || field.name || ""),
        name: field.name || field.id || "",
        type: FIELD_TYPES.includes(field.type) ? field.type : "text",
        options: field.options || "",
        defaultValue: (_a = field.defaultValue) != null ? _a : "",
        showInCreate: Boolean(field.showInCreate)
      };
    }).filter((field) => field.id && field.name);
    this.settings.createFormFields = Object.assign(
      {},
      clone(DEFAULT_SETTINGS.createFormFields),
      this.settings.createFormFields || {}
    );
    this.settings.taskFolder = TASK_FOLDER;
    this.settings.baseFilePath = DEFAULT_KANBAN_BASE_FILE;
    this.settings.projectFolder = PROJECT_FOLDER;
    delete this.settings.featureFolder;
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.scheduleRefreshViews();
  }
  async activateView() {
    const file = await this.ensureKanbanBaseFile();
    await this.ensureBasesIntegrationBeforeOpen();
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    await this.app.workspace.revealLeaf(leaf);
  }
  async activateTimelineView() {
    const file = await this.ensureTimelineBaseFile();
    await this.ensureBasesIntegrationBeforeOpen();
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    await this.app.workspace.revealLeaf(leaf);
  }
  async openTaskFile(file) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, { active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
  async ensureBasesIntegrationBeforeOpen() {
    if (this.basesIntegrationRegistered) return;
    await this.waitForBasesIntegration({ notify: true });
  }
  async waitForBasesIntegration({ attempts = 12, delayMs = 250, notify = false } = {}) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const shouldNotify = notify && attempt === attempts - 1;
      if (this.registerBasesIntegration({ notify: shouldNotify })) {
        this.scheduleRefreshViews(250);
        return true;
      }
      await wait(delayMs);
    }
    return false;
  }
  ensureBasesIntegration({ retryCount = 0, maxRetries = 30, delayMs = 1e3, notify = false } = {}) {
    if (this.basesIntegrationRegistered) return true;
    const registered = this.registerBasesIntegration({ notify });
    if (registered) {
      this.clearBasesIntegrationRetryTimer();
      this.scheduleRefreshViews(250);
      return true;
    }
    if (retryCount >= maxRetries) {
      if (notify) this.registerBasesIntegration({ notify: true });
      return false;
    }
    this.clearBasesIntegrationRetryTimer();
    this.basesIntegrationRetryTimer = window.setTimeout(() => {
      this.basesIntegrationRetryTimer = null;
      this.ensureBasesIntegration({
        retryCount: retryCount + 1,
        maxRetries,
        delayMs,
        notify
      });
    }, delayMs);
    this.registerInterval(this.basesIntegrationRetryTimer);
    return false;
  }
  clearBasesIntegrationRetryTimer() {
    if (!this.basesIntegrationRetryTimer) return;
    window.clearTimeout(this.basesIntegrationRetryTimer);
    this.basesIntegrationRetryTimer = null;
  }
  registerBasesIntegration({ notify = false } = {}) {
    if (this.basesIntegrationRegistered) return true;
    if (typeof this.registerBasesView !== "function") {
      if (notify) {
        new import_obsidian6.Notice("Obsidian Bases API is not available. Please update Obsidian and enable the Bases core plugin.");
      }
      return false;
    }
    try {
      const kanbanRegistered = this.registerBasesView(BASES_KANBAN_VIEW_TYPE, {
        name: "Kanban Board",
        icon: "kanban",
        factory: buildKanbanBasesViewFactory(this),
        options: () => [
          {
            type: "slider",
            key: "columnWidth",
            displayName: "Column width",
            default: 380,
            min: 280,
            max: 560,
            step: 20
          }
        ]
      });
      if (kanbanRegistered === false) {
        if (notify) {
          new import_obsidian6.Notice("Enable the Bases core plugin to use TaskManagement views.");
        }
        return false;
      }
      const timelineRegistered = this.registerBasesView(BASES_TIMELINE_VIEW_TYPE, {
        name: "Timeline",
        icon: "calendar-days",
        factory: buildTimelineBasesViewFactory(this),
        options: () => [
          {
            type: "slider",
            key: "dayWidth",
            displayName: "Day width",
            default: 170,
            min: 120,
            max: 260,
            step: 10
          },
          {
            type: "slider",
            key: "laneHeight",
            displayName: "Lane height",
            default: 118,
            min: 84,
            max: 180,
            step: 8
          },
          {
            type: "toggle",
            key: "hideWeekends",
            displayName: "Hide weekends",
            default: false
          }
        ]
      });
      if (timelineRegistered === false) {
        if (notify) {
          new import_obsidian6.Notice("Enable the Bases core plugin to use TaskManagement views.");
        }
        return false;
      }
    } catch (error) {
      console.error("Failed to register TaskManagement Bases views", error);
      return false;
    }
    this.basesIntegrationRegistered = true;
    return true;
  }
  getKanbanBasePath() {
    return DEFAULT_KANBAN_BASE_FILE;
  }
  getTimelineBasePath() {
    return DEFAULT_TIMELINE_BASE_FILE;
  }
  async ensureKanbanBaseFile() {
    const path = this.getKanbanBasePath();
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian6.TFile) {
      await this.migrateBaseFile(existing);
      return existing;
    }
    const folder = path.split("/").slice(0, -1).join("/");
    await this.ensureFolder(folder);
    return this.createMarkdownFile(path, generateDefaultKanbanBase(this.getTaskFolder()));
  }
  async ensureTimelineBaseFile() {
    const path = this.getTimelineBasePath();
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian6.TFile) {
      await this.migrateBaseFile(existing);
      return existing;
    }
    const folder = path.split("/").slice(0, -1).join("/");
    await this.ensureFolder(folder);
    return this.createMarkdownFile(path, generateDefaultTimelineBase(this.getTaskFolder()));
  }
  async ensureStorageFolders() {
    await this.ensureFolder(ROOT_FOLDER);
    await this.ensureFolder(TASK_FOLDER);
    await this.ensureFolder(VIEWS_FOLDER);
    await this.ensureFolder(PROJECT_FOLDER);
    await this.ensureFolder(FEATURE_FOLDER);
  }
  async migrateBaseFile(file) {
    const contents = await this.app.vault.cachedRead(file);
    let nextContents = contents;
    nextContents = nextContents.replace(/\btype:\s+frontmatterKanban\b/g, `type: ${BASES_KANBAN_VIEW_TYPE}`);
    nextContents = nextContents.replace(/\btype:\s+frontmatterTimeline\b/g, `type: ${BASES_TIMELINE_VIEW_TYPE}`);
    if (nextContents.includes("kanban_task")) {
      nextContents = nextContents.replace(
        /filters:\r?\n {2}or:\r?\n {4}- note\["kanban_task"\] == true\r?\n {4}- note\.status && note\.status != ""/,
        `filters:
  and:
    - note.tags.contains("${TASK_TAG}")`
      );
    }
    nextContents = nextContents.replace(
      new RegExp(`file\\.hasTag\\("${LEGACY_TASK_TAG}"\\)`, "g"),
      `note.tags.contains("${TASK_TAG}")`
    );
    nextContents = nextContents.replace(
      new RegExp(`file\\.hasTag\\("${TASK_TAG}"\\)`, "g"),
      `note.tags.contains("${TASK_TAG}")`
    );
    nextContents = nextContents.replace(
      new RegExp(`note\\.tags\\.contains\\("${LEGACY_TASK_TAG}"\\)`, "g"),
      `note.tags.contains("${TASK_TAG}")`
    );
    const taskFolderFilter = `    - file.path.startsWith("${this.escapeBaseString(this.getTaskFolder())}/")`;
    if (nextContents.includes(`note.tags.contains("${TASK_TAG}")`) && !nextContents.includes("file.path.startsWith(") && !nextContents.includes("file.folder")) {
      nextContents = nextContents.replace(
        new RegExp(`(\\s+- note\\.tags\\.contains\\("${TASK_TAG}"\\))`),
        `$1
${taskFolderFilter}`
      );
    }
    if (!nextContents.includes(`type: ${BASES_TIMELINE_VIEW_TYPE}`)) {
      if (nextContents.includes("views:")) {
        nextContents = `${nextContents.trimEnd()}
${generateTimelineBaseViewBlock()}`;
      } else {
        nextContents = `${nextContents.trimEnd()}
views:
${generateTimelineBaseViewBlock()}`;
      }
    } else if (!nextContents.includes("hideWeekends:")) {
      nextContents = nextContents.replace(/(\n\s+laneHeight:\s+\d+)/, "$1\n      hideWeekends: false");
    }
    if (nextContents === contents) return;
    await this.app.vault.modify(file, nextContents);
  }
  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType("bases")) {
      if (leaf.view && leaf.view.refresh) {
        leaf.view.refresh();
      }
    }
  }
  scheduleRefreshViews(delay = 100) {
    if (this.refreshViewsTimer) window.clearTimeout(this.refreshViewsTimer);
    this.refreshViewsTimer = window.setTimeout(() => {
      this.refreshViewsTimer = null;
      this.refreshViews();
    }, delay);
  }
  async renderRelatedTasksPostProcessor(el, ctx) {
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof import_obsidian6.TFile)) return;
    const kind = this.getReferenceFileKind(file);
    if (!kind) return;
    const contents = await this.app.vault.cachedRead(file);
    if (this.hasRelatedTasksBlock(contents)) return;
    const section = ctx.getSectionInfo(el);
    if (section) {
      const lines = contents.split(/\r?\n/);
      let lastContentLine = Math.max(0, lines.length - 1);
      while (lastContentLine > 0 && !lines[lastContentLine].trim()) {
        lastContentLine -= 1;
      }
      if (section.lineEnd < lastContentLine) return;
    }
    const parent = el.parentElement;
    if (parent) {
      parent.querySelectorAll(".frontmatter-kanban-related-tasks").forEach((existing) => existing.detach());
    }
    const container = el.createDiv({ cls: "frontmatter-kanban-related-tasks" });
    ctx.addChild(new RelatedTasksRenderChild(container, this, file, kind));
  }
  renderRelatedTasksBlock(el, ctx) {
    const file = this.app.vault.getAbstractFileByPath(ctx.sourcePath);
    if (!(file instanceof import_obsidian6.TFile)) return;
    const kind = this.getReferenceFileKind(file);
    if (!kind) return;
    el.empty();
    el.addClass("frontmatter-kanban-related-tasks");
    ctx.addChild(new RelatedTasksRenderChild(el, this, file, kind));
  }
  addRelatedTasksInsertMenuItem(menu, info) {
    const file = info && info.file instanceof import_obsidian6.TFile ? info.file : this.app.workspace.getActiveFile();
    if (!file || !this.getReferenceFileKind(file)) return;
    menu.addItem((item) => item.setTitle("Insert related tasks block").setIcon("list-plus").onClick(() => {
      void this.insertRelatedTasksBlock(file);
    }));
  }
  hasRelatedTasksBlock(contents) {
    return new RegExp(`^\`\`\`+\\s*${RELATED_TASKS_CODE_BLOCK}\\b`, "m").test(String(contents || ""));
  }
  getRelatedTasksBlockMarkdown() {
    return `

\`\`\`${RELATED_TASKS_CODE_BLOCK}
\`\`\`
`;
  }
  getReferenceNoteContents(name) {
    return `# ${name}
${this.getRelatedTasksBlockMarkdown()}`;
  }
  getReferenceKindForFolder(folder) {
    const normalizedFolder = (0, import_obsidian6.normalizePath)(folder);
    if (normalizedFolder === this.getProjectFolder()) return "project";
    if (normalizedFolder.startsWith(`${FEATURE_FOLDER}/`)) return "feature";
    return "";
  }
  async insertRelatedTasksBlock(file) {
    if (!(file instanceof import_obsidian6.TFile) || !this.getReferenceFileKind(file)) return false;
    const contents = await this.app.vault.cachedRead(file);
    if (this.hasRelatedTasksBlock(contents)) {
      new import_obsidian6.Notice("Related tasks block already exists.");
      return true;
    }
    await this.app.vault.modify(file, `${contents.trimEnd()}${this.getRelatedTasksBlockMarkdown()}`);
    new import_obsidian6.Notice("Related tasks block inserted.");
    return true;
  }
  getTaskFolder() {
    return TASK_FOLDER;
  }
  isPathInTaskFolder(path) {
    const folder = this.getTaskFolder();
    return Boolean(folder && (path === folder || path.startsWith(`${folder}/`)));
  }
  isFileInTaskFolder(file) {
    return Boolean(file && this.isPathInTaskFolder(file.path));
  }
  isKanbanTaskFile(file) {
    if (!(file instanceof import_obsidian6.TFile) || file.extension !== "md" || !this.isFileInTaskFolder(file)) {
      return false;
    }
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache && cache.frontmatter;
    return this.isTaskFrontmatter(frontmatter);
  }
  escapeBaseString(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
  getCandidateTaskFiles() {
    return this.app.vault.getMarkdownFiles().filter((file) => this.isFileInTaskFolder(file));
  }
  isLegacyTaskFrontmatter(frontmatter) {
    if (!frontmatter) return false;
    if (frontmatter.kanban_task === true || frontmatter.kanban_task === "true") return true;
    return !hasFrontmatterTag(frontmatter, TASK_TAG) && hasFrontmatterTag(frontmatter, LEGACY_TASK_TAG);
  }
  isTaskFrontmatter(frontmatter) {
    return Boolean(frontmatter && (hasFrontmatterTag(frontmatter, TASK_TAG) || this.isLegacyTaskFrontmatter(frontmatter)));
  }
  getTaskFiles() {
    return this.getCandidateTaskFiles().filter((file) => this.isKanbanTaskFile(file));
  }
  getReferenceFileKind(file) {
    if (!(file instanceof import_obsidian6.TFile) || file.extension !== "md") return "";
    if (file.path.startsWith(`${FEATURE_FOLDER}/`)) return "feature";
    if (file.path.startsWith(`${this.getProjectFolder()}/`) && !file.path.includes("/Features/")) return "project";
    return "";
  }
  getProjectFileForFeatureFile(file) {
    if (!(file instanceof import_obsidian6.TFile) || !file.path.startsWith(`${FEATURE_FOLDER}/`)) return null;
    const relativePath = file.path.slice(`${FEATURE_FOLDER}/`.length);
    const projectName = relativePath.split("/")[0];
    return projectName ? this.findProjectFile(projectName, file.path) : null;
  }
  referenceValueMatchesFile(value, file, sourcePath = "") {
    if (!(file instanceof import_obsidian6.TFile) || !String(value || "").trim()) return false;
    const linked = this.findLinkedFile(value, sourcePath);
    if (linked instanceof import_obsidian6.TFile && linked.path === file.path) return true;
    const target = (0, import_obsidian6.normalizePath)(this.getReferenceInputTarget(value).replace(/\.md$/i, ""));
    if (!target) return false;
    const filePath = (0, import_obsidian6.normalizePath)(file.path.replace(/\.md$/i, ""));
    if (target === filePath) return true;
    return target.split("/").pop().toLowerCase() === file.basename.toLowerCase();
  }
  async getTasksForReferenceFile(referenceFile, kind) {
    const tasks = await this.getTasks();
    const relatedTasks = tasks.filter((task) => this.taskReferencesFile(task, referenceFile, kind));
    return relatedTasks.sort((left, right) => {
      const leftDone = isDoneStatus(left.frontmatter.status) ? 1 : 0;
      const rightDone = isDoneStatus(right.frontmatter.status) ? 1 : 0;
      if (leftDone !== rightDone) return leftDone - rightDone;
      const leftDate = formatDateForInput(left.frontmatter.work_start || left.frontmatter.due);
      const rightDate = formatDateForInput(right.frontmatter.work_start || right.frontmatter.due);
      if (leftDate || rightDate) return (leftDate || "9999-99-99").localeCompare(rightDate || "9999-99-99");
      return getTaskTitle(left).localeCompare(getTaskTitle(right));
    });
  }
  taskReferencesFile(task, referenceFile, kind) {
    if (kind === "feature") {
      if (!this.referenceValueMatchesFile(task.frontmatter.feature, referenceFile, task.file.path)) return false;
      const projectFile = this.getProjectFileForFeatureFile(referenceFile);
      return !projectFile || !String(task.frontmatter.project || "").trim() || this.referenceValueMatchesFile(task.frontmatter.project, projectFile, task.file.path);
    }
    return this.referenceValueMatchesFile(task.frontmatter.project, referenceFile, task.file.path);
  }
  async getTasks() {
    const files = this.getTaskFiles();
    return files.map((file) => {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = Object.assign({}, cache && cache.frontmatter || {});
      delete frontmatter.position;
      return { file, frontmatter, pluginSettings: this.settings };
    });
  }
  async createTask(values) {
    const folder = this.getTaskFolder();
    await this.ensureFolder(folder);
    const taskTitle = String(values.title || "").trim();
    if (!taskTitle) {
      new import_obsidian6.Notice("Task title is required.");
      return;
    }
    const path = this.getNewTaskPath(folder, taskTitle);
    const preparedValues = await this.prepareTaskReferences(values, path);
    if (!preparedValues) return false;
    const frontmatter = {
      tags: [TASK_TAG],
      title: preparedValues.title.trim(),
      status: this.normalizeTaskStatus(preparedValues.status),
      created: nowIso()
    };
    if (preparedValues.project) frontmatter.project = preparedValues.project;
    if (preparedValues.feature) frontmatter.feature = preparedValues.feature;
    if (preparedValues.priority) {
      frontmatter.priority = preparedValues.priority;
      frontmatter.priority_weight = getPriorityWeight(preparedValues.priority);
    }
    if (preparedValues.due) frontmatter.due = preparedValues.due;
    if (preparedValues.work_start) frontmatter.work_start = preparedValues.work_start;
    if (preparedValues.work_end) frontmatter.work_end = preparedValues.work_end;
    if (preparedValues.notification_amount !== void 0 && preparedValues.notification_amount !== "") {
      frontmatter.notification_amount = Number(preparedValues.notification_amount);
      frontmatter.notification_unit = preparedValues.notification_unit || "days";
    }
    if (isDoneStatus(frontmatter.status)) {
      frontmatter.completed = nowIso();
    }
    for (const field of this.settings.customFields) {
      if (field.type === "date-range") {
        if (preparedValues[`${field.id}_start`]) frontmatter[`${field.id}_start`] = preparedValues[`${field.id}_start`];
        if (preparedValues[`${field.id}_end`]) frontmatter[`${field.id}_end`] = preparedValues[`${field.id}_end`];
      } else if (field.type === "checkbox" && preparedValues[field.id] !== void 0 && preparedValues[field.id] !== "") {
        frontmatter[field.id] = preparedValues[field.id] === true || preparedValues[field.id] === "true";
      } else if (preparedValues[field.id] !== void 0 && preparedValues[field.id] !== "") {
        frontmatter[field.id] = field.type === "number" ? Number(preparedValues[field.id]) : preparedValues[field.id];
      }
    }
    const yaml = (0, import_obsidian6.stringifyYaml)(frontmatter).trim();
    await this.createMarkdownFile(path, `---
${yaml}
---

# ${preparedValues.title}
`);
    new import_obsidian6.Notice("Task created.");
    this.scheduleRefreshViews();
    return true;
  }
  getTaskFileBaseName(title, timestamp = /* @__PURE__ */ new Date()) {
    const sanitizedTitle = sanitizeFileName(title);
    const safeTitle = sanitizedTitle || "Untitled task";
    return `${safeTitle} (${this.formatTaskFileTimestamp(timestamp)})`;
  }
  formatTaskFileTimestamp(timestamp) {
    if (typeof timestamp === "string") {
      const parsed = timestamp.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2})[-:](\d{2})(?:[-:](\d{2}))?)?$/);
      if (parsed) {
        const hour = parsed[2] || "00";
        const minute = parsed[3] || "00";
        const second = parsed[4] || "00";
        return `${parsed[1]} ${hour}-${minute}-${second}`;
      }
    }
    return formatTimestampForFileName(timestamp);
  }
  getTaskFileTimestamp(file, frontmatter = {}) {
    var _a;
    const basename = String((file == null ? void 0 : file.basename) || "");
    const titledTimestamp = basename.match(/^.+\s+\((\d{4}-\d{2}-\d{2}(?:[ T]\d{2}[-:]\d{2}(?:[-:]\d{2})?)?)\)$/);
    if (titledTimestamp) return titledTimestamp[1];
    const leadingTimestamp = basename.match(/^(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}[-:]\d{2}(?:[-:]\d{2})?)?)\s+-\s+.+$/);
    if (leadingTimestamp) return leadingTimestamp[1];
    return frontmatter.created || ((_a = file == null ? void 0 : file.stat) == null ? void 0 : _a.ctime) || /* @__PURE__ */ new Date();
  }
  getUniqueTaskPath(folder, baseName, currentPath = "") {
    let path = (0, import_obsidian6.normalizePath)(`${folder}/${baseName}.md`);
    let counter = 2;
    while (path !== currentPath && this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian6.normalizePath)(`${folder}/${baseName} ${counter}.md`);
      counter += 1;
    }
    return path;
  }
  getNewTaskPath(folder, title) {
    return this.getUniqueTaskPath(folder, this.getTaskFileBaseName(title));
  }
  getRenamedTaskPath(file, title, frontmatter = {}) {
    const folder = file.parent ? file.parent.path : this.getTaskFolder();
    const baseName = this.getTaskFileBaseName(title, this.getTaskFileTimestamp(file, frontmatter));
    return this.getUniqueTaskPath(folder, baseName, file.path);
  }
  async ensureFolder(folderPath) {
    const normalized = (0, import_obsidian6.normalizePath)(folderPath);
    if (!normalized) return;
    const parts = normalized.split("/");
    let current = "";
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(current);
      if (!existing) {
        try {
          await this.app.vault.createFolder(current);
        } catch (error) {
          const created = this.app.vault.getAbstractFileByPath(current);
          if (created instanceof import_obsidian6.TFile) {
            throw new Error(`Cannot create folder "${current}" because a file already exists at that path.`);
          }
          if (!created) throw error;
        }
      } else if (existing instanceof import_obsidian6.TFile) {
        throw new Error(`Cannot create folder "${current}" because a file already exists at that path.`);
      }
    }
  }
  getDefaultStatus() {
    return this.settings.statuses[0] || "backlog";
  }
  normalizeTaskStatus(status) {
    const cleaned = cleanStatus(status);
    if (!cleaned || cleaned.toLowerCase() === "null" || cleaned.toLowerCase() === "undefined") {
      return this.getDefaultStatus();
    }
    return cleaned;
  }
  async createMarkdownFile(path, contents) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian6.TFile) return existing;
    if (existing) {
      throw new Error(`Cannot create file "${path}" because another item already exists at that path.`);
    }
    try {
      return await this.app.vault.create(path, contents);
    } catch (error) {
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof import_obsidian6.TFile) return created;
      throw error;
    }
  }
  async createUniqueMarkdownFile(folder, sanitizedName, contents) {
    let path = (0, import_obsidian6.normalizePath)(`${folder}/${sanitizedName}.md`);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian6.normalizePath)(`${folder}/${sanitizedName} ${counter}.md`);
      counter += 1;
    }
    return this.createMarkdownFile(path, contents);
  }
  async ensureReferenceFile(folder, name) {
    const sanitizedName = sanitizeFileName(name);
    if (!sanitizedName) return null;
    await this.ensureFolder(folder);
    const path = (0, import_obsidian6.normalizePath)(`${folder}/${sanitizedName}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian6.TFile) return existing;
    const contents = this.getReferenceKindForFolder(folder) ? this.getReferenceNoteContents(name) : `# ${name}
`;
    if (existing) {
      return this.createUniqueMarkdownFile(folder, sanitizedName, contents);
    }
    return this.createMarkdownFile(path, contents);
  }
  async updateTaskStatus(file, status) {
    const nextStatus = this.normalizeTaskStatus(status);
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      ensureFrontmatterTag(frontmatter, TASK_TAG);
      delete frontmatter.kanban_task;
      frontmatter.status = nextStatus;
      if (isDoneStatus(nextStatus)) {
        if (!frontmatter.completed) frontmatter.completed = nowIso();
      } else {
        delete frontmatter.completed;
      }
    });
    this.refreshViews();
  }
  async updateTaskWorkRange(file, workStart, workEnd) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      ensureFrontmatterTag(frontmatter, TASK_TAG);
      delete frontmatter.kanban_task;
      if (workStart) frontmatter.work_start = workStart;
      else delete frontmatter.work_start;
      if (workEnd) frontmatter.work_end = workEnd;
      else delete frontmatter.work_end;
    });
    this.refreshViews();
  }
  async renameStatus(oldStatus, nextStatus) {
    const next = cleanStatus(nextStatus);
    if (!next) {
      new import_obsidian6.Notice("Status is required.");
      return false;
    }
    if (!statusEquals(next, oldStatus) && this.settings.statuses.some((status) => statusEquals(status, next))) {
      new import_obsidian6.Notice("Status already exists.");
      return false;
    }
    if (next === oldStatus) return true;
    this.settings.statuses = this.settings.statuses.map((status) => statusEquals(status, oldStatus) ? next : status);
    await this.saveData(this.settings);
    for (const file of this.getTaskFiles()) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        if (!statusEquals(frontmatter.status, oldStatus)) return;
        frontmatter.status = next;
        if (isDoneStatus(next)) {
          if (!frontmatter.completed) frontmatter.completed = nowIso();
        } else if (isDoneStatus(oldStatus)) {
          delete frontmatter.completed;
        }
      });
    }
    this.refreshViews();
    return true;
  }
  async migrateLegacyTaskTags() {
    if (this.legacyTaskTagMigrationRunning) return;
    this.legacyTaskTagMigrationRunning = true;
    try {
      for (const file of this.getCandidateTaskFiles()) {
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache && cache.frontmatter;
        if (!this.isLegacyTaskFrontmatter(frontmatter)) continue;
        await this.app.fileManager.processFrontMatter(file, (nextFrontmatter) => {
          ensureFrontmatterTag(nextFrontmatter, TASK_TAG);
          delete nextFrontmatter.kanban_task;
        });
      }
    } finally {
      this.legacyTaskTagMigrationRunning = false;
    }
  }
  async removeStatus(status) {
    if (this.settings.statuses.length <= 1) {
      new import_obsidian6.Notice("At least one status is required.");
      return false;
    }
    this.settings.statuses = this.settings.statuses.filter((item) => !statusEquals(item, status));
    await this.saveSettings();
    return true;
  }
  getReferenceFiles(kind, projectValue = "", sourcePath = "") {
    if (kind === "feature") {
      const projectFile = this.findProjectFile(projectValue, sourcePath);
      if (!projectFile) return [];
      const featureFolder = this.getFeatureFolderForProject(projectFile);
      return this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${featureFolder}/`)).sort((left, right) => left.basename.localeCompare(right.basename));
    }
    const folder = this.getProjectFolder();
    return this.app.vault.getMarkdownFiles().filter((file) => !folder || file.path === folder || file.path.startsWith(`${folder}/`)).filter((file) => !file.path.includes("/Features/")).sort((left, right) => left.basename.localeCompare(right.basename));
  }
  getReferenceFolder(kind, projectValue = "", sourcePath = "") {
    if (kind === "feature") {
      const projectFile = this.findProjectFile(projectValue, sourcePath);
      return projectFile ? this.getFeatureFolderForProject(projectFile) : "";
    }
    return this.getProjectFolder();
  }
  getNoteLink(file, sourcePath = "") {
    return this.app.fileManager.generateMarkdownLink(file, sourcePath || this.getKanbanBasePath());
  }
  getProjectFolder() {
    return PROJECT_FOLDER;
  }
  getFeatureFolderForProject(projectFile) {
    return (0, import_obsidian6.normalizePath)(`${FEATURE_FOLDER}/${sanitizeFileName(projectFile.basename)}`);
  }
  getReferenceInputTarget(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    const wiki = text.match(/^\[\[([^|\]#]+)(?:#[^|\]]+)?(?:\|[^\]]+)?\]\]$/);
    if (wiki) return wiki[1].trim();
    const markdown = text.match(/^\[[^\]]+\]\(([^)]+)\)$/);
    if (markdown) return markdown[1].replace(/\.md$/i, "").trim();
    return text;
  }
  getReferenceName(value) {
    const target = this.getReferenceInputTarget(value);
    if (!target) return "";
    return target.split("/").pop().replace(/\.md$/i, "").trim();
  }
  findLinkedFile(value, sourcePath = "") {
    const target = this.getReferenceInputTarget(value);
    if (!target) return null;
    return this.app.metadataCache.getFirstLinkpathDest(target, sourcePath || this.getKanbanBasePath());
  }
  findProjectFile(value, sourcePath = "") {
    const linked = this.findLinkedFile(value, sourcePath);
    if (linked instanceof import_obsidian6.TFile && linked.path.startsWith(`${this.getProjectFolder()}/`) && !linked.path.includes("/Features/")) {
      return linked;
    }
    const name = this.getReferenceName(value).toLowerCase();
    if (!name) return null;
    return this.getReferenceFiles("project").find((file) => file.basename.toLowerCase() === name) || null;
  }
  findFeatureFile(value, projectFile, sourcePath = "") {
    const featureFolder = this.getFeatureFolderForProject(projectFile);
    const linked = this.findLinkedFile(value, sourcePath);
    if (linked instanceof import_obsidian6.TFile && linked.path.startsWith(`${featureFolder}/`)) {
      return linked;
    }
    const name = this.getReferenceName(value).toLowerCase();
    if (!name) return null;
    return this.getReferenceFiles("feature", this.getNoteLink(projectFile, sourcePath), sourcePath).find((file) => file.basename.toLowerCase() === name) || null;
  }
  async resolveProjectReference(value, sourcePath) {
    if (!String(value || "").trim()) return { link: "", file: null };
    const existing = this.findProjectFile(value, sourcePath);
    if (existing) return { link: this.getNoteLink(existing, sourcePath), file: existing };
    const name = this.getReferenceName(value);
    const file = await this.ensureReferenceFile(this.getProjectFolder(), name);
    if (!file) {
      new import_obsidian6.Notice("Project name is required.");
      return null;
    }
    return { link: this.getNoteLink(file, sourcePath), file };
  }
  async resolveFeatureReference(value, projectFile, sourcePath) {
    if (!String(value || "").trim()) return "";
    if (!projectFile) {
      new import_obsidian6.Notice("Create or select a project before adding a feature.");
      return null;
    }
    const existing = this.findFeatureFile(value, projectFile, sourcePath);
    if (existing) return this.getNoteLink(existing, sourcePath);
    const name = this.getReferenceName(value);
    const file = await this.ensureReferenceFile(this.getFeatureFolderForProject(projectFile), name);
    if (!file) {
      new import_obsidian6.Notice("Feature name is required.");
      return null;
    }
    return this.getNoteLink(file, sourcePath);
  }
  async prepareTaskReferences(values, sourcePath) {
    const prepared = Object.assign({}, values);
    const project = await this.resolveProjectReference(prepared.project, sourcePath);
    if (!project) return null;
    const feature = await this.resolveFeatureReference(prepared.feature, project.file, sourcePath);
    if (feature === null) return null;
    prepared.project = project.link;
    prepared.feature = feature;
    return prepared;
  }
  async getTaskTodoStats(file) {
    const contents = await this.app.vault.cachedRead(file);
    const todoPattern = /^\s*[-*+]\s+\[([ xX])\]\s+/gm;
    let total = 0;
    let completed = 0;
    let match;
    while ((match = todoPattern.exec(contents)) !== null) {
      total += 1;
      if (String(match[1]).toLowerCase() === "x") completed += 1;
    }
    return { completed, total };
  }
  async deleteTask(file) {
    const confirmed = await new ConfirmDeleteTaskModal(this.app, file.basename).openAndAwait();
    if (!confirmed) return false;
    try {
      await this.app.fileManager.trashFile(file);
    } catch (error) {
      console.error("Failed to delete task", error);
      new import_obsidian6.Notice("Task could not be deleted.");
      return false;
    }
    new import_obsidian6.Notice("Task deleted.");
    this.refreshViews();
    return true;
  }
  async updateTask(file, values) {
    var _a;
    const preparedValues = await this.prepareTaskReferences(values, file.path);
    if (!preparedValues) return false;
    const currentFrontmatter = Object.assign({}, ((_a = this.app.metadataCache.getFileCache(file)) == null ? void 0 : _a.frontmatter) || {});
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      ensureFrontmatterTag(frontmatter, TASK_TAG);
      delete frontmatter.kanban_task;
      frontmatter.title = preparedValues.title.trim();
      frontmatter.status = this.normalizeTaskStatus(preparedValues.status);
      if (preparedValues.project) frontmatter.project = preparedValues.project;
      else delete frontmatter.project;
      if (preparedValues.feature) frontmatter.feature = preparedValues.feature;
      else delete frontmatter.feature;
      if (preparedValues.priority) {
        frontmatter.priority = preparedValues.priority;
        frontmatter.priority_weight = getPriorityWeight(preparedValues.priority);
      } else {
        delete frontmatter.priority;
        delete frontmatter.priority_weight;
      }
      if (preparedValues.due) frontmatter.due = preparedValues.due;
      else delete frontmatter.due;
      if (preparedValues.work_start) frontmatter.work_start = preparedValues.work_start;
      else delete frontmatter.work_start;
      if (preparedValues.work_end) frontmatter.work_end = preparedValues.work_end;
      else delete frontmatter.work_end;
      if (preparedValues.notification_amount !== void 0 && preparedValues.notification_amount !== "") {
        frontmatter.notification_amount = Number(preparedValues.notification_amount);
        frontmatter.notification_unit = preparedValues.notification_unit || "days";
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
      if (isDoneStatus(frontmatter.status)) {
        if (!frontmatter.completed) frontmatter.completed = nowIso();
      } else {
        delete frontmatter.completed;
      }
      for (const field of this.settings.customFields) {
        if (field.type === "date-range") {
          if (preparedValues[`${field.id}_start`]) frontmatter[`${field.id}_start`] = preparedValues[`${field.id}_start`];
          else delete frontmatter[`${field.id}_start`];
          if (preparedValues[`${field.id}_end`]) frontmatter[`${field.id}_end`] = preparedValues[`${field.id}_end`];
          else delete frontmatter[`${field.id}_end`];
          continue;
        }
        if (field.type === "checkbox") {
          if (preparedValues[field.id] === void 0) delete frontmatter[field.id];
          else frontmatter[field.id] = preparedValues[field.id] === true || preparedValues[field.id] === "true";
          continue;
        }
        if (preparedValues[field.id] !== void 0 && preparedValues[field.id] !== "") {
          frontmatter[field.id] = field.type === "number" ? Number(preparedValues[field.id]) : preparedValues[field.id];
        } else {
          delete frontmatter[field.id];
        }
      }
    });
    const nextPath = this.getRenamedTaskPath(file, preparedValues.title, currentFrontmatter);
    if (nextPath !== file.path) {
      try {
        await this.app.vault.rename(file, nextPath);
      } catch (error) {
        console.error("Failed to rename task file", error);
        new import_obsidian6.Notice("Task updated, but the file could not be renamed.");
        this.refreshViews();
        return false;
      }
    }
    new import_obsidian6.Notice("Task updated.");
    this.refreshViews();
    return true;
  }
  async syncDerivedFieldsForFile(file) {
    if (!(file instanceof import_obsidian6.TFile) || file.extension !== "md") return;
    if (this.derivedFieldSyncRunning.has(file.path)) return;
    if (!this.isFileInTaskFolder(file)) return;
    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache && cache.frontmatter;
    if (!this.isTaskFrontmatter(frontmatter)) return;
    const shouldSetCompleted = isDoneStatus(frontmatter.status) && !frontmatter.completed;
    const shouldClearCompleted = frontmatter.status && !isDoneStatus(frontmatter.status) && frontmatter.completed;
    const expectedWeight = frontmatter.priority ? getPriorityWeight(frontmatter.priority) : void 0;
    const shouldSetPriorityWeight = expectedWeight !== void 0 && Number(frontmatter.priority_weight) !== expectedWeight;
    const shouldClearPriorityWeight = expectedWeight === void 0 && frontmatter.priority_weight !== void 0;
    if (!shouldSetCompleted && !shouldClearCompleted && !shouldSetPriorityWeight && !shouldClearPriorityWeight) return;
    this.derivedFieldSyncRunning.add(file.path);
    try {
      await this.app.fileManager.processFrontMatter(file, (nextFrontmatter) => {
        if (isDoneStatus(nextFrontmatter.status)) {
          if (!nextFrontmatter.completed) nextFrontmatter.completed = nowIso();
        } else {
          delete nextFrontmatter.completed;
        }
        if (nextFrontmatter.priority) {
          nextFrontmatter.priority_weight = getPriorityWeight(nextFrontmatter.priority);
        } else {
          delete nextFrontmatter.priority_weight;
        }
      });
    } finally {
      this.derivedFieldSyncRunning.delete(file.path);
    }
  }
  async syncDerivedFields() {
    if (this.derivedFieldFullSyncRunning) return;
    this.derivedFieldFullSyncRunning = true;
    try {
      for (const file of this.getTaskFiles()) {
        await this.syncDerivedFieldsForFile(file);
      }
    } finally {
      this.derivedFieldFullSyncRunning = false;
    }
  }
  async syncCompletionDates() {
    if (this.completionSyncRunning) return;
    this.completionSyncRunning = true;
    try {
      const tasks = await this.getTasks();
      for (const task of tasks) {
        const status = task.frontmatter.status;
        const hasCompleted = Boolean(task.frontmatter.completed);
        const shouldSetCompleted = isDoneStatus(status) && !hasCompleted;
        const shouldClearCompleted = status && !isDoneStatus(status) && hasCompleted;
        if (!shouldSetCompleted && !shouldClearCompleted) continue;
        await this.app.fileManager.processFrontMatter(task.file, (frontmatter) => {
          if (isDoneStatus(frontmatter.status)) {
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
  async syncPriorityWeights() {
    if (this.prioritySyncRunning) return;
    this.prioritySyncRunning = true;
    try {
      const tasks = await this.getTasks();
      for (const task of tasks) {
        const expectedWeight = task.frontmatter.priority ? getPriorityWeight(task.frontmatter.priority) : void 0;
        if (expectedWeight === void 0) {
          if (task.frontmatter.priority_weight === void 0) continue;
        } else if (Number(task.frontmatter.priority_weight) === expectedWeight) {
          continue;
        }
        await this.app.fileManager.processFrontMatter(task.file, (frontmatter) => {
          if (frontmatter.priority) {
            frontmatter.priority_weight = getPriorityWeight(frontmatter.priority);
          } else {
            delete frontmatter.priority_weight;
          }
        });
      }
    } finally {
      this.prioritySyncRunning = false;
    }
  }
  async checkNotifications() {
    const tasks = await this.getTasks();
    const now = Date.now();
    for (const task of tasks) {
      const fm = task.frontmatter;
      if (isDoneStatus(fm.status)) continue;
      const due = toDate(fm.due);
      const leadMs = getNotificationLeadMs(fm);
      if (!due || leadMs === null) continue;
      if (now < due.getTime() - leadMs) continue;
      if (fm.notification_sent_for === fm.due) continue;
      new import_obsidian6.Notice(`Due soon: ${getTaskTitle(task)}`, 8e3);
      await this.app.fileManager.processFrontMatter(task.file, (frontmatter) => {
        frontmatter.notification_sent_for = frontmatter.due;
        frontmatter.notification_sent_at = nowIso();
      });
    }
  }
};
