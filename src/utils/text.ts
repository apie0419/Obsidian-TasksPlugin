export function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function sanitizeFileName(title) {
  return title
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeFieldId(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function setDropdownOptions(dropdown, options) {
  dropdown.selectEl.empty();
  options.forEach(([value, label]) => dropdown.addOption(value, label));
}
