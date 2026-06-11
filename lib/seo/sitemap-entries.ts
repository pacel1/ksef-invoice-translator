import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

export interface BlogPostRef {
  slug: string;
  publishedAt?: string;
}

/** Public marketing paths that exist in both locales ("" = homepage). */
const MARKETING_PATHS = ["", "blog", "faq", "pricing", "privacy", "security", "terms"] as const;

function localePair(path: string): MetadataRoute.Sitemap[number] {
  const pl = path === "" ? `${SITE_URL}/` : `${SITE_URL}/${path}`;
  const en = path === "" ? `${SITE_URL}/en` : `${SITE_URL}/en/${path}`;
  return {
    url: pl,
    changeFrequency: path === "" || path === "blog" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.7,
    alternates: { languages: { pl, en } }
  };
}

function blogPostEntry(post: BlogPostRef): MetadataRoute.Sitemap[number] {
  const publishedAt = post.publishedAt ? new Date(post.publishedAt) : undefined;
  const lastModified =
    publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : undefined;
  return {
    url: `${SITE_URL}/blog/${post.slug.trim()}`,
    ...(lastModified ? { lastModified } : {}),
    changeFrequency: "monthly",
    priority: 0.6
  };
}

export function buildSitemapEntries(posts: BlogPostRef[]): MetadataRoute.Sitemap {
  const staticEntries = MARKETING_PATHS.map(localePair);
  const postEntries = posts
    .filter((post) => typeof post?.slug === "string" && post.slug.trim().length > 0)
    .map(blogPostEntry);
  return [...staticEntries, ...postEntries];
}
