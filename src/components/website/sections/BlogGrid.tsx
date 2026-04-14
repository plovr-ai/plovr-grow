import Link from "next/link";
import { Section } from "@/components/website/ui/Section";
import { Container } from "@/components/website/ui/Container";
import type { BlogPost } from "@/lib/content";

interface BlogGridProps {
  posts: BlogPost[];
}

const formatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function BlogGrid({ posts }: BlogGridProps) {
  return (
    <Section variant="default">
      <Container>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-ws-border bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="aspect-[16/9] bg-gradient-to-br from-ws-primary-100 via-ws-primary-50 to-ws-primary-200" />
              <div className="flex flex-1 flex-col p-6">
                <div className="text-xs font-semibold uppercase tracking-wider text-ws-primary-600">
                  {formatter.format(new Date(post.frontmatter.date))}
                </div>
                <h3 className="mt-2 font-[family-name:var(--font-manrope)] text-xl font-bold group-hover:text-ws-primary-600">
                  {post.frontmatter.title}
                </h3>
                <p className="mt-3 flex-1 text-sm text-ws-text-muted">
                  {post.frontmatter.description}
                </p>
                <div className="mt-6 text-sm font-medium text-ws-text">
                  {post.frontmatter.author.name}
                  {post.frontmatter.author.role && (
                    <span className="text-ws-text-muted">
                      {" "}
                      &middot; {post.frontmatter.author.role}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </Section>
  );
}
