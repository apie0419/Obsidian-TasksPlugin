import { ButtonComponent, DropdownComponent, Notice, PluginSettingTab, Setting, TextComponent } from "obsidian";
import { FIELD_TYPES } from "../constants";
import { cleanStatus, statusEquals } from "../status";
import { getAllFieldDefinitions } from "../taskFields";
import { normalizeFieldId } from "../utils/text";

export class KanbanSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("frontmatter-kanban-settings");

    containerEl.createEl("h2", { text: "Kanban Board" });

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
