export const BASES_KANBAN_VIEW_TYPE = "frontmatterKanban";
export const DEFAULT_KANBAN_BASE_FILE = "Kanban.base";
export const DONE_STATUS = "done";
export const TASK_TAG = "task";
export const LEGACY_TASK_TAG = "tasks";

export const BUILT_IN_STATUSES = ["backlog", "nextup", "ongoing", "done"];
export const PRIORITIES = ["high", "medium", "easy", "low"];
export const PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  easy: 1,
  low: 0
};

export const DEFAULT_SETTINGS = {
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

export const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "datetime",
  "date-range",
  "select",
  "checkbox"
];
