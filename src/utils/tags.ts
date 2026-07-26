type FrontmatterLike = Record<string, unknown>;

function normalizeTag(tag: unknown) {
  return String(tag || "").trim().replace(/^#/, "");
}

export function getFrontmatterTags(frontmatter: FrontmatterLike | null | undefined) {
  const tags = frontmatter && frontmatter.tags;
  if (Array.isArray(tags)) {
    return (tags as unknown[]).map(normalizeTag).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags.split(/[\s,]+/).map(normalizeTag).filter(Boolean);
  }
  return [];
}

export function hasFrontmatterTag(frontmatter: FrontmatterLike | null | undefined, tag: unknown) {
  const expected = normalizeTag(tag).toLowerCase();
  return getFrontmatterTags(frontmatter).some((item) => {
    const normalized = normalizeTag(item).toLowerCase();
    return normalized === expected || normalized.startsWith(`${expected}/`);
  });
}

export function ensureFrontmatterTag(frontmatter: FrontmatterLike, tag: unknown) {
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag || hasFrontmatterTag(frontmatter, normalizedTag)) return;

  const tags = frontmatter.tags;
  if (Array.isArray(tags)) {
    const nextTags = tags as unknown[];
    nextTags.push(normalizedTag);
    frontmatter.tags = nextTags;
    return;
  }

  if (typeof tags === "string" && tags.trim()) {
    frontmatter.tags = `${tags.trim()} ${normalizedTag}`;
    return;
  }

  frontmatter.tags = [normalizedTag];
}
