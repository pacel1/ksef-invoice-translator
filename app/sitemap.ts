import type { MetadataRoute } from "next";
import { client, isSanityConfigured } from "@/sanity/lib/client";
import { SITEMAP_POSTS_QUERY } from "@/sanity/lib/queries";
import { buildSitemapEntries, type BlogPostRef } from "@/lib/seo/sitemap-entries";

export const revalidate = 3600;

async function fetchBlogPosts(): Promise<BlogPostRef[]> {
  if (!isSanityConfigured) return [];
  try {
    const posts = await client.fetch<BlogPostRef[]>(SITEMAP_POSTS_QUERY);
    return Array.isArray(posts) ? posts : [];
  } catch (error) {
    console.error("sitemap: failed to fetch blog posts from Sanity", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await fetchBlogPosts();
  return buildSitemapEntries(posts);
}
