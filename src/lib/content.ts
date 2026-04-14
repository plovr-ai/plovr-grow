import fs from "fs";
import path from "path";
import matter from "gray-matter";

const CONTENT_DIR = path.join(process.cwd(), "src/content");

// ---------- Types ----------

interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: { name: string; role?: string };
  tags: string[];
  draft: boolean;
}

interface ReleaseFrontmatter {
  version: string;
  date: string;
  title: string;
  category: "feature" | "improvement" | "fix";
  highlights: string[];
  draft: boolean;
}

export interface BlogPost {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
}

export interface Release {
  slug: string;
  frontmatter: ReleaseFrontmatter;
  content: string;
}

// ---------- Helpers ----------

function readDir(subdir: string): string[] {
  const dir = path.join(CONTENT_DIR, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".mdx"));
}

function parseFile<T>(subdir: string, filename: string): { slug: string; frontmatter: T; content: string } {
  const filePath = path.join(CONTENT_DIR, subdir, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const slug = filename.replace(/\.mdx?$/, "");

  // Normalise date to string
  if (data.date instanceof Date) {
    data.date = data.date.toISOString();
  }

  return { slug, frontmatter: data as T, content };
}

// ---------- Blog ----------

export function getAllPosts(): BlogPost[] {
  const files = readDir("blog");
  const isProduction = process.env.NODE_ENV === "production";

  return files
    .map((f) => parseFile<BlogFrontmatter>("blog", f))
    .filter((p) => !(isProduction && p.frontmatter.draft))
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}

export function getPost(slug: string): BlogPost | undefined {
  return getAllPosts().find((p) => p.slug === slug);
}

// ---------- Releases ----------

export function getAllReleases(): Release[] {
  const files = readDir("releases");
  const isProduction = process.env.NODE_ENV === "production";

  return files
    .map((f) => parseFile<ReleaseFrontmatter>("releases", f))
    .filter((r) => !(isProduction && r.frontmatter.draft))
    .sort((a, b) => new Date(b.frontmatter.date).getTime() - new Date(a.frontmatter.date).getTime());
}
