import { Notice, Plugin, TFile, normalizePath, stringifyYaml } from "obsidian";
import {
  BASES_KANBAN_VIEW_TYPE,
  DEFAULT_SETTINGS,
  DEFAULT_BASES_VIEW_FOLDER,
  DEFAULT_KANBAN_BASE_FILE,
  FIELD_TYPES,
} from "./constants";
import { buildKanbanBasesViewFactory } from "./bases/KanbanBasesView";
import { generateDefaultKanbanBase } from "./bases/defaultKanbanBase";
import { CreateTaskModal } from "./modals/TaskModals";
import { KanbanSettingTab } from "./settings/KanbanSettingTab";
import { cleanStatus, dedupeStatuses, isDoneStatus, statusEquals } from "./status";
import { getNotificationLeadMs, getPriorityWeight, getTaskTitle } from "./taskFields";
import { formatTimestampForFileName, nowIso, toDate } from "./utils/date";
import { clone, normalizeFieldId, sanitizeFileName } from "./utils/text";

export default class FrontmatterKanbanPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.registerBasesIntegration();

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
        this.syncPriorityWeights();
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.refreshViews())
    );
    this.registerInterval(window.setInterval(() => this.checkNotifications(), 60 * 1000));

    this.syncCompletionDates();
    this.syncPriorityWeights();
    this.checkNotifications();
  }

  async loadSettings() {
    const savedSettings = await this.loadData() || {};
    this.settings = Object.assign({}, clone(DEFAULT_SETTINGS), savedSettings);
    const statusSource = Array.isArray(savedSettings.statuses)
      ? savedSettings.statuses
      : DEFAULT_SETTINGS.statuses;
    this.settings.statuses = dedupeStatuses(statusSource);
    if (!this.settings.statuses.length) {
      this.settings.statuses = ["backlog"];
    }
    this.settings.customFields = (this.settings.customFields || []).map((field) => ({
      id: normalizeFieldId(field.id || field.name || ""),
      name: field.name || field.id || "",
      type: FIELD_TYPES.includes(field.type) ? field.type : "text",
      options: field.options || "",
      defaultValue: field.defaultValue ?? "",
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
    const file = await this.ensureKanbanBaseFile();
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.openFile(file);
    this.app.workspace.revealLeaf(leaf);
  }

  registerBasesIntegration() {
    if (typeof this.registerBasesView !== "function") {
      new Notice("Obsidian Bases API is not available. Please update Obsidian and enable the Bases core plugin.");
      return;
    }

    const registered = this.registerBasesView(BASES_KANBAN_VIEW_TYPE, {
      name: "Frontmatter Kanban",
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
      new Notice("Enable the Bases core plugin to use Frontmatter Kanban views.");
    }
  }

  getKanbanBasePath() {
    const folder = normalizePath(this.settings.taskFolder || "Tasks");
    return normalizePath(`${folder}/${DEFAULT_BASES_VIEW_FOLDER}/${DEFAULT_KANBAN_BASE_FILE}`);
  }

  async ensureKanbanBaseFile() {
    const path = this.getKanbanBasePath();
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;

    const folder = path.split("/").slice(0, -1).join("/");
    await this.ensureFolder(folder);
    return this.app.vault.create(path, generateDefaultKanbanBase());
  }

  refreshViews() {
    for (const leaf of this.app.workspace.getLeavesOfType("bases")) {
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

    const path = this.getNewTaskPath(folder, sanitizedTitle);

    const frontmatter = {
      kanban_task: true,
      title: values.title,
      status: values.status || this.settings.statuses[0] || "backlog",
      created: nowIso()
    };

    if (values.priority) {
      frontmatter.priority = values.priority;
      frontmatter.priority_weight = getPriorityWeight(values.priority);
    }
    if (values.due) frontmatter.due = values.due;
    if (values.work_start) frontmatter.work_start = values.work_start;
    if (values.work_end) frontmatter.work_end = values.work_end;
    if (values.notification_amount !== undefined && values.notification_amount !== "") {
      frontmatter.notification_amount = Number(values.notification_amount);
      frontmatter.notification_unit = values.notification_unit || "days";
    }

    if (isDoneStatus(frontmatter.status)) {
      frontmatter.completed = nowIso();
    }

    for (const field of this.settings.customFields) {
      if (field.type === "date-range") {
        if (values[`${field.id}_start`]) frontmatter[`${field.id}_start`] = values[`${field.id}_start`];
        if (values[`${field.id}_end`]) frontmatter[`${field.id}_end`] = values[`${field.id}_end`];
      } else if (field.type === "checkbox" && values[field.id] !== undefined && values[field.id] !== "") {
        frontmatter[field.id] = values[field.id] === true || values[field.id] === "true";
      } else if (values[field.id] !== undefined && values[field.id] !== "") {
        frontmatter[field.id] = field.type === "number" ? Number(values[field.id]) : values[field.id];
      }
    }

    const yaml = stringifyYaml(frontmatter).trim();
    await this.app.vault.create(path, `---\n${yaml}\n---\n\n# ${values.title}\n`);
    new Notice("Task created.");
    this.refreshViews();
  }

  getNewTaskPath(folder, sanitizedTitle) {
    const prefix = formatTimestampForFileName();
    const baseName = `${prefix} - ${sanitizedTitle}`;
    let path = normalizePath(`${folder}/${baseName}.md`);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${folder}/${baseName} ${counter}.md`);
      counter += 1;
    }
    return path;
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
      if (isDoneStatus(status)) {
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
      new Notice("Status is required.");
      return false;
    }
    if (!statusEquals(next, oldStatus) && this.settings.statuses.some((status) => statusEquals(status, next))) {
      new Notice("Status already exists.");
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

  async removeStatus(status) {
    if (this.settings.statuses.length <= 1) {
      new Notice("At least one status is required.");
      return false;
    }
    this.settings.statuses = this.settings.statuses.filter((item) => !statusEquals(item, status));
    await this.saveSettings();
    return true;
  }

  async updateTask(file, values) {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.kanban_task = true;
      frontmatter.title = values.title.trim();
      frontmatter.status = values.status || this.settings.statuses[0] || "backlog";

      if (values.priority) {
        frontmatter.priority = values.priority;
        frontmatter.priority_weight = getPriorityWeight(values.priority);
      } else {
        delete frontmatter.priority;
        delete frontmatter.priority_weight;
      }

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

      if (isDoneStatus(frontmatter.status)) {
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
          else frontmatter[field.id] = values[field.id] === true || values[field.id] === "true";
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
        const expectedWeight = task.frontmatter.priority ? getPriorityWeight(task.frontmatter.priority) : undefined;
        if (expectedWeight === undefined) {
          if (task.frontmatter.priority_weight === undefined) continue;
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

      new Notice(`Due soon: ${getTaskTitle(task)}`, 8000);
      await this.app.fileManager.processFrontMatter(task.file, (frontmatter) => {
        frontmatter.notification_sent_for = frontmatter.due;
        frontmatter.notification_sent_at = nowIso();
      });
    }
  }
}
