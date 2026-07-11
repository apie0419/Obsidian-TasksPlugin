import { ButtonComponent, DropdownComponent, Modal, Notice, Setting, SuggestModal } from "obsidian";
import { PRIORITIES } from "../constants";
import { getTaskTitle } from "../taskFields";
import { formatDateForInput, formatDateTimeForInput, readDateInputAsIso } from "../utils/date";

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
  const value = field.defaultValue ?? "";
  if (value === "") return undefined;
  if (field.type === "checkbox") return parseCheckboxValue(value);
  if (field.type === "number") return Number.isFinite(Number(value)) ? Number(value) : undefined;
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

const MONTH_LABELS = [
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
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  return Boolean(left && right
    && left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate());
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

class DatePickerModal extends Modal {
  constructor(app, options) {
    super(app);
    this.titleText = options.title;
    this.includeTime = Boolean(options.includeTime);
    this.onApply = options.onApply;
    this.selectedDate = parsePickerDate(options.value);
    const seed = this.selectedDate || new Date();
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

    const today = new Date();
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
      const nextToday = new Date();
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
        new Notice("Select a date first.");
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
}

class ReferenceNoteSuggestModal extends SuggestModal {
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
      return file.basename.toLowerCase().includes(normalizedQuery)
        || file.path.toLowerCase().includes(normalizedQuery);
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
}

function renderReferenceSetting(modal, container, label, key, sourcePath = "") {
  const setting = new Setting(container).setName(label);
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

  new ButtonComponent(setting.controlEl)
    .setButtonText(`Add ${label.toLowerCase()}`)
    .setIcon("link")
    .onClick(() => {
      if (key === "feature" && !String(modal.values.project || "").trim()) {
        new Notice("Create or select a project before adding a feature.");
        return;
      }

      const files = modal.plugin.getReferenceFiles(key, modal.values.project, sourcePath);
      if (!files.length) {
        const folder = modal.plugin.getReferenceFolder(key, modal.values.project, sourcePath);
        new Notice(folder ? `No Markdown notes found in ${folder}.` : "No Markdown notes found.");
        return;
      }

      new ReferenceNoteSuggestModal(modal.app, modal.plugin, key, sourcePath, modal.values.project, (link) => {
        modal.values[key] = link;
        input.value = getReferenceDisplayValue(modal.plugin, link);
      }).open();
    });

  new ButtonComponent(setting.controlEl)
    .setIcon("x")
    .setTooltip("Clear")
    .onClick(() => {
      modal.values[key] = "";
      input.value = "";
    });
}

export class EditTaskModal extends Modal {
  constructor(app, plugin, task) {
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
      notification_amount: fm.notification_amount ?? "",
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
    this.renderTaskInfo(contentEl);

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
    new ButtonComponent(footer)
      .setButtonText("Delete")
      .setIcon("trash-2")
      .setWarning()
      .setClass("frontmatter-kanban-delete-button")
      .onClick(async () => {
        const deleted = await this.plugin.deleteTask(this.task.file);
        if (deleted) this.close();
      });
    new ButtonComponent(footer)
      .setButtonText("Cancel")
      .onClick(() => this.close());
    new ButtonComponent(footer)
      .setButtonText("Open note")
      .onClick(() => {
        this.close();
        this.plugin.openTaskFile(this.task.file);
      });
    new ButtonComponent(footer)
      .setButtonText("Save")
      .setCta()
      .onClick(async () => {
        if (!this.values.title.trim()) {
          new Notice("Task title is required.");
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
    const setting = new Setting(container).setName(label);
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
    const setting = new Setting(container).setName(label);
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

export class CreateTaskModal extends Modal {
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
        if (range.start && this.values[`${field.id}_start`] === undefined) this.values[`${field.id}_start`] = range.start;
        if (range.end && this.values[`${field.id}_end`] === undefined) this.values[`${field.id}_end`] = range.end;
        continue;
      }

      const defaultValue = getDefaultFieldValue(field);
      if (defaultValue !== undefined && this.values[field.id] === undefined) {
        this.values[field.id] = defaultValue;
      }
    }
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
        const created = await this.plugin.createTask(this.values);
        if (created) this.close();
      });
  }

  renderDateTimeSetting(container, label, key) {
    const setting = new Setting(container).setName(label);
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
    const setting = new Setting(container).setName(label);
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
