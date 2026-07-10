import { Notice, Plugin, TFile, normalizePath, stringifyYaml } from "obsidian";
import {
  BASES_KANBAN_VIEW_TYPE,
  DEFAULT_SETTINGS,
  DEFAULT_KANBAN_BASE_FILE,
  FEATURE_FOLDER,
  FIELD_TYPES,
  LEGACY_TASK_TAG,
  PROJECT_FOLDER,
  ROOT_FOLDER,
  TASK_FOLDER,
  TASK_TAG,
  VIEWS_FOLDER,
} from "./constants";
import { buildKanbanBasesViewFactory } from "./bases/KanbanBasesView";
import { generateDefaultKanbanBase } from "./bases/defaultKanbanBase";
import { CreateTaskModal } from "./modals/TaskModals";
import { KanbanSettingTab } from "./settings/KanbanSettingTab";
import { cleanStatus, dedupeStatuses, isDoneStatus, statusEquals } from "./status";
import { getNotificationLeadMs, getPriorityWeight, getTaskTitle } from "./taskFields";
import { formatTimestampForFileName, nowIso, toDate } from "./utils/date";
import { ensureFrontmatterTag, hasFrontmatterTag } from "./utils/tags";
import { clone, normalizeFieldId, sanitizeFileName } from "./utils/text";

export default class FrontmatterKanbanPlugin extends Plugin {
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

    this.derivedFieldSyncRunning = new Set();
    this.registerEvent(
      this.app.metadataCache.on("changed", (file) => {
        this.scheduleRefreshViews();
        this.syncDerivedFieldsForFile(file).catch((error) => console.error("Failed to sync task fields", error));
      })
    );
    this.registerEvent(
      this.app.vault.on("delete", () => this.refreshViews())
    );
    this.registerInterval(window.setInterval(() => this.checkNotifications(), 60 * 1000));

    await this.ensureStorageFolders();
    await this.ensureKanbanBaseFile();
    await this.migrateLegacyTaskTags();
    this.syncDerivedFields();
    this.checkNotifications();
  }

  async loadStyles() {
    const styleId = `${this.manifest.id}-managed-styles`;
    document.getElementById(styleId)?.remove();

    const stylePath = normalizePath(`${this.manifest.dir || ""}/styles.css`);
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
      new Notice("Obsidian Bases API is not available. Please update Obsidian and enable the Bases core plugin.");
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
          default: 380,
          min: 280,
          max: 560,
          step: 20
        }
      ]
    });

    if (!registered) {
      new Notice("Enable the Bases core plugin to use Kanban Board views.");
    }
  }

  getKanbanBasePath() {
    return DEFAULT_KANBAN_BASE_FILE;
  }

  async ensureKanbanBaseFile() {
    const path = this.getKanbanBasePath();
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
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
        `filters:\n  and:\n    - note.tags.contains("${TASK_TAG}")`
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
    if (
      nextContents.includes(`note.tags.contains("${TASK_TAG}")`)
      && !nextContents.includes("file.path.startsWith(")
      && !nextContents.includes("file.folder")
    ) {
      nextContents = nextContents.replace(
        new RegExp(`(\\s+- note\\.tags\\.contains\\("${TASK_TAG}"\\))`),
        `$1\n${taskFolderFilter}`
      );
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
    if (!(file instanceof TFile) || file.extension !== "md" || !this.isFileInTaskFolder(file)) {
      return false;
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache && cache.frontmatter;
    return this.isTaskFrontmatter(frontmatter);
  }

  escapeBaseString(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
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
      const frontmatter = Object.assign({}, (cache && cache.frontmatter) || {});
      delete frontmatter.position;
      return { file, frontmatter, pluginSettings: this.settings };
    });
  }

  async createTask(values) {
    const folder = this.getTaskFolder();
    await this.ensureFolder(folder);

    const taskTitle = String(values.title || "").trim();
    if (!taskTitle) {
      new Notice("Task title is required.");
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
    if (preparedValues.notification_amount !== undefined && preparedValues.notification_amount !== "") {
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
      } else if (field.type === "checkbox" && preparedValues[field.id] !== undefined && preparedValues[field.id] !== "") {
        frontmatter[field.id] = preparedValues[field.id] === true || preparedValues[field.id] === "true";
      } else if (preparedValues[field.id] !== undefined && preparedValues[field.id] !== "") {
        frontmatter[field.id] = field.type === "number" ? Number(preparedValues[field.id]) : preparedValues[field.id];
      }
    }

    const yaml = stringifyYaml(frontmatter).trim();
    await this.createMarkdownFile(path, `---\n${yaml}\n---\n\n# ${preparedValues.title}\n`);
    new Notice("Task created.");
    this.scheduleRefreshViews();
    return true;
  }

  getTaskFileBaseName(title, timestamp = new Date()) {
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
    const basename = String(file?.basename || "");
    const titledTimestamp = basename.match(/^.+\s+\((\d{4}-\d{2}-\d{2}(?:[ T]\d{2}[-:]\d{2}(?:[-:]\d{2})?)?)\)$/);
    if (titledTimestamp) return titledTimestamp[1];

    const leadingTimestamp = basename.match(/^(\d{4}-\d{2}-\d{2}(?:[ T]\d{2}[-:]\d{2}(?:[-:]\d{2})?)?)\s+-\s+.+$/);
    if (leadingTimestamp) return leadingTimestamp[1];

    return frontmatter.created || file?.stat?.ctime || new Date();
  }

  getUniqueTaskPath(folder, baseName, currentPath = "") {
    let path = normalizePath(`${folder}/${baseName}.md`);
    let counter = 2;
    while (path !== currentPath && this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${folder}/${baseName} ${counter}.md`);
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
    const normalized = normalizePath(folderPath);
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
          if (created instanceof TFile) {
            throw new Error(`Cannot create folder "${current}" because a file already exists at that path.`);
          }
          if (!created) throw error;
        }
      } else if (existing instanceof TFile) {
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
    if (existing instanceof TFile) return existing;
    if (existing) {
      throw new Error(`Cannot create file "${path}" because another item already exists at that path.`);
    }

    try {
      return await this.app.vault.create(path, contents);
    } catch (error) {
      const created = this.app.vault.getAbstractFileByPath(path);
      if (created instanceof TFile) return created;
      throw error;
    }
  }

  async createUniqueMarkdownFile(folder, sanitizedName, contents) {
    let path = normalizePath(`${folder}/${sanitizedName}.md`);
    let counter = 2;
    while (this.app.vault.getAbstractFileByPath(path)) {
      path = normalizePath(`${folder}/${sanitizedName} ${counter}.md`);
      counter += 1;
    }
    return this.createMarkdownFile(path, contents);
  }

  async ensureReferenceFile(folder, name) {
    const sanitizedName = sanitizeFileName(name);
    if (!sanitizedName) return null;

    await this.ensureFolder(folder);
    const path = normalizePath(`${folder}/${sanitizedName}.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    if (existing) {
      return this.createUniqueMarkdownFile(folder, sanitizedName, `# ${name}\n`);
    }

    return this.createMarkdownFile(path, `# ${name}\n`);
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
      new Notice("At least one status is required.");
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
      return this.app.vault.getMarkdownFiles()
        .filter((file) => file.path.startsWith(`${featureFolder}/`))
        .sort((left, right) => left.basename.localeCompare(right.basename));
    }

    const folder = this.getProjectFolder();
    return this.app.vault.getMarkdownFiles()
      .filter((file) => !folder || file.path === folder || file.path.startsWith(`${folder}/`))
      .filter((file) => !file.path.includes("/Features/"))
      .sort((left, right) => left.basename.localeCompare(right.basename));
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
    return normalizePath(`${FEATURE_FOLDER}/${sanitizeFileName(projectFile.basename)}`);
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
    if (linked instanceof TFile && linked.path.startsWith(`${this.getProjectFolder()}/`) && !linked.path.includes("/Features/")) {
      return linked;
    }

    const name = this.getReferenceName(value).toLowerCase();
    if (!name) return null;
    return this.getReferenceFiles("project")
      .find((file) => file.basename.toLowerCase() === name) || null;
  }

  findFeatureFile(value, projectFile, sourcePath = "") {
    const featureFolder = this.getFeatureFolderForProject(projectFile);
    const linked = this.findLinkedFile(value, sourcePath);
    if (linked instanceof TFile && linked.path.startsWith(`${featureFolder}/`)) {
      return linked;
    }

    const name = this.getReferenceName(value).toLowerCase();
    if (!name) return null;
    return this.getReferenceFiles("feature", this.getNoteLink(projectFile, sourcePath), sourcePath)
      .find((file) => file.basename.toLowerCase() === name) || null;
  }

  async resolveProjectReference(value, sourcePath) {
    if (!String(value || "").trim()) return { link: "", file: null };

    const existing = this.findProjectFile(value, sourcePath);
    if (existing) return { link: this.getNoteLink(existing, sourcePath), file: existing };

    const name = this.getReferenceName(value);
    const file = await this.ensureReferenceFile(this.getProjectFolder(), name);
    if (!file) {
      new Notice("Project name is required.");
      return null;
    }
    return { link: this.getNoteLink(file, sourcePath), file };
  }

  async resolveFeatureReference(value, projectFile, sourcePath) {
    if (!String(value || "").trim()) return "";
    if (!projectFile) {
      new Notice("Create or select a project before adding a feature.");
      return null;
    }

    const existing = this.findFeatureFile(value, projectFile, sourcePath);
    if (existing) return this.getNoteLink(existing, sourcePath);

    const name = this.getReferenceName(value);
    const file = await this.ensureReferenceFile(this.getFeatureFolderForProject(projectFile), name);
    if (!file) {
      new Notice("Feature name is required.");
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

    new Notice("Task deleted.");
    this.refreshViews();
    return true;
  }

  async updateTask(file, values) {
    const preparedValues = await this.prepareTaskReferences(values, file.path);
    if (!preparedValues) return false;
    const currentFrontmatter = Object.assign({}, this.app.metadataCache.getFileCache(file)?.frontmatter || {});

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

      if (preparedValues.notification_amount !== undefined && preparedValues.notification_amount !== "") {
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
          if (preparedValues[field.id] === undefined) delete frontmatter[field.id];
          else frontmatter[field.id] = preparedValues[field.id] === true || preparedValues[field.id] === "true";
          continue;
        }

        if (preparedValues[field.id] !== undefined && preparedValues[field.id] !== "") {
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
        new Notice("Task updated, but the file could not be renamed.");
        this.refreshViews();
        return false;
      }
    }

    new Notice("Task updated.");
    this.refreshViews();
    return true;
  }

  async syncDerivedFieldsForFile(file) {
    if (!(file instanceof TFile) || file.extension !== "md") return;
    if (this.derivedFieldSyncRunning.has(file.path)) return;

    if (!this.isFileInTaskFolder(file)) return;

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache && cache.frontmatter;
    if (!this.isTaskFrontmatter(frontmatter)) return;

    const shouldSetCompleted = isDoneStatus(frontmatter.status) && !frontmatter.completed;
    const shouldClearCompleted = frontmatter.status && !isDoneStatus(frontmatter.status) && frontmatter.completed;
    const expectedWeight = frontmatter.priority ? getPriorityWeight(frontmatter.priority) : undefined;
    const shouldSetPriorityWeight = expectedWeight !== undefined && Number(frontmatter.priority_weight) !== expectedWeight;
    const shouldClearPriorityWeight = expectedWeight === undefined && frontmatter.priority_weight !== undefined;
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
