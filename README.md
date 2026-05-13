# KSeF Invoice Translator

KSeF Invoice Translator to MVP aplikacji SaaS dla polskich firm, ktore chca szybko zamieniac faktury KSeF FA(3) XML oraz wygenerowane PDF-y faktur na czytelne, profesjonalne tlumaczenia dla zagranicznych kontrahentow.

Aplikacja nie jest systemem ksiegowym, ERP ani narzedziem do wystawiania faktur. Nie laczy sie z KSeF, nie loguje uzytkownika do Ministerstwa Finansow i nie modyfikuje faktur. Jej zakres to:

- parsowanie faktury,
- normalizacja danych do wewnetrznego modelu,
- tlumaczenie etykiet i tresci opisowych,
- podglad faktury,
- eksport profesjonalnego PDF.

## Status Projektu

Aktualna wersja jest produkcyjnym MVP:

- Next.js 15 App Router,
- TypeScript,
- TailwindCSS,
- lokalne komponenty UI w stylu shadcn/ui,
- parser KSeF FA(3) XML,
- podstawowy parser PDF faktur KSeF,
- eksport PDF przez `pdfmake`,
- tlumaczenia statyczne + OpenAI dla wolnego tekstu,
- deploy gotowy pod Vercel.

Produkcja:

```text
https://ksef-invoice-translator.vercel.app
```

## Najwazniejsze Funkcje

- Upload faktur KSeF FA(3) XML.
- Upload PDF faktury KSeF i ekstrakcja tekstu, danych platnosci, zamowien, stopki oraz linku weryfikacyjnego, jezeli link jest obecny w tekscie PDF.
- Normalizacja danych do wspolnego modelu `Invoice`.
- Obsluga danych sprzedawcy, nabywcy, numeru faktury, dat, waluty, pozycji, stawek VAT, podsumowan, rachunkow bankowych, platnosci, zamowien, stopki, notatek i linku KSeF.
- Podglad faktury w interfejsie webowym.
- Eksport PDF jednojezyczny lub dwujezyczny.
- Kod QR i blok weryfikacyjny w PDF, jezeli faktura zawiera link do strony Ministerstwa Finansow.
- Dla XML FA(3) eksport PDF korzysta z vendored snapshotu oficjalnego generatora MF jako zrodla prawdy dla kolejnosci, warunkow i layoutu sekcji.
- Tlumaczenie etykiet z lokalnych slownikow.
- Tlumaczenie OpenAI tylko dla opisow pozycji, notatek i wolnego tekstu.

## Zasady Tlumaczen

Nie wolno tlumaczyc ani zmieniac:

- numerow faktur,
- NIP/VAT ID,
- numerow rejestrowych,
- IBAN,
- SWIFT,
- numerow kont bankowych,
- walut,
- dat,
- kwot,
- stawek VAT,
- procentow podatku.

Tlumaczeniu podlegaja:

- stale etykiety,
- naglowki tabel,
- nazwy sekcji,
- opisy towarow i uslug,
- notatki,
- stopki,
- instrukcje platnosci,
- jednostki miary, jezeli sa traktowane jako wolny tekst.

## Stack Technologiczny

- `Next.js 15`
- `TypeScript`
- `TailwindCSS`
- `fast-xml-parser`
- `zod`
- `lucide-react`
- `pdfmake`
- `qrcode`
- `pdf-parse`
- `OpenAI API`
- `Vercel`

## Struktura Projektu

```text
app/
  api/
    parse-pdf/route.ts     # parsowanie PDF po stronie server route
    pdf/route.ts           # generowanie PDF
    translate/route.ts     # tlumaczenia OpenAI
  globals.css
  layout.tsx
  page.tsx                 # glowny interfejs aplikacji

components/
  invoice-preview.tsx      # podglad faktury
  ui/                      # lokalne komponenty UI

lib/
  invoice/
    format.ts
    schema.ts              # walidacja i model domenowy
  pdf/
    invoice-pdfmake.ts     # fallbackowy/custom generator PDF
    parser.ts              # ekstrakcja danych z PDF
  mf-fa3/
    official-renderer.ts   # adapter do vendored generatora MF FA(3)
    sections.ts            # wspolna kolejnosc sekcji dla preview/fallbacku
  translation/
    dictionaries.ts        # statyczne slowniki etykiet
    engine.ts              # logika tlumaczen AI
    languages.ts           # konfiguracja jezykow
  xml/
    parser.ts              # mapper KSeF FA(3) XML -> Invoice

types/
  invoice.ts               # typy domenowe

sample-data/
  sample-fa3-invoice.xml   # bezpieczna probka do testow

vendor/
  ksef-pdf-generator/      # kontrolowany snapshot CIRFMF/ksef-pdf-generator
```

## Uruchomienie Lokalne

Wymagania:

- Node.js `20.19+` albo nowszy,
- npm,
- klucz OpenAI, jezeli maja dzialac tlumaczenia wolnego tekstu.

Instalacja:

```bash
npm install
```

Konfiguracja env:

```bash
cp .env.example .env.local
```

W `.env.local` ustaw:

```env
OPENAI_API_KEY=<your-openai-api-key>
OPENAI_TRANSLATION_MODEL=gpt-4.1-mini
```

Start lokalny:

```bash
npm run dev
```

Aplikacja bedzie dostepna pod:

```text
http://localhost:3000
```

Do szybkiego testu mozna uzyc:

```text
sample-data/sample-fa3-invoice.xml
```

## Komendy Developerskie

```bash
npm run dev
npm run typecheck
npm run build
```

Przed commitem warto uruchomic:

```bash
npm run typecheck
npm run build
```

## Deploy na Vercel

Projekt jest gotowy do deploya na Vercel.

W Vercel trzeba ustawic zmienne srodowiskowe:

```env
OPENAI_API_KEY=...
OPENAI_TRANSLATION_MODEL=gpt-4.1-mini
```

`OPENAI_API_KEY` powinien byc ustawiony jako sekret produkcyjny. Nie nalezy commitowac `.env.local`.

Deploy przez CLI:

```bash
npx vercel deploy --prod
```

## Co Przekazac Drugiemu Developerowi

Najlepsza konfiguracja do wspolpracy:

- dostep do repozytorium GitHub,
- link do projektu na Vercel,
- dostep do projektu Vercel jako czlonek zespolu,
- osobny klucz OpenAI albo dostep do sekretow przez Vercel,
- opis aktualnego zakresu MVP,
- przykladowe, zanonimizowane faktury XML/PDF do testow,
- informacja, ze prawdziwe faktury klientow nie powinny trafic do repo.

Minimalny pakiet dla developera:

```text
1. URL repozytorium GitHub
2. Instrukcja z README.md
3. .env.example
4. Dostep do Vercel lub lista wymaganych env variables
5. Zanonimizowane pliki testowe XML/PDF
6. Informacja, ktore obszary ma rozwijac
```

## Czego Nie Udostepniac

Nie wysylaj developerowi w mailu, na Slacku ani w repo:

- `.env.local`,
- prawdziwego `OPENAI_API_KEY`,
- prywatnych faktur klientow,
- niezanonimizowanych PDF/XML,
- katalogu `.vercel`,
- katalogu `.next`,
- `node_modules`,
- logow lokalnych,
- danych bankowych kontrahentow z realnych faktur,
- numerow NIP/IBAN z realnych dokumentow, jezeli nie sa potrzebne do testow.

Jezeli developer potrzebuje testow na prawdziwych strukturach, przygotuj pliki z podstawionymi danymi:

- fikcyjny NIP,
- fikcyjny IBAN,
- fikcyjne dane firm,
- fikcyjne kwoty,
- realna struktura XML bez realnych danych biznesowych.

## Obszary Do Rozwoju

Najwazniejsze miejsca w kodzie:

- XML FA(3): `lib/xml/parser.ts`
- PDF parsing: `lib/pdf/parser.ts`
- Model faktury: `types/invoice.ts`
- Walidacja: `lib/invoice/schema.ts`
- Slowniki etykiet: `lib/translation/dictionaries.ts`
- Lista jezykow: `lib/translation/languages.ts`
- Tlumaczenie AI: `lib/translation/engine.ts`
- Generator PDF: `lib/pdf/invoice-pdfmake.ts`
- UI aplikacji: `app/page.tsx`
- Podglad faktury: `components/invoice-preview.tsx`

## Priorytety Techniczne

Przy dalszym rozwoju trzymamy sie tych zasad:

- dla XML FA(3) zrodlem prawdy dla PDF jest `vendor/ksef-pdf-generator`, a `Invoice` sluzy do danych aplikacyjnych, tlumaczen i weryfikacji KSeF,
- bezposredni render z XML jest dopuszczony tylko w adapterze oficjalnego generatora MF FA(3); reszta aplikacji pracuje na `Invoice`,
- nie uzywamy AI do kwot, numerow, dat ani identyfikatorow,
- parser XML ma byc tolerancyjny na pola opcjonalne,
- PDF parsing traktujemy jako best effort,
- najwazniejszym formatem zrodlowym pozostaje XML FA(3),
- UI jest po polsku domyslnie, z opcja EN,
- faktura moze byc eksportowana jednojezycznie albo dwujezycznie.

## Znane Ograniczenia

- PDF parsing jest mniej deterministyczny niz XML, bo zalezy od tego, jak tekst zostal osadzony w pliku PDF.
- Bitmapowe kody QR wymagaja dodatkowego dekodowania obrazu, jezeli link nie wystepuje w warstwie tekstowej PDF.
- Nie wszystkie branzowe warianty FA(3) sa jeszcze pokryte testami.
- Aplikacja nie przechowuje faktur i nie ma bazy danych.
- Brak logowania, billingow i kont uzytkownikow zgodnie z zakresem MVP.

## Third-Party References

Eksport PDF i zakres sekcji byly inspirowane publicznym projektem Ministerstwa Finansow:

```text
https://github.com/CIRFMF/ksef-pdf-generator
```

Projekt `CIRFMF/ksef-pdf-generator` jest opublikowany na licencji MIT. Szczegoly sa w `THIRD_PARTY_NOTICES.md`.
