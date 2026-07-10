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
var import_obsidian4 = require("obsidian");

// src/constants.ts
var BASES_KANBAN_VIEW_TYPE = "frontmatterKanban";
var DEFAULT_KANBAN_BASE_FILE = "Kanban.base";
var DONE_STATUS = "done";
var TASK_TAG = "task";
var LEGACY_TASK_TAG = "tasks";
var BUILT_IN_STATUSES = ["backlog", "nextup", "ongoing", "done"];
var PRIORITIES = ["high", "medium", "easy", "low"];
var PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  easy: 1,
  low: 0
};
var DEFAULT_SETTINGS = {
  taskFolder: "Tasks",
  baseFilePath: DEFAULT_KANBAN_BASE_FILE,
  projectFolder: "Projects",
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
var import_obsidian2 = require("obsidian");

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
  const start = frontmatter.work_start || "";
  const end = frontmatter.work_end || "";
  if (!start && !end) return "";
  if (start && end) return `${start} - ${end}`;
  return start || end;
}

// src/taskFields.ts
function getTaskTitle(task) {
  return String(task.frontmatter.title || "").trim() || "Untitled task";
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
function getReferenceLabel(kind) {
  return kind === "feature" ? "feature" : "project";
}
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
    el.createDiv({ cls: "frontmatter-kanban-suggestion-title", text: file.basename });
    el.createDiv({ cls: "frontmatter-kanban-suggestion-path", text: file.path });
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
    placeholder: `[[${label} note]]`
  });
  input.value = modal.values[key] || "";
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
      input.value = link;
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
      dropdown.addOption("", "None");
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
    const input = setting.controlEl.createEl("input", { type: "datetime-local" });
    input.value = formatDateTimeForInput(this.values[key]);
    input.addEventListener("change", () => {
      this.values[key] = readDateInputAsIso(input.value);
    });
  }
  renderDateRangeSetting(container, label, startKey, endKey) {
    const setting = new import_obsidian.Setting(container).setName(label);
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
    const input = setting.controlEl.createEl("input", { type: "datetime-local" });
    input.value = formatDateTimeForInput(this.values[key]);
    input.addEventListener("change", () => {
      this.values[key] = readDateInputAsIso(input.value);
    });
  }
  renderDateRangeSetting(container, label, startKey, endKey) {
    const setting = new import_obsidian.Setting(container).setName(label);
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

// src/bases/KanbanBasesView.ts
var COLUMN_ACCENTS = [
  "#7d8b84",
  "#8793ad",
  "#86a39a",
  "#b39a7c",
  "#819f88",
  "#9a8fa9",
  "#b28c8c"
];
function valueToString(value) {
  if (value === void 0 || value === null) return "";
  if (value.constructor && value.constructor.name === "NullValue") return "";
  const text = String(value).trim();
  if (text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return "";
  return text;
}
function getEntryFile(entry) {
  return entry && entry.file instanceof import_obsidian2.TFile ? entry.file : null;
}
function formatReferenceLabel(value) {
  const text = String(value || "").trim();
  const wikilink = text.match(/^\[\[(.+)\]\]$/);
  if (!wikilink) return text;
  const target = wikilink[1];
  const alias = target.includes("|") ? target.split("|").pop() : target;
  return alias.split("/").pop();
}
var KanbanBasesView = class extends import_obsidian2.BasesView {
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
    const configured = this.config && typeof this.config.get === "function" ? Number(this.config.get("columnWidth")) : 280;
    if (!Number.isFinite(configured)) return 280;
    return Math.min(420, Math.max(220, configured));
  }
  getGroups() {
    const groupedData = this.data && Array.isArray(this.data.groupedData) ? this.data.groupedData : [];
    if (groupedData.length > 1 || groupedData[0] && groupedData[0].hasKey && groupedData[0].hasKey()) {
      return this.mergeConfiguredStatuses(groupedData.map((group) => ({
        status: this.normalizeStatus(valueToString(group.key)),
        entries: group.entries || []
      })));
    }
    const entries = this.data && Array.isArray(this.data.data) ? this.data.data : [];
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
    column.style.setProperty("--kanban-column-accent", COLUMN_ACCENTS[columnIndex % COLUMN_ACCENTS.length]);
    const header = column.createDiv({ cls: "frontmatter-kanban-column-header" });
    const title = header.createDiv({ cls: "frontmatter-kanban-column-title" });
    title.createSpan({ text: status });
    title.createSpan({ cls: "frontmatter-kanban-column-count", text: String(entries.length) });
    new import_obsidian2.ButtonComponent(header).setIcon("plus").setTooltip(`New task in ${status}`).setClass("frontmatter-kanban-column-new").onClick(() => this.openCreateTaskModal({ status }));
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
      if (file instanceof import_obsidian2.TFile) {
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
    const card = cards.createDiv({ cls: `frontmatter-kanban-card ${getDueClass(task)}` });
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
    card.createDiv({ cls: "frontmatter-kanban-card-title", text: getTaskTitle(task) });
    const summary = this.getCardSummary(task);
    if (summary) {
      card.createDiv({ cls: "frontmatter-kanban-card-summary", text: summary });
    }
    this.renderTodoProgress(card, task);
    const workOn = getWorkOnText(task.frontmatter);
    const project = formatReferenceLabel(task.frontmatter.project);
    const feature = formatReferenceLabel(task.frontmatter.feature);
    if (task.frontmatter.priority || workOn || project || feature) {
      const meta = card.createDiv({ cls: "frontmatter-kanban-card-meta" });
      if (project) {
        meta.createSpan({ cls: "frontmatter-kanban-card-reference", text: `Project ${project}` });
      }
      if (feature) {
        meta.createSpan({ cls: "frontmatter-kanban-card-reference", text: `Feature ${feature}` });
      }
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
        (0, import_obsidian2.setIcon)(due.createSpan(), "calendar");
        due.createSpan({ text: formatDateLabel(task.frontmatter.due) || formatDateTimeForInput(task.frontmatter.due).replace("T", " ") });
      }
      if (task.frontmatter.completed) {
        const completed = footer.createSpan({ cls: "frontmatter-kanban-card-date is-complete" });
        (0, import_obsidian2.setIcon)(completed.createSpan(), "check-circle-2");
        completed.createSpan({ text: formatDateLabel(task.frontmatter.completed) });
      }
    }
  }
  renderTodoProgress(card, task) {
    const todo = card.createDiv({ cls: "frontmatter-kanban-card-todos is-loading" });
    this.plugin.getTaskTodoStats(task.file).then((stats) => {
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
  openTaskMenu(event, task) {
    const menu = new import_obsidian2.Menu();
    menu.addItem((item) => item.setTitle("Edit task").setIcon("pencil").onClick(() => new EditTaskModal(this.plugin.app, this.plugin, task).open()));
    menu.addItem((item) => item.setTitle("Open note").setIcon("file-text").onClick(() => this.plugin.openTaskFile(task.file)));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("Delete task").setIcon("trash-2").setWarning(true).onClick(() => this.plugin.deleteTask(task.file)));
    menu.showAtMouseEvent(event);
  }
  getCardSummary(task) {
    const fm = task.frontmatter;
    return String(fm.description || fm.summary || fm.notes || "").trim();
  }
};
function buildKanbanBasesViewFactory(plugin) {
  return function(controller, containerEl) {
    return new KanbanBasesView(controller, containerEl, plugin);
  };
}

// src/bases/defaultKanbanBase.ts
function formatPriorityWeightFormula() {
  const entries = Object.entries(PRIORITY_WEIGHTS);
  return entries.reduceRight((expression, [priority, weight]) => `if(note.priority == "${priority}", ${weight}, ${expression})`, "0");
}
function generateDefaultKanbanBase() {
  return `filters:
  and:
    - note.tags.contains("${TASK_TAG}")
formulas:
  priorityWeight: ${formatPriorityWeightFormula()}
  isOverdue: note.due && date(note.due) < today() && note.status != "done"
  daysUntilDue: if(note.due, ((number(date(note.due)) - number(today())) / 86400000).floor(), null)
views:
  - type: frontmatterKanban
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
      columnWidth: 280
`;
}

// src/settings/KanbanSettingTab.ts
var import_obsidian3 = require("obsidian");

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
var KanbanSettingTab = class extends import_obsidian3.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("frontmatter-kanban-settings");
    containerEl.createEl("h2", { text: "Kanban Board" });
    this.renderStorage(containerEl);
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
  renderStorage(container) {
    const section = this.renderSection(container, "Storage", "Folders and Base file location");
    new import_obsidian3.Setting(section).setName("Task folder").setDesc("Markdown task notes are created and read from this folder.").addText((text) => text.setPlaceholder("Tasks").setValue(this.plugin.settings.taskFolder).onChange(async (value) => {
      this.plugin.settings.taskFolder = value.trim() || "Tasks";
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(section).setName("Kanban Base file").setDesc("Path for the .base file opened by the Kanban Board command.").addText((text) => text.setPlaceholder("Kanban.base").setValue(this.plugin.settings.baseFilePath).onChange(async (value) => {
      this.plugin.settings.baseFilePath = value.trim() || "Kanban.base";
      await this.plugin.saveSettings();
    }));
    new import_obsidian3.Setting(section).setName("Project folder").setDesc("Project notes are created and picked from this folder. Feature notes live inside each project folder.").addText((text) => text.setPlaceholder("Projects").setValue(this.plugin.settings.projectFolder).onChange(async (value) => {
      this.plugin.settings.projectFolder = value.trim() || "Projects";
      await this.plugin.saveSettings();
    }));
  }
  renderStatuses(container) {
    const section = this.renderSection(container, "Statuses", "Columns shown on the Kanban board");
    const containerEl = section;
    const list = containerEl.createDiv({ cls: "frontmatter-kanban-settings-list" });
    for (const status of this.plugin.settings.statuses) {
      const row = list.createDiv({ cls: "frontmatter-kanban-settings-row frontmatter-kanban-status-row" });
      const input2 = new import_obsidian3.TextComponent(row).setValue(status);
      new import_obsidian3.ButtonComponent(row).setButtonText("Save").onClick(async () => {
        const renamed = await this.plugin.renameStatus(status, input2.getValue());
        if (renamed) this.display();
      });
      new import_obsidian3.ButtonComponent(row).setButtonText("Remove").onClick(async () => {
        const removed = await this.plugin.removeStatus(status);
        if (removed) this.display();
      });
    }
    const addRow = containerEl.createDiv({ cls: "frontmatter-kanban-settings-add-row" });
    const input = new import_obsidian3.TextComponent(addRow).setPlaceholder("New status");
    new import_obsidian3.ButtonComponent(addRow).setButtonText("Add status").onClick(async () => {
      const status = cleanStatus(input.getValue());
      if (!status) {
        new import_obsidian3.Notice("Status is required.");
        return;
      }
      if (this.plugin.settings.statuses.some((item) => statusEquals(item, status))) {
        new import_obsidian3.Notice("Status already exists.");
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
      new import_obsidian3.Setting(section).setName(label).addToggle((toggle) => toggle.setValue(Boolean(this.plugin.settings.createFormFields[key])).onChange(async (value) => {
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
    const name = new import_obsidian3.TextComponent(add).setPlaceholder("Name");
    const type = new import_obsidian3.DropdownComponent(add);
    for (const fieldType of FIELD_TYPES) {
      type.addOption(fieldType, fieldType);
    }
    const options = new import_obsidian3.TextComponent(add).setPlaceholder("Select options, comma separated");
    const defaultValue = new import_obsidian3.TextComponent(add).setPlaceholder("Default value");
    const showInCreate = add.createEl("label", { cls: "frontmatter-kanban-inline-toggle" });
    const showInCreateInput = showInCreate.createEl("input", { type: "checkbox" });
    showInCreate.createSpan({ text: "Show in create form" });
    new import_obsidian3.ButtonComponent(add).setButtonText("Add field").onClick(async () => {
      const fieldName = name.getValue().trim();
      const id = normalizeFieldId(fieldName);
      if (!fieldName || !id) {
        new import_obsidian3.Notice("Field name is required.");
        return;
      }
      const existingIds = new Set(getAllFieldDefinitions(this.plugin).map((field) => field.id));
      if (existingIds.has(id)) {
        new import_obsidian3.Notice("Field already exists.");
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
    const name = new import_obsidian3.TextComponent(row).setValue(field.name);
    const type = new import_obsidian3.DropdownComponent(row);
    for (const fieldType of FIELD_TYPES) {
      type.addOption(fieldType, fieldType);
    }
    type.setValue(field.type);
    const options = new import_obsidian3.TextComponent(row).setPlaceholder("Select options").setValue(field.options || "");
    const defaultValue = new import_obsidian3.TextComponent(row).setPlaceholder("Default value").setValue(field.defaultValue || "");
    const showInCreate = row.createEl("label", { cls: "frontmatter-kanban-inline-toggle" });
    const showInCreateInput = showInCreate.createEl("input", { type: "checkbox" });
    showInCreateInput.checked = Boolean(field.showInCreate);
    showInCreate.createSpan({ text: "Create form" });
    new import_obsidian3.ButtonComponent(row).setButtonText("Save").onClick(async () => {
      const nextName = name.getValue().trim();
      if (!nextName) {
        new import_obsidian3.Notice("Field name is required.");
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
    new import_obsidian3.ButtonComponent(row).setButtonText("Remove").onClick(async () => {
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
var FrontmatterKanbanPlugin = class extends import_obsidian4.Plugin {
  async onload() {
    await this.loadSettings();
    this.registerBasesIntegration();
    this.addRibbonIcon("kanban", "Open Kanban Board", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-frontmatter-kanban-board",
      name: "Open Kanban Board",
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
        this.syncPriorityWeights();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.refreshViews())
    );
    this.registerInterval(window.setInterval(() => this.checkNotifications(), 60 * 1e3));
    await this.migrateLegacyTaskTags();
    this.syncCompletionDates();
    this.syncPriorityWeights();
    this.checkNotifications();
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
    this.settings.baseFilePath = (0, import_obsidian4.normalizePath)(this.settings.baseFilePath || DEFAULT_SETTINGS.baseFilePath);
    this.settings.projectFolder = (0, import_obsidian4.normalizePath)(this.settings.projectFolder || DEFAULT_SETTINGS.projectFolder);
    delete this.settings.featureFolder;
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.refreshViews();
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
      new import_obsidian4.Notice("Obsidian Bases API is not available. Please update Obsidian and enable the Bases core plugin.");
      return;
    }
    const registered = this.registerBasesView(BASES_KANBAN_VIEW_TYPE, {
      name: "Kanban Board",
      icon: "kanban",
      factory: buildKanbanBasesViewFactory(this),
      options: () => [
        {
          type: "slider",
          key: "columnWidth",
          displayName: "Column width",
          default: 280,
          min: 220,
          max: 420,
          step: 20
        }
      ]
    });
    if (!registered) {
      new import_obsidian4.Notice("Enable the Bases core plugin to use Kanban Board views.");
    }
  }
  getKanbanBasePath() {
    const configured = (0, import_obsidian4.normalizePath)(this.settings.baseFilePath || DEFAULT_KANBAN_BASE_FILE);
    if (!configured) return DEFAULT_KANBAN_BASE_FILE;
    if (configured.endsWith(".base")) return configured;
    return (0, import_obsidian4.normalizePath)(`${configured}/${DEFAULT_KANBAN_BASE_FILE}`);
  }
  async ensureKanbanBaseFile() {
    const path = this.getKanbanBasePath();
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian4.TFile) {
      await this.migrateKanbanBaseFile(existing);
      return existing;
    }
    const folder = path.split("/").slice(0, -1).join("/");
    await this.ensureFolder(folder);
    return this.createMarkdownFile(path, generateDefaultKanbanBase());
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
  getCandidateTaskFiles() {
    const folder = (0, import_obsidian4.normalizePath)(this.settings.taskFolder || "");
    return this.app.vault.getMarkdownFiles().filter((file) => {
      if (folder && !(file.path === folder || file.path.startsWith(`${folder}/`))) {
        return false;
      }
      return true;
    });
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
    return this.getCandidateTaskFiles().filter((file) => {
      const cache = this.app.metadataCache.getFileCache(file);
      const frontmatter = cache && cache.frontmatter;
      return this.isTaskFrontmatter(frontmatter);
    });
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
    const folder = (0, import_obsidian4.normalizePath)(this.settings.taskFolder || "Tasks");
    await this.ensureFolder(folder);
    const sanitizedTitle = sanitizeFileName(values.title);
    if (!sanitizedTitle) {
      new import_obsidian4.Notice("Task title is required.");
      return;
    }
    const path = this.getNewTaskPath(folder, sanitizedTitle);
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
    const yaml = (0, import_obsidian4.stringifyYaml)(frontmatter).trim();
    await this.createMarkdownFile(path, `---
${yaml}
---

# ${preparedValues.title}
`);
    new import_obsidian4.Notice("Task created.");
    this.refreshViews();
    return true;
  }
  getNewTaskPath(folder, sanitizedTitle) {
    const prefix = formatTimestampForFileName();
    const baseName = `${prefix} - ${sanitizedTitle}`;
    let path = (0, import_obsidian4.normalizePath)(`${folder}/${baseName}.md`);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian4.normalizePath)(`${folder}/${baseName} ${counter}.md`);
      counter += 1;
    }
    return path;
  }
  async ensureFolder(folderPath) {
    const normalized = (0, import_obsidian4.normalizePath)(folderPath);
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
          if (created instanceof import_obsidian4.TFile) {
            throw new Error(`Cannot create folder "${current}" because a file already exists at that path.`);
          }
          if (!created) throw error;
        }
      } else if (existing instanceof import_obsidian4.TFile) {
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
    if (existing instanceof import_obsidian4.TFile) return existing;
    if (existing) {
      throw new Error(`Cannot create file "${path}" because another item already exists at that path.`);
    }
    try {
      return await this.app.vault.create(path, contents);
    } catch (error) {
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof import_obsidian4.TFile) return created;
      throw error;
    }
  }
  async createUniqueMarkdownFile(folder, sanitizedName, contents) {
    let path = (0, import_obsidian4.normalizePath)(`${folder}/${sanitizedName}.md`);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = (0, import_obsidian4.normalizePath)(`${folder}/${sanitizedName} ${counter}.md`);
      counter += 1;
    }
    return this.createMarkdownFile(path, contents);
  }
  async ensureReferenceFile(folder, name) {
    const sanitizedName = sanitizeFileName(name);
    if (!sanitizedName) return null;
    await this.ensureFolder(folder);
    const path = (0, import_obsidian4.normalizePath)(`${folder}/${sanitizedName}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian4.TFile) return existing;
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
  async renameStatus(oldStatus, nextStatus) {
    const next = cleanStatus(nextStatus);
    if (!next) {
      new import_obsidian4.Notice("Status is required.");
      return false;
    }
    if (!statusEquals(next, oldStatus) && this.settings.statuses.some((status) => statusEquals(status, next))) {
      new import_obsidian4.Notice("Status already exists.");
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
      new import_obsidian4.Notice("At least one status is required.");
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
    return (0, import_obsidian4.normalizePath)(this.settings.projectFolder || DEFAULT_SETTINGS.projectFolder);
  }
  getFeatureFolderForProject(projectFile) {
    return (0, import_obsidian4.normalizePath)(`${projectFile.path.replace(/\.md$/i, "")}/Features`);
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
    if (linked instanceof import_obsidian4.TFile && linked.path.startsWith(`${this.getProjectFolder()}/`) && !linked.path.includes("/Features/")) {
      return linked;
    }
    const name = this.getReferenceName(value).toLowerCase();
    if (!name) return null;
    return this.getReferenceFiles("project").find((file) => file.basename.toLowerCase() === name) || null;
  }
  findFeatureFile(value, projectFile, sourcePath = "") {
    const featureFolder = this.getFeatureFolderForProject(projectFile);
    const linked = this.findLinkedFile(value, sourcePath);
    if (linked instanceof import_obsidian4.TFile && linked.path.startsWith(`${featureFolder}/`)) {
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
      new import_obsidian4.Notice("Project name is required.");
      return null;
    }
    return { link: this.getNoteLink(file, sourcePath), file };
  }
  async resolveFeatureReference(value, projectFile, sourcePath) {
    if (!String(value || "").trim()) return "";
    if (!projectFile) {
      new import_obsidian4.Notice("Create or select a project before adding a feature.");
      return null;
    }
    const existing = this.findFeatureFile(value, projectFile, sourcePath);
    if (existing) return this.getNoteLink(existing, sourcePath);
    const name = this.getReferenceName(value);
    const file = await this.ensureReferenceFile(this.getFeatureFolderForProject(projectFile), name);
    if (!file) {
      new import_obsidian4.Notice("Feature name is required.");
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
    new import_obsidian4.Notice("Task deleted.");
    this.refreshViews();
    return true;
  }
  async updateTask(file, values) {
    const preparedValues = await this.prepareTaskReferences(values, file.path);
    if (!preparedValues) return false;
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
    new import_obsidian4.Notice("Task updated.");
    this.refreshViews();
    return true;
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
      new import_obsidian4.Notice(`Due soon: ${getTaskTitle(task)}`, 8e3);
      await this.app.fileManager.processFrontMatter(task.file, (frontmatter) => {
        frontmatter.notification_sent_for = frontmatter.due;
        frontmatter.notification_sent_at = nowIso();
      });
    }
  }
};
