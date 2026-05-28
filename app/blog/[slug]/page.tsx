import { BlogPostPage } from "@/components/marketing/blog-post-page";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { ALL_SLUGS_QUERY, POST_BY_SLUG_QUERY } from "@/sanity/lib/queries";
import type { Metadata } from "next";

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  if (!isSanityConfigured) return [];
  const slugs: { slug: string }[] = await client.fetch(ALL_SLUGS_QUERY);
  return slugs.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isSanityConfigured) return {};
  const { slug } = await params;
  const post = await client.fetch(POST_BY_SLUG_QUERY, { slug });
  if (!post) return {};
  return {
    title: post.metaTitle ?? post.title,
    description: post.metaDescription ?? post.excerpt ?? undefined,
  };
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params;
  return <BlogPostPage locale="pl" slug={slug} />;
}
