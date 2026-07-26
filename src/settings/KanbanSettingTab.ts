import { ButtonComponent, DropdownComponent, Notice, PluginSettingTab, Setting, TextComponent } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import { FIELD_TYPES } from "../constants";
import { cleanStatus, statusEquals } from "../status";
import { getAllFieldDefinitions } from "../taskFields";
import { normalizeFieldId } from "../utils/text";

export class KanbanSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
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

  display() {
    const { containerEl } = this;
    this.renderSettings(containerEl);
  }

  renderSettings(containerEl) {
    containerEl.empty();
    containerEl.addClass("frontmatter-kanban-settings");

    new Setting(containerEl)
      .setName("TaskManagement")
      .setHeading();

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

    const addRow = containerEl.createDiv({ cls: "frontmatter-kanban-settings-add-row" });
    const input = new TextComponent(addRow).setPlaceholder("New status");
    new ButtonComponent(addRow)
      .setButtonText("Add status")
      .onClick(async () => {
        const status = cleanStatus(input.getValue());
        if (!status) {
          new Notice("Status is required.");
          return;
        }
        if (this.plugin.settings.statuses.some((item) => statusEquals(item, status))) {
          new Notice("Status already exists.");
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
      new Setting(section)
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
    const section = this.renderSection(container, "Custom fields", "Additional frontmatter fields");
    const list = section.createDiv({ cls: "frontmatter-kanban-settings-list" });
    for (const field of this.plugin.settings.customFields) {
      this.renderCustomFieldRow(list, field);
    }

    new Setting(section)
      .setName("Add field")
      .setHeading();
    const add = section.createDiv({ cls: "frontmatter-kanban-custom-field-editor" });
    const name = new TextComponent(add).setPlaceholder("Name");
    const type = new DropdownComponent(add);
    for (const fieldType of FIELD_TYPES) {
      type.addOption(fieldType, fieldType);
    }
    const options = new TextComponent(add).setPlaceholder("Select options, comma separated");
    const defaultValue = new TextComponent(add).setPlaceholder("Default value");
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
          defaultValue: defaultValue.getValue(),
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
    const defaultValue = new TextComponent(row)
      .setPlaceholder("Default value")
      .setValue(field.defaultValue || "");
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
        field.defaultValue = defaultValue.getValue();
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
