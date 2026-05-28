/**
 * Jednorazowy skrypt importu FAQ z faq_tlumaczksef_dla_agenta.md do Sanity.
 *
 * Użycie:
 *   SANITY_API_TOKEN=... npx tsx scripts/import-faq-to-sanity.ts
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

interface ParsedFaqItem {
  question: string;
  shortAnswer: string;
  fullAnswer: string;
  category: string;
  priority: string;
  tags: string[];
  section: string;
  order: number;
}

const PRIORITY_ORDER: Record<string, number> = { Wysoki: 1, Średni: 2, Niski: 3 };

function parseFaq(raw: string): ParsedFaqItem[] {
  const items: ParsedFaqItem[] = [];
  let currentCategory = "Inne";
  let globalOrder = 0;

  const blocks = raw.split(/^---$/m).map((b) => b.trim()).filter(Boolean);

  for (const block of blocks) {
    const lines = block.split("\n");

    // Detect category headers (## Heading) within the block
    for (const line of lines) {
      const catMatch = line.match(/^## (.+)/);
      if (catMatch && !catMatch[1].startsWith("Instrukcja") && !catMatch[1].startsWith("Stała")) {
        currentCategory = catMatch[1].trim();
      }
    }

    // Detect question (### heading)
    const questionMatch = block.match(/^### (.+)/m);
    if (!questionMatch) continue;

    const question = questionMatch[1].trim();

    const priorityMatch = block.match(/\*\*Priorytet:\*\*\s*(\S+)/);
    const sectionMatch = block.match(/\*\*Sekcja:\*\*\s*([^\n]+)/);
    const tagsMatch = block.match(/\*\*Tagi:\*\*\s*`([^`]+)`/);
    const shortMatch = block.match(/\*\*Krótka odpowiedź:\*\*\s*([^\n]+)/);
    const fullMatch = block.match(/\*\*Pełna odpowiedź:\*\*\s*([\s\S]+?)(?=\n\*\*|$)/);

    const priority = priorityMatch ? priorityMatch[1].trim() : "Średni";
    const section = sectionMatch ? sectionMatch[1].trim() : "FAQ / Pomoc";
    const tags = tagsMatch ? tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean) : [];
    const shortAnswer = shortMatch ? shortMatch[1].trim() : "";
    const fullAnswer = fullMatch ? fullMatch[1].trim() : shortAnswer;

    globalOrder++;
    const priorityBase = (PRIORITY_ORDER[priority] ?? 2) * 1000;

    items.push({
      question,
      shortAnswer,
      fullAnswer,
      category: currentCategory,
      priority,
      tags,
      section,
      order: priorityBase + globalOrder,
    });
  }

  return items;
}

async function main() {
  const filePath = path.join(process.cwd(), "faq_tlumaczksef_dla_agenta.md");
  const raw = fs.readFileSync(filePath, "utf-8");
  const items = parseFaq(raw);

  console.log(`Znaleziono ${items.length} pytań FAQ. Importuję...`);

  for (const item of items) {
    const doc = {
      _type: "faqItem",
      question: item.question,
      shortAnswer: item.shortAnswer,
      fullAnswer: item.fullAnswer,
      category: item.category,
      priority: item.priority,
      tags: item.tags,
      section: item.section,
      order: item.order,
    };

    await client.create(doc);
    console.log(`  ✓ [${item.category}] "${item.question.slice(0, 60)}..."`);
  }

  console.log("\nImport zakończony.");
}

main().catch((err) => {
  console.error("Błąd importu:", err);
  process.exit(1);
});
