/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Tag helpers mutate Obsidian frontmatter records. */
function normalizeTag(tag) {
  return String(tag || "").trim().replace(/^#/, "");
}

export function getFrontmatterTags(frontmatter) {
  const tags = frontmatter && frontmatter.tags;
  if (Array.isArray(tags)) {
    return tags.map(normalizeTag).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
  }
  return [];
}

export function hasFrontmatterTag(frontmatter, tag) {
  const expected = normalizeTag(tag).toLowerCase();
  return getFrontmatterTags(frontmatter).some((item) => {
    const normalized = normalizeTag(item).toLowerCase();
    return normalized === expected || normalized.startsWith(`${expected}/`);
  });
}

export function ensureFrontmatterTag(frontmatter, tag) {
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag || hasFrontmatterTag(frontmatter, normalizedTag)) return;

  if (Array.isArray(frontmatter.tags)) {
    frontmatter.tags.push(normalizedTag);
    return;
  }

  if (typeof frontmatter.tags === "string" && frontmatter.tags.trim()) {
    frontmatter.tags = `${frontmatter.tags.trim()} ${normalizedTag}`;
    return;
  }

  frontmatter.tags = [normalizedTag];
}
