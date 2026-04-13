import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { siteConfig } from "@/config/site";
import { getAllPosts, getPost } from "@/lib/content";
import { ArticleLayout } from "@/components/website/sections/ArticleLayout";
import { Prose } from "@/components/website/ui/Prose";
import { CTACard } from "@/components/website/sections/CTACard";

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) {
    return { title: `Not Found — ${siteConfig.name}` };
  }

  return {
    title: `${post.frontmatter.title} — ${siteConfig.name}`,
    description: post.frontmatter.description,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <ArticleLayout
        title={post.frontmatter.title}
        description={post.frontmatter.description}
        date={post.frontmatter.date}
        author={post.frontmatter.author}
      >
        <Prose>
          <MDXRemote source={post.content} />
        </Prose>
      </ArticleLayout>
      <CTACard />
    </>
  );
}
