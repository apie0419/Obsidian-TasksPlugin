export const BASES_KANBAN_VIEW_TYPE = "frontmatterKanban";
export const BASES_TIMELINE_VIEW_TYPE = "frontmatterTimeline";
export const ROOT_FOLDER = "TaskManagement";
export const TASK_FOLDER = `${ROOT_FOLDER}/Tasks`;
export const VIEWS_FOLDER = `${ROOT_FOLDER}/Views`;
export const PROJECT_FOLDER = `${ROOT_FOLDER}/Projects`;
export const FEATURE_FOLDER = `${PROJECT_FOLDER}/Features`;
export const DEFAULT_KANBAN_BASE_FILE = `${VIEWS_FOLDER}/Kanban.base`;
export const DEFAULT_TIMELINE_BASE_FILE = `${VIEWS_FOLDER}/Timeline.base`;
export const DONE_STATUS = "done";
export const TASK_TAG = "task";
export const LEGACY_TASK_TAG = "tasks";

export const BUILT_IN_STATUSES = ["backlog", "nextup", "ongoing", "done"];
export const PRIORITIES = ["high", "medium", "low"];
export const PRIORITY_WEIGHTS = {
  high: 3,
  medium: 2,
  low: 1
};

export const DEFAULT_SETTINGS = {
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

export const FIELD_TYPES = [
  "text",
  "number",
  "date",
  "datetime",
  "date-range",
  "select",
  "checkbox"
];
