/* eslint-disable @typescript-eslint/no-unsafe-return -- Status values may come from user-authored frontmatter. */
import { DONE_STATUS } from "./constants";

export function cleanStatus(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getStatusKey(value) {
  return cleanStatus(value).toLowerCase();
}

export function statusEquals(left, right) {
  return getStatusKey(left) === getStatusKey(right);
}

export function isDoneStatus(status) {
  return statusEquals(status, DONE_STATUS);
}

export function dedupeStatuses(statuses) {
  const seen = new Set();
  const result = [];
  for (const status of statuses) {
    const cleaned = cleanStatus(status);
    const key = getStatusKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}
