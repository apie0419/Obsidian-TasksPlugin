export const BASES_KANBAN_VIEW_TYPE = "frontmatterKanban";
export const DEFAULT_BASES_VIEW_FOLDER = "Views";
export const DEFAULT_KANBAN_BASE_FILE = "kanban.base";
export const DONE_STATUS = "done";
export const TASK_TAG = "tasks";

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
  statuses: [...BUILT_IN_STATUSES],
  createFormFields: {
    status: true,
    priority: true,
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
