export const VIEW_TYPE_KANBAN = "frontmatter-kanban-board-view";
export const DONE_STATUS = "done";

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
