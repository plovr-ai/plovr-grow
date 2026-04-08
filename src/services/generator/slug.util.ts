export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .trim();
  return slug || "restaurant";
}

export async function generateUniqueSlug(
  name: string,
  isAvailable: (slug: string) => Promise<boolean>
): Promise<string> {
  const base = slugify(name);
  if (await isAvailable(base)) return base;
  let suffix = 2;
  while (suffix <= 100) {
    const candidate = `${base}-${suffix}`;
    if (await isAvailable(candidate)) return candidate;
    suffix++;
  }
  return `${base}-${Date.now()}`;
}
