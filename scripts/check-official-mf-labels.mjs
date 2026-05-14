import fs from "node:fs";

const officialPl = JSON.parse(fs.readFileSync("vendor/ksef-pdf-generator/src/lib-public/i18n/lang/pl.json", "utf8"));
const labelsSource = fs.readFileSync("lib/mf-fa3/official-labels.ts", "utf8");
const generatedDir = "lib/mf-fa3/official-labels/generated";
const languages = [
  "en",
  "de",
  "fr",
  "es",
  "it",
  "nl",
  "pt",
  "cs",
  "sk",
  "hu",
  "ro",
  "bg",
  "hr",
  "sl",
  "lt",
  "lv",
  "et",
  "da",
  "sv",
  "fi",
  "no",
  "el"
];

function collectInvoiceKeys(value, prefix = "", result = []) {
  for (const [key, nestedValue] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
      collectInvoiceKeys(nestedValue, path, result);
    } else if (path.startsWith("invoice.")) {
      result.push(path);
    }
  }
  return result;
}

const officialKeys = collectInvoiceKeys(officialPl);
const mappedKeys = new Set([...labelsSource.matchAll(/"(invoice\.[^"]+)"\s*:/g)].map((match) => match[1]));
const missing = officialKeys.filter((key) => !mappedKeys.has(key));

if (missing.length) {
  console.error(`Missing official MF label mappings: ${missing.length}/${officialKeys.length}`);
  console.error(missing.join("\n"));
  process.exit(1);
}

console.log(`Official MF label mappings complete: ${officialKeys.length}/${officialKeys.length}`);

const generatedFailures = [];

for (const language of languages) {
  const filePath = `${generatedDir}/${language}.json`;
  if (!fs.existsSync(filePath)) {
    generatedFailures.push(`${language}: missing generated file`);
    continue;
  }

  const generated = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const missingGenerated = officialKeys.filter((key) => typeof generated[key] !== "string" || !generated[key].trim());
  const exampleText = officialKeys.filter((key) => generated[key]?.includes("ExampleText"));

  if (missingGenerated.length) {
    generatedFailures.push(`${language}: missing translations ${missingGenerated.length}/${officialKeys.length}`);
  }
  if (exampleText.length) {
    generatedFailures.push(`${language}: contains ExampleText in ${exampleText.length} keys`);
  }
}

if (generatedFailures.length) {
  console.error("Generated official MF label translations are incomplete:");
  console.error(generatedFailures.join("\n"));
  process.exit(1);
}

console.log(`Generated official MF label translations complete: ${languages.length} languages x ${officialKeys.length} keys`);
