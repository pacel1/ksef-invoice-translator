/**
 * Jednorazowy skrypt importu artykułów z artykuly_blog_tlumaczksef.md do Sanity.
 *
 * Użycie:
 *   SANITY_API_TOKEN=... npx tsx scripts/import-blog-to-sanity.ts
 *
 * Wymaga zmiennych środowiskowych:
 *   NEXT_PUBLIC_SANITY_PROJECT_ID
 *   NEXT_PUBLIC_SANITY_DATASET (domyślnie "production")
 *   SANITY_API_TOKEN (token z uprawnieniami editor/write)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@sanity/client";

const client = createClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET ?? "production",
  apiVersion: "2024-01-01",
  token: process.env.SANITY_API_TOKEN!,
  useCdn: false,
});

interface ParsedArticle {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  bodyMarkdown: string;
}

function parseArticles(raw: string): ParsedArticle[] {
  const blocks = raw.split(/^---$/m).map((b) => b.trim()).filter(Boolean);
  const articles: ParsedArticle[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    const h1Match = lines.find((l) => /^# \d+\./.test(l));
    if (!h1Match) continue;

    const title = h1Match.replace(/^# \d+\.\s*/, "").trim();

    const metaTitleMatch = block.match(/\*\*Meta title:\*\*\s*(.+)/);
    const metaDescMatch = block.match(/\*\*Meta description:\*\*\s*(.+)/);
    const slugMatch = block.match(/\*\*Proponowany URL:\*\*\s*\/blog\/([^\s\n]+)/);

    const metaTitle = metaTitleMatch ? metaTitleMatch[1].trim() : title;
    const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : "";
    const slug = slugMatch ? slugMatch[1].trim() : title.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

    // Body: strip the H1 and metadata lines, take from the first ## onwards
    const bodyStart = block.indexOf("\n## ");
    const bodyMarkdown = bodyStart !== -1 ? block.slice(bodyStart).trim() : "";

    // Excerpt: first paragraph of body
    const firstParaMatch = bodyMarkdown.match(/\n\n([^#\n][^\n]{20,})/);
    const excerpt = firstParaMatch ? firstParaMatch[1].slice(0, 200).trim() : metaDescription;

    articles.push({ title, slug, metaTitle, metaDescription, excerpt, bodyMarkdown });
  }

  return articles;
}

function markdownToBlocks(markdown: string): unknown[] {
  const lines = markdown.split("\n");
  const blocks: unknown[] = [];
  let listItems: string[] = [];
  let inList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({
        _type: "block",
        _key: `list-${Date.now()}-${Math.random()}`,
        style: "normal",
        listItem: "bullet",
        level: 1,
        children: listItems.map((text) => ({
          _type: "span",
          _key: `span-${Math.random()}`,
          text,
          marks: [],
        })),
        markDefs: [],
      });
      listItems = [];
      inList = false;
    }
  };

  for (const line of lines) {
    const h2 = line.match(/^## (.+)/);
    const h3 = line.match(/^### (.+)/);
    const bullet = line.match(/^[-*] (.+)/);
    const cta = line.match(/^\*\*CTA:\*\* (.+)/);

    if (h2) {
      flushList();
      blocks.push({
        _type: "block",
        _key: `h2-${Math.random()}`,
        style: "h2",
        children: [{ _type: "span", _key: `span-${Math.random()}`, text: h2[1], marks: [] }],
        markDefs: [],
      });
    } else if (h3) {
      flushList();
      blocks.push({
        _type: "block",
        _key: `h3-${Math.random()}`,
        style: "h3",
        children: [{ _type: "span", _key: `span-${Math.random()}`, text: h3[1], marks: [] }],
        markDefs: [],
      });
    } else if (bullet) {
      listItems.push(bullet[1]);
      inList = true;
    } else if (cta) {
      flushList();
      blocks.push({
        _type: "block",
        _key: `cta-${Math.random()}`,
        style: "normal",
        children: [{ _type: "span", _key: `span-${Math.random()}`, text: `➡ ${cta[1]}`, marks: ["strong"] }],
        markDefs: [],
      });
    } else if (line.trim() === "") {
      if (inList) flushList();
    } else if (line.trim() && !line.startsWith("**Meta") && !line.startsWith("# ")) {
      flushList();
      blocks.push({
        _type: "block",
        _key: `p-${Math.random()}`,
        style: "normal",
        children: [{ _type: "span", _key: `span-${Math.random()}`, text: line.trim(), marks: [] }],
        markDefs: [],
      });
    }
  }
  flushList();
  return blocks;
}

async function main() {
  const filePath = path.join(process.cwd(), "artykuly_blog_tlumaczksef.md");
  const raw = fs.readFileSync(filePath, "utf-8");
  const articles = parseArticles(raw);

  console.log(`Znaleziono ${articles.length} artykułów. Importuję...`);

  for (const article of articles) {
    const doc = {
      _type: "post",
      title: article.title,
      slug: { _type: "slug", current: article.slug },
      publishedAt: new Date().toISOString(),
      excerpt: article.excerpt,
      body: markdownToBlocks(article.bodyMarkdown),
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
    };

    await client.create(doc);
    console.log(`  ✓ "${article.title}" → /blog/${article.slug}`);
  }

  console.log("\nImport zakończony.");
}

main().catch((err) => {
  console.error("Błąd importu:", err);
  process.exit(1);
});
