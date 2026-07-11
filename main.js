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
var BASES_KANBAN_VIEW_TYPE = "frontmatterKanban";
var BASES_TIMELINE_VIEW_TYPE = "frontmatterTimeline";
var ROOT_FOLDER = "TaskManagement";
var TASK_FOLDER = `${ROOT_FOLDER}/Tasks`;
var VIEWS_FOLDER = `${ROOT_FOLDER}/Views`;
var PROJECT_FOLDER = `${ROOT_FOLDER}/Projects`;
var FEATURE_FOLDER = `${PROJECT_FOLDER}/Features`;
var DEFAULT_KANBAN_BASE_FILE = `${VIEWS_FOLDER}/Kanban.base`;
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
  if (diffDays <= 7) return "is-due-yellow";
  return "";
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
    new import_obsidian.ButtonComponent(footer).setButtonText("Delete").setIcon("trash-2").setWarning().setClass("frontmatter-kanban-delete-button").onClick(async () => {
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
  menu.addSeparator();
  menu.addItem((item) => item.setTitle("Delete task").setIcon("trash-2").setWarning(true).onClick(() => host.plugin.deleteTask(task.file)));
  menu.showAtMouseEvent(event);
}
function renderTaskCard(host, cards, task, options = {}) {
  const priority = String(task.frontmatter.priority || "").trim().toLowerCase();
  const priorityClass = priority ? `priority-${priority}` : "";
  const extraClass = options.extraClass || "";
  const card = cards.createDiv({ cls: `frontmatter-kanban-card ${priorityClass} ${extraClass}`.trim() });
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
  if (priority) {
    titleTags.createSpan({ cls: `frontmatter-kanban-card-priority-tag ${priorityClass}`, text: priority });
  }
  if (options.badgeMode === "status") {
    const status = String(task.frontmatter.status || host.plugin.getDefaultStatus()).trim();
    if (status) titleTags.createSpan({ cls: "frontmatter-kanban-card-status-tag", text: status });
  } else if (workRange) {
    titleTags.createSpan({ cls: "frontmatter-kanban-card-work-tag", text: workRange });
  }
  titleText.createDiv({ cls: "frontmatter-kanban-card-title", text: getTaskTitle(task) });
  const summary = getCardSummary(task);
  if (summary) {
    card.createDiv({ cls: "frontmatter-kanban-card-summary", text: summary });
  }
  renderTodoProgress(host, card, task);
  const project = formatReferenceLabel(task.frontmatter.project);
  const feature = formatReferenceLabel(task.frontmatter.feature);
  if (project || feature || dueDateParts) {
    card.createDiv({ cls: "frontmatter-kanban-card-divider" });
    const details = card.createDiv({ cls: "frontmatter-kanban-card-details" });
    if (project || feature) {
      const stats = details.createDiv({ cls: "frontmatter-kanban-card-stats" });
      if (project) {
        const item = stats.createDiv({ cls: "frontmatter-kanban-card-stat is-project" });
        (0, import_obsidian2.setIcon)(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "rocket");
        const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Project" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-value", text: project });
      }
      if (feature) {
        const item = stats.createDiv({ cls: "frontmatter-kanban-card-stat is-feature" });
        (0, import_obsidian2.setIcon)(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "wrench");
        const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Feature" });
        body.createSpan({ cls: "frontmatter-kanban-card-stat-value", text: feature });
      }
    }
    if (dueDateParts) {
      const item = details.createDiv({ cls: `frontmatter-kanban-card-stat is-due ${getDueClass(task)}` });
      (0, import_obsidian2.setIcon)(item.createSpan({ cls: "frontmatter-kanban-card-stat-icon" }), "calendar");
      const body = item.createDiv({ cls: "frontmatter-kanban-card-stat-body" });
      body.createSpan({ cls: "frontmatter-kanban-card-stat-label", text: "Due date" });
      const value = body.createSpan({ cls: "frontmatter-kanban-card-stat-value is-due-date" });
      value.createSpan({ cls: "frontmatter-kanban-card-due-year", text: dueDateParts.year });
      value.createSpan({ cls: "frontmatter-kanban-card-due-day-month", text: dueDateParts.dayMonth });
    }
  }
  if (task.frontmatter.completed) {
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
    fill.style.width = `${Math.round(stats.completed / stats.total * 100)}%`;
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
    this.containerEl.removeClass("frontmatter-timeline");
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
    column.style.setProperty("--kanban-column-accent", getStatusAccent(status, COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length]));
    const header = column.createDiv({ cls: "frontmatter-kanban-column-header" });
    const title = header.createDiv({ cls: "frontmatter-kanban-column-title" });
    title.createSpan({ text: status });
    title.createSpan({ cls: "frontmatter-kanban-column-count", text: String(entries.length) });
    new import_obsidian3.ButtonComponent(header).setIcon("plus").setTooltip(`New task in ${status}`).setClass("frontmatter-kanban-column-new").onClick(() => this.openCreateTaskModal({ status }));
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
var LABEL_COLUMN_WIDTH = 124;
var PRIORITY_ACCENTS = {
  high: "#C98282",
  medium: "#C2A667",
  low: "#79A99F",
  none: "#70899D"
};
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
function formatTaiwanDate(date, includeYear = true) {
  const prefix = includeYear ? `${date.getFullYear()}\u5E74` : "";
  return `${prefix}${date.getMonth() + 1}\u6708${date.getDate()}\u65E5`;
}
function getWeekdayLabel(date) {
  return ["\u9031\u65E5", "\u9031\u4E00", "\u9031\u4E8C", "\u9031\u4E09", "\u9031\u56DB", "\u9031\u4E94", "\u9031\u516D"][date.getDay()];
}
function getPriorityKey(task) {
  const priority = String(task.frontmatter.priority || "").trim().toLowerCase();
  return PRIORITIES.includes(priority) ? priority : "none";
}
function getPriorityAccent(task) {
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
    const configured = this.config && typeof this.config.get === "function" ? Number(this.config.get("dayWidth")) : 170;
    if (!Number.isFinite(configured)) return 170;
    return Math.min(260, Math.max(120, configured));
  }
  getLaneHeight() {
    const configured = this.config && typeof this.config.get === "function" ? Number(this.config.get("laneHeight")) : 178;
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
    (0, import_obsidian4.setIcon)(title.createSpan({ cls: "frontmatter-timeline-title-icon" }), "calendar-days");
    title.createSpan({ text: "Timeline" });
    const modeSwitch = toolbar.createDiv({ cls: "frontmatter-timeline-mode-switch" });
    [
      ["day", "\u65E5"],
      ["week", "\u9031"],
      ["month", "\u6708"]
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
    new import_obsidian4.ButtonComponent(toolbar).setButtonText("\u4ECA\u5929").setClass("frontmatter-timeline-today").onClick(() => {
      this.anchorDate = /* @__PURE__ */ new Date();
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
    if (this.periodMode === "month") return `${period.start.getFullYear()}\u5E74${period.start.getMonth() + 1}\u6708`;
    const sameYear = period.start.getFullYear() === period.end.getFullYear();
    const endLabel = formatTaiwanDate(period.end, !sameYear);
    return `${formatTaiwanDate(period.start)} - ${endLabel}\uFF08\u7B2C${getIsoWeekNumber(period.start)}\u9031\uFF09`;
  }
  getTasks() {
    const entries = this.getTaskFolderEntries(this.data && Array.isArray(this.data.data) ? this.data.data : []);
    return entries.map((entry) => this.entryToTask(entry)).filter(Boolean).sort((left, right) => {
      var _a, _b;
      const startDiff = (((_a = parseDateOnly(left.frontmatter.work_start || left.frontmatter.work_end)) == null ? void 0 : _a.getTime()) || 0) - (((_b = parseDateOnly(right.frontmatter.work_start || right.frontmatter.work_end)) == null ? void 0 : _b.getTime()) || 0);
      if (startDiff) return startDiff;
      const priorityDiff = getPriorityWeight(right.frontmatter.priority) - getPriorityWeight(left.frontmatter.priority);
      if (priorityDiff) return priorityDiff;
      return getTaskTitle(left).localeCompare(getTaskTitle(right));
    });
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
  getVisibleScheduledTasks(tasks, period) {
    return tasks.map((task) => ({ task, range: this.getTaskRange(task) })).filter((item) => item.range && item.range.start <= period.end && item.range.end >= period.start);
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
      if (!(file instanceof import_obsidian4.TFile)) return;
      const task = tasks.find((item) => item.file.path === file.path);
      await this.scheduleTaskFromDrop(file, task, dropDate);
    });
    const corner = grid.createDiv({ cls: "frontmatter-timeline-corner", text: "\u4EFB\u52D9" });
    corner.style.gridColumn = "1";
    corner.style.gridRow = "1";
    period.days.forEach((date, index) => {
      const header = grid.createDiv({ cls: "frontmatter-timeline-day-header" });
      if (formatDateOnly(date) === formatDateOnly(/* @__PURE__ */ new Date())) header.addClass("is-today");
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
      const empty = grid.createDiv({ cls: "frontmatter-timeline-empty", text: "\u9019\u6BB5\u671F\u9593\u6C92\u6709\u5DF2\u6392\u7A0B\u7684\u4EFB\u52D9" });
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
    header.createDiv({ cls: "frontmatter-timeline-sidebar-title", text: "\u4EFB\u52D9\u6E05\u55AE" });
    new import_obsidian4.ButtonComponent(header).setIcon("plus").setTooltip("New task").onClick(() => new CreateTaskModal(this.plugin.app, this.plugin).open());
    new import_obsidian4.ButtonComponent(header).setIcon("more-horizontal").setTooltip("More");
    const body = sidebar.createDiv({ cls: "frontmatter-timeline-sidebar-body" });
    const groups = [
      ["high", "HIGH \u512A\u5148\u5EA6"],
      ["medium", "MEDIUM \u512A\u5148\u5EA6"],
      ["low", "LOW \u512A\u5148\u5EA6"],
      ["none", "\u672A\u5206\u7D1A"]
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
      dayWidth: 170
      laneHeight: 178
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
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("frontmatter-kanban-settings");
    containerEl.createEl("h2", { text: "TaskManagement" });
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
      summary.createSpan({ cls: "frontmatter-kanban-settings-section-desc", text: desc });
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
        if (renamed) this.display();
      });
      new import_obsidian5.ButtonComponent(row).setButtonText("Remove").onClick(async () => {
        const removed = await this.plugin.removeStatus(status);
        if (removed) this.display();
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
      this.display();
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
    section.createEl("h4", { text: "Add field" });
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
      this.display();
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
      this.display();
    });
    new import_obsidian5.ButtonComponent(row).setButtonText("Remove").onClick(async () => {
      this.plugin.settings.customFields = this.plugin.settings.customFields.filter((item) => item.id !== field.id);
      await this.plugin.saveSettings();
      this.display();
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
  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags.push(normalizedTag);
    return;
  }
  if (typeof frontmatter.tags === "string" && frontmatter.tags.trim()) {
    frontmatter.tags = `${frontmatter.tags.trim()} ${normalizedTag}`;
    return;
  }
  frontmatter.tags = [normalizedTag];
}

// src/plugin.ts
var FrontmatterKanbanPlugin = class extends import_obsidian6.Plugin {
  async onload() {
    await this.loadStyles();
    await this.loadSettings();
    this.registerBasesIntegration();
    this.addRibbonIcon("kanban", "Open Kanban Board", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-taskmanagement-kanban-board",
      name: "Open Kanban board",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "create-frontmatter-kanban-task",
      name: "Create Kanban task",
      hotkeys: [{ modifiers: ["Mod", "Shift"], key: "t" }],
      callback: () => new CreateTaskModal(this.app, this).open()
    });
    this.addSettingTab(new KanbanSettingTab(this.app, this));
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
    this.registerInterval(window.setInterval(() => this.checkNotifications(), 60 * 1e3));
    await this.ensureStorageFolders();
    await this.ensureKanbanBaseFile();
    await this.migrateLegacyTaskTags();
    this.syncDerivedFields();
    this.checkNotifications();
  }
  async loadStyles() {
    var _a;
    const styleId = `${this.manifest.id}-managed-styles`;
    (_a = document.getElementById(styleId)) == null ? void 0 : _a.remove();
    const stylePath = (0, import_obsidian6.normalizePath)(`${this.manifest.dir || ""}/styles.css`);
    try {
      const css = await this.app.vault.adapter.read(stylePath);
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = css;
      document.head.appendChild(styleEl);
      this.register(() => styleEl.remove());
    } catch (error) {
      console.warn(`Failed to load ${stylePath}`, error);
    }
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
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }
  async openTaskFile(file) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file, { active: true });
    this.app.workspace.revealLeaf(leaf);
  }
  registerBasesIntegration() {
    if (typeof this.registerBasesView !== "function") {
      new import_obsidian6.Notice("Obsidian Bases API is not available. Please update Obsidian and enable the Bases core plugin.");
      return;
    }
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
          default: 178,
          min: 132,
          max: 260,
          step: 8
        }
      ]
    });
    if (!kanbanRegistered || !timelineRegistered) {
      new import_obsidian6.Notice("Enable the Bases core plugin to use TaskManagement views.");
    }
  }
  getKanbanBasePath() {
    return DEFAULT_KANBAN_BASE_FILE;
  }
  async ensureKanbanBaseFile() {
    const path = this.getKanbanBasePath();
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian6.TFile) {
      await this.migrateKanbanBaseFile(existing);
      return existing;
    }
    const folder = path.split("/").slice(0, -1).join("/");
    await this.ensureFolder(folder);
    return this.createMarkdownFile(path, generateDefaultKanbanBase(this.getTaskFolder()));
  }
  async ensureStorageFolders() {
    await this.ensureFolder(ROOT_FOLDER);
    await this.ensureFolder(TASK_FOLDER);
    await this.ensureFolder(VIEWS_FOLDER);
    await this.ensureFolder(PROJECT_FOLDER);
    await this.ensureFolder(FEATURE_FOLDER);
  }
  async migrateKanbanBaseFile(file) {
    const contents = await this.app.vault.cachedRead(file);
    let nextContents = contents;
    if (nextContents.includes("kanban_task")) {
      nextContents = nextContents.replace(
        /filters:\r?\n  or:\r?\n    - note\["kanban_task"\] == true\r?\n    - note\.status && note\.status != ""/,
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
    if (existing) {
      return this.createUniqueMarkdownFile(folder, sanitizedName, `# ${name}
`);
    }
    return this.createMarkdownFile(path, `# ${name}
`);
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
    const confirmed = window.confirm(`Delete "${file.basename}"?`);
    if (!confirmed) return false;
    try {
      await this.app.vault.trash(file, true);
    } catch (error) {
      await this.app.vault.trash(file, false);
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
