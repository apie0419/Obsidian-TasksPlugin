import type { DropdownComponent } from "obsidian";

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sanitizeFileName(title: string) {
  return title
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFieldId(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function setDropdownOptions(dropdown: DropdownComponent, options: Array<[string, string]>) {
  dropdown.selectEl.empty();
  options.forEach(([value, label]) => dropdown.addOption(value, label));
}
