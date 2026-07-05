import { toDate } from "./utils/date";

export const DATE_FILTER_MODES = [
  ["fixed", "Exact"],
  ["relative", "Relative"],
  ["formula", "Formula"]
];

export const RELATIVE_DATE_UNITS = [
  ["minutes", "minutes"],
  ["hours", "hours"],
  ["days", "days"],
  ["weeks", "weeks"],
  ["months", "months"],
  ["years", "years"]
];

export const RELATIVE_DATE_DIRECTIONS = [
  ["ago", "ago"],
  ["from_now", "from now"]
];

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfWeek(date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const distanceFromMonday = (day + 6) % 7;
  next.setDate(next.getDate() - distanceFromMonday);
  return next;
}

function endOfWeek(date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 6);
  return endOfDay(next);
}

function startOfMonth(date) {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
}

function endOfMonth(date) {
  const next = startOfMonth(date);
  next.setMonth(next.getMonth() + 1);
  next.setDate(0);
  return endOfDay(next);
}

function startOfYear(date) {
  const next = startOfDay(date);
  next.setMonth(0, 1);
  return next;
}

function endOfYear(date) {
  const next = startOfYear(date);
  next.setFullYear(next.getFullYear() + 1);
  next.setDate(0);
  return endOfDay(next);
}

function normalizeFormulaToken(value) {
  return String(value || "").toLowerCase().replace(/[\s_-]+/g, "");
}

function resolveFormulaBase(token, now) {
  const normalized = normalizeFormulaToken(token);
  if (normalized === "now") return new Date(now);
  if (normalized === "today") return startOfDay(now);
  if (normalized === "tomorrow") {
    const next = startOfDay(now);
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (normalized === "yesterday") {
    const next = startOfDay(now);
    next.setDate(next.getDate() - 1);
    return next;
  }
  if (normalized === "startofweek") return startOfWeek(now);
  if (normalized === "endofweek") return endOfWeek(now);
  if (normalized === "startofmonth") return startOfMonth(now);
  if (normalized === "endofmonth") return endOfMonth(now);
  if (normalized === "startofyear") return startOfYear(now);
  if (normalized === "endofyear") return endOfYear(now);
  return null;
}

function normalizeUnit(unit) {
  const normalized = normalizeFormulaToken(unit);
  if (["m", "min", "mins", "minute", "minutes"].includes(normalized)) return "minutes";
  if (["h", "hr", "hrs", "hour", "hours"].includes(normalized)) return "hours";
  if (["d", "day", "days"].includes(normalized)) return "days";
  if (["w", "week", "weeks"].includes(normalized)) return "weeks";
  if (["mo", "mon", "month", "months"].includes(normalized)) return "months";
  if (["y", "yr", "yrs", "year", "years"].includes(normalized)) return "years";
  return "";
}

export function addDateUnit(date, amount, unit) {
  const next = new Date(date);
  if (unit === "minutes") next.setMinutes(next.getMinutes() + amount);
  if (unit === "hours") next.setHours(next.getHours() + amount);
  if (unit === "days") next.setDate(next.getDate() + amount);
  if (unit === "weeks") next.setDate(next.getDate() + amount * 7);
  if (unit === "months") next.setMonth(next.getMonth() + amount);
  if (unit === "years") next.setFullYear(next.getFullYear() + amount);
  return next;
}

export function resolveRelativeDate(amount, unit, direction, now = new Date()) {
  const parsedAmount = Number(amount);
  const normalizedUnit = normalizeUnit(unit || "days");
  if (!Number.isFinite(parsedAmount) || parsedAmount < 0 || !normalizedUnit) return null;
  const signedAmount = direction === "ago" ? -parsedAmount : parsedAmount;
  return addDateUnit(now, signedAmount, normalizedUnit);
}

export function resolveDateFormula(expression, now = new Date()) {
  const raw = String(expression || "").trim();
  if (!raw) return null;

  const direct = toDate(raw);
  if (direct) return direct;

  const baseMatch = raw.match(/^(now|today|tomorrow|yesterday|start[\s_-]*of[\s_-]*week|end[\s_-]*of[\s_-]*week|start[\s_-]*of[\s_-]*month|end[\s_-]*of[\s_-]*month|start[\s_-]*of[\s_-]*year|end[\s_-]*of[\s_-]*year)\b/i);
  if (!baseMatch) return null;

  let date = resolveFormulaBase(baseMatch[1], now);
  if (!date) return null;

  let rest = raw.slice(baseMatch[0].length);
  while (rest.trim()) {
    const offsetMatch = rest.match(/^\s*([+-])\s*(\d+(?:\.\d+)?)\s*([a-zA-Z]+)\b/);
    if (!offsetMatch) return null;
    const sign = offsetMatch[1] === "-" ? -1 : 1;
    const amount = Number(offsetMatch[2]) * sign;
    const unit = normalizeUnit(offsetMatch[3]);
    if (!unit) return null;
    date = addDateUnit(date, amount, unit);
    rest = rest.slice(offsetMatch[0].length);
  }

  return date;
}

export function getDateFilterMode(filter) {
  if (filter.dateMode === "relative" || filter.dateMode === "formula") return filter.dateMode;
  return "fixed";
}

export function resolveDateFilterValue(filter) {
  const mode = getDateFilterMode(filter);
  if (mode === "relative") {
    return resolveRelativeDate(
      filter.relativeAmount ?? 0,
      filter.relativeUnit || "days",
      filter.relativeDirection || "from_now"
    );
  }
  if (mode === "formula") {
    return resolveDateFormula(filter.formula || filter.value);
  }
  return toDate(filter.value);
}
