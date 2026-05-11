# KSeF Invoice Translator

Production-oriented MVP for transforming Polish KSeF FA(3) XML invoices into human-readable multilingual invoice previews and PDF exports for international contractors.

This is not accounting, ERP, bookkeeping, invoicing, or KSeF integration software. It only parses, translates free text, renders, and exports.

## Features

- Upload KSeF FA(3) XML invoices.
- Upload rendered KSeF invoice PDFs and extract invoice text, payment data, orders, footer, and KSeF verification links when present in PDF text.
- Normalize XML into an internal `Invoice` model before rendering.
- Parse invoice number, dates, currency, parties, VAT IDs, addresses, line items, totals, payment details, bank accounts, orders, footer, verification link, and notes.
- Translate fixed labels from static dictionaries.
- Translate only free text with OpenAI: item descriptions and notes.
- Preserve invoice numbers, VAT IDs, dates, currencies, IBAN/SWIFT, amounts, and VAT rates.
- Preview invoices in a clean responsive layout.
- Generate professional PDF exports with bilingual mode and KSeF verification QR blocks when a verification link is available.
- Support European language configuration in `lib/translation/languages.ts`.

## Tech Stack

- Next.js 15 App Router
- TypeScript
- TailwindCSS
- shadcn-style local UI primitives
- `fast-xml-parser`
- `zod`
- `lucide-react`
- `pdfmake`
- OpenAI API

## Project Structure

```text
app/
  api/parse-pdf/route.ts
  api/pdf/route.ts
  api/translate/route.ts
  page.tsx
components/
lib/
  invoice/
  pdf/
  translation/
  xml/
types/
sample-data/
```

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and upload `sample-data/sample-fa3-invoice.xml`.

OpenAI is optional for local demos. Without `OPENAI_API_KEY`, fixed labels still translate and item descriptions remain unchanged.

## Deployment

1. Push the repository to GitHub.
2. Import the project into Vercel.
3. Set `OPENAI_API_KEY` and optionally `OPENAI_TRANSLATION_MODEL`.
4. Deploy.

Use Node `20.19+` or `22.13+` for the cleanest dependency engine compatibility.

## Extension Points

- Add or refine static label translations in `lib/translation/dictionaries.ts`.
- Add languages in `lib/translation/languages.ts` and the `LanguageCode` union.
- Improve FA(3) field mappings in `lib/xml/parser.ts`.
- Improve PDF extraction in `lib/pdf/parser.ts`; bitmap-only QR codes still require image QR decoding if the verification URL is not embedded as text.

## Third-Party References

The PDF export layout and section coverage are informed by the public
[`CIRFMF/ksef-pdf-generator`](https://github.com/CIRFMF/ksef-pdf-generator)
project, which is published under the MIT License.
