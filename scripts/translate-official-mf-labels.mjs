import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";

const ROOT = process.cwd();
const OFFICIAL_PL_PATH = path.join(ROOT, "vendor/ksef-pdf-generator/src/lib-public/i18n/lang/pl.json");
const OUT_DIR = path.join(ROOT, "lib/mf-fa3/official-labels/generated");
const ENV_PATH = path.join(ROOT, ".env.local");

const LANGUAGES = {
  en: "English",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  nl: "Dutch",
  pt: "Portuguese",
  cs: "Czech",
  sk: "Slovak",
  hu: "Hungarian",
  ro: "Romanian",
  bg: "Bulgarian",
  hr: "Croatian",
  sl: "Slovenian",
  lt: "Lithuanian",
  lv: "Latvian",
  et: "Estonian",
  da: "Danish",
  sv: "Swedish",
  fi: "Finnish",
  no: "Norwegian",
  el: "Greek"
};

loadDotEnv(ENV_PATH);

const requestedLanguages = process.argv
  .find((arg) => arg.startsWith("--languages="))
  ?.replace("--languages=", "")
  .split(",")
  .map((language) => language.trim())
  .filter(Boolean) ?? Object.keys(LANGUAGES);

const model = process.env.OPENAI_LABEL_TRANSLATION_MODEL ?? process.env.OPENAI_TRANSLATION_MODEL ?? "gpt-4.1-mini";
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("OPENAI_API_KEY is required in the environment or .env.local.");
  process.exit(1);
}

const unknownLanguages = requestedLanguages.filter((language) => !(language in LANGUAGES));
if (unknownLanguages.length) {
  console.error(`Unsupported language code(s): ${unknownLanguages.join(", ")}`);
  process.exit(1);
}

const officialPl = JSON.parse(fs.readFileSync(OFFICIAL_PL_PATH, "utf8"));
const officialTexts = collectInvoiceTexts(officialPl);
const client = new OpenAI({ apiKey });

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const language of requestedLanguages) {
  const targetLanguage = LANGUAGES[language];
  console.log(`Translating ${Object.keys(officialTexts).length} MF labels to ${targetLanguage} (${language})...`);
  const translated = await translateLanguage(language, targetLanguage, officialTexts);
  const outPath = path.join(OUT_DIR, `${language}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(translated, null, 2)}\n`, "utf8");
  console.log(`Saved ${outPath}`);
}

async function translateLanguage(language, targetLanguage, entries) {
  const translated = {};
  const chunks = chunk(Object.entries(entries), 80);

  for (const [index, entriesChunk] of chunks.entries()) {
    console.log(`  chunk ${index + 1}/${chunks.length}`);
    const completion = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You translate fixed UI labels and legal/rule phrases for Polish KSeF invoice PDF visualizations. Return only a strict JSON object mapping the exact input keys to translated strings. Preserve placeholders such as {{index}} and {{currency}}, leading/trailing spaces, colons, punctuation, percent signs, line intent, abbreviations such as VAT, KSeF, JST, GV, OSS, WDT, UPO, SWIFT, IBAN, KRS, REGON, BDO, and legal article references. Translate TAK/NIE into the target language. Do not add explanations."
        },
        {
          role: "user",
          content: JSON.stringify({
            sourceLanguage: "Polish",
            targetLanguage,
            targetLanguageCode: language,
            entries: Object.fromEntries(entriesChunk)
          })
        }
      ]
    });

    const parsed = parseJsonObject(completion.choices[0]?.message.content);
    for (const [key, sourceValue] of entriesChunk) {
      translated[key] = typeof parsed[key] === "string" && parsed[key].trim() ? parsed[key] : sourceValue;
    }
  }

  return translated;
}

function collectInvoiceTexts(value, prefix = "", result = {}) {
  for (const [key, nestedValue] of Object.entries(value ?? {})) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      collectInvoiceTexts(nestedValue, currentPath, result);
    } else if (currentPath.startsWith("invoice.")) {
      result[currentPath] = String(nestedValue);
    }
  }
  return result;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}
