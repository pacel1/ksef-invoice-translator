# Landing Page Rebuild, Content First

**Status:** Content spec (structure + copy). Visual design is a separate phase that follows this one.
**Date:** 2026-06-09
**Scope:** The public landing page (`/` and its `/en` mirror). Content, structure, and final Polish copy only. No visual/design-system decisions here.

---

## 1. Why this exists

This is a ground-up rebuild, not a tweak of the current landing. We start from what the product actually does and design the highest-converting content for it. The visual redesign happens after this content is locked.

The product takes a Polish KSeF FA(3) invoice (XML, or a KSeF PDF) and produces a professional, readable version of it in the client's language. It preserves everything that must never change (numbers, NIP and VAT IDs, IBAN, amounts, dates, VAT rates) and translates only labels and free text (item descriptions, notes, payment terms, footers). The KSeF QR and verification block stay intact. Output can be single language or bilingual. It is not an accounting system, does not connect to KSeF, and requires no integration.

### Positioning insight (the spine of the page)

In KSeF, the legal invoice is the structured document inside the system. What you send anyone is a readable rendering of it, a "wizualizacja". So this product does not "change your invoice". It produces the foreign-language visualization of your KSeF invoice, with the source untouched and the QR kept so it stays verifiable. This framing is both the differentiator and the answer to the "is this even allowed?" fear.

---

## 2. Strategy (locked decisions)

| Decision | Choice | Why |
|---|---|---|
| Lead persona | Both (SMB exporter and accountant), anchored on the shared job | The job is identical for both: turn a KSeF invoice into a readable foreign version. Each persona still gets a "this is me" moment in Section 6. |
| Traffic and awareness | Problem-aware SEO **and** cold/mixed | Convert the ready fast, reassure and educate the unsure. The "wizualizacja, source untouched" line does the reassuring. |
| Message spine | Pain / status-quo led, resolving quickly to the promise | Hero names the painful chore, then relieves it. Emotionally resonant, especially for SMBs. |
| Primary proof | Live "upload your own invoice" demo, preview free, download gated behind a free signup | The most honest proof for a young product, and the conversion hinge in one move. |
| Supporting proof | Real, verifiable product facts only | MF schema fidelity, QR kept, EU data, 30-day deletion, VAT faktura. No invented testimonials, no inflated usage numbers. |
| Primary conversion goal | Free signup (1 invoice/month, no card), triggered at the demo download gate and the CTAs | Single most-wanted action. |

### Copy rules

- Polish first. EN parity at `/en` is produced from the same content (English strings are a follow-up, not drafted in this spec).
- No em or en dashes anywhere. Use commas, full stops, colons, or two sentences.
- Human, not AI-sounding. Short, direct sentences. Direct address ("Ty", "Twoja faktura"). Plain words.
- Every claim must be true. Pricing, languages, FA(3) support, data handling all match the product.

---

## 3. Page structure (nine sections)

Pain-led hero, then the demo as the centerpiece, then education and trust, then pricing and FAQ, then the final push.

1. Hero (pain to promise)
2. Live demo (upload your own, preview free, gated download)
3. Why the old way fails (Polish PDF / manual Word / Google Translate)
4. How it works (three steps)
5. What stays exact, what gets translated
6. Built for two (exporter and accountant lanes)
7. Pricing (no subscription)
8. FAQ (six on the page)
9. Final CTA and footer

---

## 4. Full copy

All copy below is final Polish. English glosses in parentheses are for review only and are not part of the page.

### Section 1, Hero

**Eyebrow:** `Faktura KSeF dla kontrahenta z zagranicy`
(KSeF invoice for a foreign client)

**Headline, two lines:**
> Znowu przepisujesz fakturę z KSeF do Worda, żeby klient z zagranicy ją zrozumiał?
> Już nie musisz.

(Retyping your KSeF invoice into Word again so a foreign client can read it? You don't have to anymore. The second line is set in the accent color.)

**Subline:**
> Wgrywasz fakturę z KSeF, a po kilku sekundach masz jej profesjonalną wersję w języku klienta. Nic nie przepisujesz ręcznie. Dokument źródłowy zostaje bez zmian: numery, kwoty i kod QR są nietknięte.

**CTAs:**
- Primary: `Przetłumacz swoją fakturę` (scrolls to the live demo)
- Secondary: `Zobacz na przykładzie` (loads the sample into the demo)

**Reassurance line:**
> Pierwsza faktura w miesiącu za darmo, bez karty. Dane w UE, kasujemy po 30 dniach.

### Section 2, Live demo

**Eyebrow:** `Demo na żywo`
**Heading:** Zobacz to na własnej fakturze.
**Sub:** Wgraj swój plik z KSeF (XML lub PDF) albo otwórz przykład. Wybierz język. Gotową wizualizację zobaczysz od razu.

**Widget behaviour:**
- Dropzone: `Przeciągnij plik XML lub PDF` plus a button `Otwórz przykładową fakturę`.
- The sample is clearly fictional (fake NIP, IBAN, company, amounts) so a cautious visitor who will not upload a real file still gets the aha.
- Language pills: EN, DE, FR, ES, IT, plus a "więcej" overflow for the rest.
- Live rendered preview of the translated visualization updates as the language changes.

**Download gate (conversion hinge):** button `Pobierz PDF` opens:
> Załóż darmowe konto, żeby pobrać. Pierwsza faktura w tym miesiącu jest za darmo.
> CTA: `Załóż konto i pobierz`

**Privacy line (shown at the demo, because they upload a real invoice):**
> Twój plik przetwarzamy w UE i kasujemy po 30 dniach. Nie używamy go do trenowania modeli. Faktura źródłowa w KSeF pozostaje nienaruszona.

### Section 3, Why the old way fails

**Eyebrow:** `Dlaczego nie wystarczy polski plik`
**Heading:** „Wyślę polską fakturę albo przetłumaczę w Google." Znamy to. I wiemy, czym się kończy.

Three pain to consequence beats:

1. **Wysyłasz polski PDF.** Klient nie wie, co podpisuje ani za co płaci. Zamiast zapłacić, odpisuje z pytaniami.
2. **Przepisujesz fakturę ręcznie w Wordzie.** Pół godziny przy jednym dokumencie i łatwo pomylić kwotę albo numer konta.
3. **Wrzucasz fakturę w Google Translate.** Przetłumaczy też to, czego ruszać nie wolno: kwoty, numery, NIP. Układ się sypie, a kod QR przepada.

**Resolution:**
> My tłumaczymy tylko język. Liczby, numery i kod QR zostają dokładnie tam, gdzie były.

### Section 4, How it works

**Eyebrow:** `Jak to działa`
**Heading:** Trzy kroki i faktura jest gotowa do wysłania.

1. **Wgraj fakturę z KSeF.** Plik XML albo PDF. Nie łączymy się z KSeF i nie logujemy Cię do Ministerstwa Finansów.
2. **Wybierz język klienta.** Angielski, niemiecki, francuski i kilkanaście innych. Możesz też zrobić wersję dwujęzyczną.
3. **Pobierz gotowy plik.** Profesjonalna wizualizacja faktury, gotowa, żeby wysłać ją mailem.

**Footnote:** Bez instalacji, bez integracji, bez umów.

### Section 5, What stays exact, what gets translated

**Eyebrow:** `Faktura zostaje fakturą`
**Heading:** Zmienia się tylko język. Reszta zostaje dokładnie taka sama.

**Zostaje bez zmian:** numery faktur, NIP i numery VAT, kwoty i sumy, daty, stawki VAT, IBAN i numery kont, kod QR z KSeF.

**Tłumaczymy:** nazwy pól i nagłówki, opisy towarów i usług, notatki i uwagi, warunki i instrukcje płatności, stopkę.

**Trust line:**
> Dlatego wynik nadal zgadza się z fakturą źródłową w KSeF i można go zweryfikować po kodzie QR.

### Section 6, Built for two

**Eyebrow:** `Dla kogo`
**Heading:** Działa tak samo dobrze, czy masz jedną fakturę, czy sto.

**Firma, eksporter**
> Prowadzisz firmę i sprzedajesz za granicę.
> Wystawiasz fakturę w KSeF, a klient dostaje czytelną wersję w swoim języku. Wyglądasz profesjonalnie i szybciej dostajesz zapłatę.

**Biuro rachunkowe**
> Prowadzisz biuro rachunkowe.
> Robisz obcojęzyczne wersje dla wielu klientów w kilka sekund. Bez abonamentu, płacisz tylko za to, co realnie tłumaczysz, a niewykorzystane pakiety się sumują.

### Section 7, Pricing

**Eyebrow:** `Cennik`
**Heading:** Płacisz tylko za faktury, które tłumaczysz.
**Sub:** Żadnego abonamentu. Pierwsza faktura w miesiącu jest za darmo. Im większy pakiet, tym taniej za sztukę.

- Pierwsza faktura w miesiącu za darmo, bez karty.
- Pakiety od 5 do 100 faktur.
- Cena spada z każdym większym pakietem, od 6,99 zł do 2,99 zł za fakturę.
- Niewykorzystane faktury nie przepadają.
- Do każdego zakupu dostajesz fakturę VAT.

**Note:** Ceny netto, VAT 23% dolicza się przy zakupie.
**CTA:** `Zobacz pełny cennik` (links to `/pricing`)

### Section 8, FAQ

Six questions on the page. The rest live on `/faq`.

1. **Czy tłumaczenie zastępuje fakturę z KSeF?**
Nie. Fakturą jest dokument w KSeF. To, co tworzymy, to jej czytelna wersja w języku klienta. Oryginał zostaje nienaruszony.
2. **Czy faktura z KSeF może być po angielsku albo niemiecku?**
Tak. Klient dostaje wersję w swoim języku, a oryginał dalej żyje w KSeF po polsku.
3. **Co z kodem QR?**
Zostaje. Dzięki niemu wizualizację da się powiązać z fakturą źródłową i zweryfikować.
4. **Muszę coś instalować albo integrować się z KSeF?**
Nie. Wgrywasz plik XML lub PDF i tyle. Nie łączymy się z KSeF i nie logujemy Cię do Ministerstwa Finansów.
5. **Czy dostanę fakturę VAT za zakup?**
Tak. Po każdym zakupie pakietu wysyłamy fakturę VAT mailem.
6. **Czy moje dane są bezpieczne?**
Pliki trzymamy w UE (Frankfurt) i kasujemy po 30 dniach. Nie używamy ich do trenowania modeli.

Spare questions for `/faq`: obsługa FA(1) i FA(2), Tłumacz KSeF kontra biuro tłumaczeń, tłumaczenie do odprawy celnej.

### Section 9, Final CTA and footer

**Heading:** Wgraj pierwszą fakturę i zobacz wynik.
**Sub:** Pierwsza w tym miesiącu jest za darmo. Bez karty, bez zobowiązań.
**CTA:** `Zacznij za darmo`

**Footer:** legal entity name, NIP, REGON, address. Links: Cennik, Bezpieczeństwo, FAQ, Blog, Regulamin, Polityka prywatności. Trust line: Dane w UE (Frankfurt). Płatności Stripe. Zgodność z RODO.

---

## 5. What this page deliberately does not include

- No testimonials or customer quotes until they are real and permissioned.
- No partner or vendor logo strip implying endorsement.
- No usage counters unless backed by a real, credible number.
- No claims of sworn or certified translation. The output is a business visualization, not a tłumaczenie przysięgłe.

---

## 6. Product facts the copy relies on (verify before launch)

- Pricing ladder: 5 = 6,99 zł, 10 to 20 = 5,99 zł, 25 to 45 = 4,99 zł, 50 to 95 = 3,99 zł, 100 = 2,99 zł, net, VAT 23% added at checkout, VAT faktura emailed per purchase.
- Free tier: 1 invoice per calendar month, no card, does not accumulate. Paid credits never expire.
- Languages: 20 plus, with EN, DE, FR, ES, IT featured.
- Formats: FA(3) XML and KSeF PDF. FA(1) and FA(2) are on the roadmap, not yet supported.
- Data: stored in Supabase Frankfurt (EU), deleted after 30 days, not used to train models, RODO compliant.
- QR: preserved when present in the source.

---

## 7. Open items

- English copy for the `/en` mirror, produced from this content.
- The live demo mechanic needs a technical design: anonymous upload, server-side render of the preview, gated download. Privacy and abuse handling for anonymous uploads. This is its own spec in the visual or implementation phase.
- The fictional sample invoice asset (XML or PDF with fake data) for the one-click demo path.
- Legal entity name, NIP, REGON, address for the footer.
- Confirm the MF FA(3) schema version label to reference, if any, on the page.

---

## 8. Next phase

After this content is approved, the next phase is the visual redesign (it does not have to reuse the current design system). That phase takes this locked content and structure as its input, decides the visual direction, and produces an implementation plan.
