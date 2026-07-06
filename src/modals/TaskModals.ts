import { ButtonComponent, DropdownComponent, Modal, Notice, Setting } from "obsidian";
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

export class EditTaskModal extends Modal {
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

export class CreateTaskModal extends Modal {
  constructor(app, plugin, initialValues = {}) {
    super(app);
    this.plugin = plugin;
    this.values = Object.assign({
      title: "",
      status: plugin.settings.statuses[0] || "backlog",
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
