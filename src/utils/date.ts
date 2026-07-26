type DateInput = Date | string | number | null | undefined;
type FrontmatterLike = Record<string, unknown>;

export function nowIso() {
  return new Date().toISOString();
}

export function formatTimestampForFileName(value: DateInput = new Date()) {
  const date = toDate(value) || new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 19).replace("T", " ").replace(/:/g, "-");
}

export function toDate(value: DateInput) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function formatDateTimeForInput(value: DateInput) {
  const date = toDate(value);
  if (!date) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function formatDateForInput(value: DateInput) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function formatDateLabel(value: DateInput) {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

export function readDateInputAsIso(value: DateInput) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export function dateOnly(value: DateInput) {
  const date = toDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function getWorkOnText(frontmatter: FrontmatterLike) {
  const start = String(frontmatter.work_start || "");
  const end = String(frontmatter.work_end || "");
  if (!start && !end) return "";
  if (start && end) return `${start} - ${end}`;
  return start || end;
}
