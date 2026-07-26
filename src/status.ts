import { DONE_STATUS } from "./constants";

export function cleanStatus(value: unknown) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getStatusKey(value: unknown) {
  return cleanStatus(value).toLowerCase();
}

export function statusEquals(left: unknown, right: unknown) {
  return getStatusKey(left) === getStatusKey(right);
}

export function isDoneStatus(status: unknown) {
  return statusEquals(status, DONE_STATUS);
}

export function dedupeStatuses(statuses: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const status of statuses) {
    const cleaned = cleanStatus(status);
    const key = getStatusKey(cleaned);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
  }
  return result;
}
