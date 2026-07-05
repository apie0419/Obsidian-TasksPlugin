import { resolveDateFilterValue } from "./dateFilters";
import { dateOnly, toDate } from "./utils/date";
import { getFieldType, getFieldValue, isEmptyValue } from "./taskFields";

export function matchesFilter(task, filter, plugin) {
  const type = getFieldType(plugin, filter.field);
  const value = getFieldValue(task, filter.field);

  if (filter.operator === "is_empty") return isEmptyValue(value, type);
  if (filter.operator === "not_empty") return !isEmptyValue(value, type);

  if (type === "number") {
    const left = Number(value);
    const right = Number(filter.value);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (filter.operator === "equals") return left === right;
    if (filter.operator === "not_equals") return left !== right;
    if (filter.operator === "greater_than") return left > right;
    if (filter.operator === "less_than") return left < right;
    return false;
  }

  if (type === "date" || type === "datetime") {
    const left = toDate(value);
    const right = resolveDateFilterValue(filter);
    if (!left || !right) return false;
    if (filter.operator === "on") return dateOnly(left) === dateOnly(right);
    if (filter.operator === "before") return left.getTime() < right.getTime();
    if (filter.operator === "after") return left.getTime() > right.getTime();
    return false;
  }

  if (type === "date-range") {
    const start = toDate(value && value.start);
    const end = toDate(value && value.end);
    if (filter.operator === "contains_date") {
      const target = resolveDateFilterValue(filter);
      if (!target || (!start && !end)) return false;
      const targetTime = target.getTime();
      const startTime = start ? start.getTime() : Number.NEGATIVE_INFINITY;
      const endTime = end ? end.getTime() : Number.POSITIVE_INFINITY;
      return targetTime >= startTime && targetTime <= endTime;
    }
    if (filter.operator === "overlaps") {
      const filterStart = toDate(filter.valueStart);
      const filterEnd = toDate(filter.valueEnd);
      if ((!start && !end) || (!filterStart && !filterEnd)) return false;
      const leftStart = start ? start.getTime() : Number.NEGATIVE_INFINITY;
      const leftEnd = end ? end.getTime() : Number.POSITIVE_INFINITY;
      const rightStart = filterStart ? filterStart.getTime() : Number.NEGATIVE_INFINITY;
      const rightEnd = filterEnd ? filterEnd.getTime() : Number.POSITIVE_INFINITY;
      return leftStart <= rightEnd && rightStart <= leftEnd;
    }
    return false;
  }

  if (type === "checkbox") {
    const expected = filter.value === "true";
    if (filter.operator === "equals") return Boolean(value) === expected;
    return false;
  }

  const left = String(value || "").toLowerCase();
  const right = String(filter.value || "").toLowerCase();
  if (filter.operator === "contains") return left.includes(right);
  if (filter.operator === "equals") return left === right;
  if (filter.operator === "not_equals") return left !== right;
  return false;
}
