import { PRIORITY_WEIGHTS } from "./constants";
import { isDoneStatus } from "./status";
import { toDate } from "./utils/date";

export function getTaskTitle(task) {
  return task.frontmatter.title || task.file.basename;
}

export function getPriorityWeight(priority) {
  return PRIORITY_WEIGHTS[String(priority || "").toLowerCase()] || 0;
}

export function getNotificationLeadMs(frontmatter) {
  const rawAmount = frontmatter.notification_amount;
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") return null;
  const amount = Number(frontmatter.notification_amount);
  const unit = frontmatter.notification_unit;
  if (!Number.isFinite(amount) || amount < 0 || !unit) return null;
  if (unit === "minutes") return amount * 60 * 1000;
  if (unit === "hours") return amount * 60 * 60 * 1000;
  if (unit === "days") return amount * 24 * 60 * 60 * 1000;
  return null;
}

export function getDueClass(task) {
  if (isDoneStatus(task.frontmatter.status)) return "";
  const due = toDate(task.frontmatter.due);
  if (!due) return "";
  const diffMs = due.getTime() - Date.now();
  const diffDays = diffMs / (24 * 60 * 60 * 1000);
  if (diffDays <= 3) return "is-due-red";
  if (diffDays <= 7) return "is-due-yellow";
  return "";
}

export function getFieldValue(task, fieldId) {
  const fm = task.frontmatter;
  if (fieldId === "title") return getTaskTitle(task);
  if (fieldId === "status") return fm.status || "";
  if (fieldId === "priority") return fm.priority || "";
  if (fieldId === "priority_weight") return fm.priority_weight ?? getPriorityWeight(fm.priority);
  if (fieldId === "due") return fm.due || "";
  if (fieldId === "created") return fm.created || "";
  if (fieldId === "completed") return fm.completed || "";
  if (fieldId === "work_on") return {
    start: fm.work_start || "",
    end: fm.work_end || ""
  };
  if (fieldId === "notification") return {
    amount: fm.notification_amount ?? "",
    unit: fm.notification_unit ?? ""
  };
  const customField = task.pluginSettings && task.pluginSettings.customFields
    ? task.pluginSettings.customFields.find((field) => field.id === fieldId)
    : null;
  if (customField && customField.type === "date-range") {
    return {
      start: fm[`${fieldId}_start`] || "",
      end: fm[`${fieldId}_end`] || ""
    };
  }
  return fm[fieldId];
}

export function getFieldType(plugin, fieldId) {
  if (fieldId === "title") return "text";
  if (fieldId === "status") return "select";
  if (fieldId === "priority") return "priority";
  if (fieldId === "priority_weight") return "number";
  if (fieldId === "due") return "datetime";
  if (fieldId === "created") return "datetime";
  if (fieldId === "completed") return "datetime";
  if (fieldId === "work_on") return "date-range";
  if (fieldId === "notification") return "notification";
  const custom = plugin.settings.customFields.find((field) => field.id === fieldId);
  return custom ? custom.type : "text";
}

export function compareValues(type, a, b) {
  if (type === "priority") {
    return getPriorityWeight(a) - getPriorityWeight(b);
  }
  if (type === "notification") {
    return notificationValueToMs(a) - notificationValueToMs(b);
  }
  if (type === "number") {
    const left = Number(a);
    const right = Number(b);
    return (Number.isFinite(left) ? left : 0) - (Number.isFinite(right) ? right : 0);
  }
  if (type === "date" || type === "datetime") {
    const left = toDate(a);
    const right = toDate(b);
    return (left ? left.getTime() : 0) - (right ? right.getTime() : 0);
  }
  if (type === "date-range") {
    const left = toDate(a && a.start);
    const right = toDate(b && b.start);
    return (left ? left.getTime() : 0) - (right ? right.getTime() : 0);
  }
  if (type === "checkbox") {
    return Number(Boolean(a)) - Number(Boolean(b));
  }
  return String(a || "").localeCompare(String(b || ""));
}

export function notificationValueToMs(value) {
  if (!value || !value.amount || !value.unit) return 0;
  return getNotificationLeadMs({
    notification_amount: value.amount,
    notification_unit: value.unit
  }) || 0;
}

export function getBuiltInFields() {
  return [
    { id: "title", name: "Title", type: "text" },
    { id: "status", name: "Status", type: "select" },
    { id: "priority", name: "Priority", type: "priority" },
    { id: "priority_weight", name: "Priority weight", type: "number" },
    { id: "due", name: "Due date", type: "datetime" },
    { id: "created", name: "Create date", type: "datetime" },
    { id: "completed", name: "Complete date", type: "datetime" },
    { id: "work_on", name: "Work on", type: "date-range" },
    { id: "notification", name: "Notification", type: "notification" }
  ];
}

export function getAllFieldDefinitions(plugin) {
  return [...getBuiltInFields(), ...plugin.settings.customFields];
}

export function getOperatorsForType(type) {
  if (type === "number") {
    return [
      ["equals", "="],
      ["not_equals", "!="],
      ["greater_than", ">"],
      ["less_than", "<"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "date" || type === "datetime") {
    return [
      ["on", "on"],
      ["before", "before"],
      ["after", "after"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "date-range") {
    return [
      ["contains_date", "contains date"],
      ["overlaps", "overlaps"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "select" || type === "priority") {
    return [
      ["equals", "="],
      ["not_equals", "!="],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "checkbox") {
    return [
      ["equals", "is"],
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  if (type === "notification") {
    return [
      ["is_empty", "is empty"],
      ["not_empty", "is not empty"]
    ];
  }
  return [
    ["contains", "contains"],
    ["equals", "="],
    ["not_equals", "!="],
    ["is_empty", "is empty"],
    ["not_empty", "is not empty"]
  ];
}

export function isEmptyValue(value, type) {
  if (type === "date-range") {
    return !value || (!value.start && !value.end);
  }
  if (type === "notification") {
    return !value || (!value.amount && !value.unit);
  }
  return value === undefined || value === null || value === "";
}
