import { describe, expect, it } from "vitest";
import pdfParse from "pdf-parse";
import type { Invoice } from "@/types/invoice";
import {
  applyAppFreeTextToOfficialXml,
  localizeOfficialBooleanTexts,
  parseOfficialFa3Xml,
  renderOfficialFa3Pdf
} from "@/lib/mf-fa3/official-renderer";
import { getOfficialTextOverrides } from "@/lib/mf-fa3/official-labels";
import { parseKsefXml } from "@/lib/xml/parser";

describe("official FA(3) renderer fragment substitution", () => {
  it("substitutes translated correction and attachment fragments by XML path", () => {
    const correctionSourceXml = correctionXml();
    const correctionParsed = parseKsefXml(correctionSourceXml);
    expect(correctionParsed.ok).toBe(true);
    if (!correctionParsed.ok) return;

    const correctionFragment = correctionParsed.invoice.translationFragments?.find(
      (fragment) => fragment.kind === "correction_reason"
    );
    expect(correctionFragment).toBeTruthy();
    const correctionInvoice: Invoice = {
      ...correctionParsed.invoice,
      translationFragments: [{ ...correctionFragment!, translated: "incorrect VAT rate" }]
    };
    const correctionFaktura = parseOfficialFa3Xml(correctionSourceXml);
    applyAppFreeTextToOfficialXml(correctionFaktura, correctionInvoice, false);
    expect(textAtPath(correctionFaktura, correctionFragment!.xmlPath)).toBe("incorrect VAT rate");

    const attachmentSourceXml = attachmentXml();
    const attachmentParsed = parseKsefXml(attachmentSourceXml);
    expect(attachmentParsed.ok).toBe(true);
    if (!attachmentParsed.ok) return;

    const attachmentFragments = ["attachment_key", "attachment_table_description", "attachment_column_header", "attachment_table_cell", "attachment_summary_cell"]
      .map((kind) => attachmentParsed.invoice.translationFragments?.find((fragment) => fragment.kind === kind))
      .filter((fragment): fragment is NonNullable<typeof fragment> => Boolean(fragment));
    expect(attachmentFragments).toHaveLength(5);

    const attachmentInvoice: Invoice = {
      ...attachmentParsed.invoice,
      translationFragments: attachmentFragments.map((fragment, index) => ({
        ...fragment,
        translated: `translated fragment ${index + 1}`
      }))
    };
    const attachmentFaktura = parseOfficialFa3Xml(attachmentSourceXml);
    applyAppFreeTextToOfficialXml(attachmentFaktura, attachmentInvoice, false);

    attachmentInvoice.translationFragments?.forEach((fragment) => {
      expect(textAtPath(attachmentFaktura, fragment.xmlPath)).toBe(fragment.translated);
    });
  });
});

describe("official FA(3) renderer static text overrides", () => {
  it("provides translated Podmiot3 role values for the app bundle", () => {
    const german = getOfficialTextOverrides("de");
    const english = getOfficialTextOverrides("en");
    const french = getOfficialTextOverrides("fr");

    expect(german["const.fa.additionalBuyer"]).toContain("Weiterer Kaufer");
    expect(german["const.fa.additionalBuyer"]).not.toContain("Dodatkowy nabywca");
    expect(english["const.fa.additionalBuyer"]).toContain("Additional buyer");
    expect(english["const.fa.additionalBuyer"]).not.toContain("Dodatkowy nabywca");
    expect(french["const.fa.additionalBuyer"]).toContain("Acheteur supplementaire");
    expect(french["const.fa.additionalBuyer"]).not.toContain("Dodatkowy nabywca");
  });

  it("covers all supported languages for Podmiot3 role dictionary values", () => {
    supportedLanguages.forEach((language) => {
      const overrides = getOfficialTextOverrides(language);

      subject3RoleKeys.forEach((key) => {
        expect(overrides[key], `${language} ${key}`).toBeTruthy();
        expect(overrides[key], `${language} ${key}`).not.toContain("Dodatkowy nabywca");
        expect(overrides[key], `${language} ${key}`).not.toContain("w przypadku");
      });
    });
  });

  it("covers all supported languages for TypKorekty dictionary values", () => {
    supportedLanguages.forEach((language) => {
      const overrides = getOfficialTextOverrides(language);

      correctionTypeKeys.forEach((key) => {
        expect(overrides[key], `${language} ${key}`).toBeTruthy();
        expect(overrides[key], `${language} ${key}`).not.toContain("Korekta skutku");
        expect(overrides[key], `${language} ${key}`).not.toContain("faktury pierwotnej");
      });
    });
  });

  it("covers all supported languages for FA(3) official dictionary values", () => {
    supportedLanguages.forEach((language) => {
      const overrides = getOfficialTextOverrides(language);

      officialFa3DictionaryKeys.forEach((key) => {
        const value = overrides[key];
        expect(value, `${language} ${key}`).toBeTruthy();
        polishDictionaryResidues.forEach((residue) => {
          expect(value, `${language} ${key}`).not.toContain(residue);
        });
      });
    });
  });

  it("localizes official boolean leaves generated as Polish Tak/Nie", () => {
    const docDefinition = {
      content: [
        {
          table: {
            body: [
              [{ text: "Stan przed" }, { text: "Tak" }],
              [{ text: "Stan przed" }, { text: "Nie" }]
            ]
          }
        }
      ]
    };

    localizeOfficialBooleanTexts({ docDefinition, getBuffer: () => undefined }, "de");

    expect(JSON.stringify(docDefinition)).toContain("Ja");
    expect(JSON.stringify(docDefinition)).toContain("Nein");
    expect(JSON.stringify(docDefinition)).not.toContain("\"Tak\"");
    expect(JSON.stringify(docDefinition)).not.toContain("\"Nie\"");
  });

  it("renders French Podmiot3 role and StanPrzed without Polish fallback text", async () => {
    const sourceXml = staticOfficialTextXml();
    const parsed = parseKsefXml(sourceXml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const pdf = await renderOfficialFa3Pdf({
      sourceXml,
      invoice: parsed.invoice,
      language: "fr",
      bilingual: false,
      translated: true
    });
    const text = (await pdfParse(pdf)).text;

    expect(text).toContain("Acheteur supplementaire");
    expect(text).toContain("Oui");
    expect(text).not.toContain("Dodatkowy nabywca");
    expect(text).not.toContain("Tak");
  });

  it("renders Spanish TypKorekty without Polish fallback text", async () => {
    const sourceXml = correctionEffectXml();
    const parsed = parseKsefXml(sourceXml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const pdf = await renderOfficialFa3Pdf({
      sourceXml,
      invoice: parsed.invoice,
      language: "es",
      bilingual: false,
      translated: true
    });
    const text = normalizePdfText((await pdfParse(pdf)).text);

    expect(text).toContain("Correccion efectiva en la fecha de registro de la factura original");
    expect(text).not.toContain("Korekta skutku");
    expect(text).not.toContain("faktury pierwotnej");
  });

  it("renders Spanish official FA(3) dictionaries without Polish fallback text", async () => {
    const sourceXml = officialDictionaryXml();
    const parsed = parseKsefXml(sourceXml);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const pdf = await renderOfficialFa3Pdf({
      sourceXml,
      invoice: parsed.invoice,
      language: "es",
      bilingual: false,
      translated: true
    });
    const text = normalizePdfText((await pdfParse(pdf)).text);

    expect(text).toContain("Autoridad de ejecucion");
    expect(text).toContain("Liquidacion");
    expect(text).toContain("Transporte maritimo");
    expect(text).toContain("Burbuja");
    expect(text).toContain("creditos monet");
    expect(text).toContain("Exento");
    polishDictionaryResidues.forEach((residue) => {
      expect(text).not.toContain(residue);
    });
  });
});

const supportedLanguages = [
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
] as const;

const subject3RoleKeys = [
  "const.fa.factor",
  "const.fa.recipient",
  "const.fa.primaryEntity",
  "const.fa.additionalBuyer",
  "const.fa.invoiceIssuer",
  "const.fa.payer",
  "const.fa.localGovernmentIssuer",
  "const.fa.localGovernmentRecipient",
  "const.fa.vatGroupIssuer",
  "const.fa.vatGroupRecipient",
  "const.fa.employee"
] as const;

const correctionTypeKeys = [
  "const.farr.correctionOriginalDate",
  "const.farr.correctionInvoiceDate",
  "const.fa.correctionOtherDate"
] as const;

const officialFa3DictionaryKeys = [
  ...subject3RoleKeys,
  ...correctionTypeKeys,
  "const.fa.enforcementAuthority",
  "const.fa.courtBailiff",
  "const.fa.taxRepresentative",
  "const.fa.liquidation",
  "const.fa.restructuring",
  "const.fa.bankruptcy",
  "const.fa.inheritedBusiness",
  "const.fa.cash",
  "const.fa.card",
  "const.fa.voucher",
  "const.fa.check",
  "const.fa.credit",
  "const.fa.transfer",
  "const.fa.mobile",
  "const.fa.seaTransport",
  "const.fa.railTransport",
  "const.fa.roadTransport",
  "const.fa.airTransport",
  "const.fa.postalShipment",
  "const.fa.fixedPipeline",
  "const.fa.inlandNavigation",
  "const.fa.bubble",
  "const.fa.barrel",
  "const.fa.cylinder",
  "const.fa.carton",
  "const.fa.canister",
  "const.fa.cage",
  "const.fa.container",
  "const.fa.basket",
  "const.fa.punnet",
  "const.fa.bulkPackage",
  "const.fa.package",
  "const.fa.packet",
  "const.fa.pallet",
  "const.fa.bin",
  "const.fa.bulkSolidContainer",
  "const.fa.bulkLiquidContainer",
  "const.fa.box",
  "const.fa.tin",
  "const.fa.crate",
  "const.fa.bag",
  "const.fa.ownAccountSettlement",
  "const.fa.ownAccountCollection",
  "const.fa.ownAccountInternal",
  "const.fa.taxRate0KR",
  "const.fa.taxRate0WDT",
  "const.fa.taxRate0EX",
  "const.fa.zw",
  "const.fa.oo",
  "const.fa.taxRateNpI",
  "const.fa.taxRateNpII"
] as const;

const polishDictionaryResidues = [
  "Dodatkowy nabywca",
  "w przypadku",
  "Korekta skutku",
  "faktury pierwotnej",
  "Organ egzekucyjny",
  "Komornik",
  "Przedstawiciel podatkowy",
  "Stan likwidacji",
  "Postepowanie restrukturyzacyjne",
  "Stan upadlosci",
  "Przedsiebiorstwo w spadku",
  "Transport morski",
  "Transport kolejowy",
  "Transport drogowy",
  "Transport lotniczy",
  "Przesylka pocztowa",
  "Stale instalacje",
  "Zegluga",
  "Rachunek banku",
  "zwolnione",
  "odwrotne obciazenie"
] as const;

function normalizePdfText(text: string) {
  return text.replace(/\s+/g, " ");
}

function correctionXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Naglowek><KodFormularza kodSystemowy="FA (3)">FA</KodFormularza></Naglowek>
  <Podmiot1><DaneIdentyfikacyjne><Nazwa>Seller</Nazwa><NIP>1111111111</NIP></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>KOR/1</P_2>
    <P_15>123.00</P_15>
    <RodzajFaktury>KOR</RodzajFaktury>
    <PrzyczynaKorekty>bledna stawka VAT</PrzyczynaKorekty>
    <TypKorekty>3</TypKorekty>
    <DaneFaKorygowanej>
      <DataWystFaKorygowanej>2026-01-15</DataWystFaKorygowanej>
      <NrFaKorygowanej>FV2026/01/1</NrFaKorygowanej>
      <NrKSeFFaKorygowanej>9999999999-20230908-8BEF280C8D35-4D</NrKSeFFaKorygowanej>
    </DaneFaKorygowanej>
    <FaWiersz><P_7>usluga testowa</P_7><P_8B>1</P_8B><P_9A>100</P_9A><P_11>100</P_11><P_12>23</P_12></FaWiersz>
  </Fa>
</Faktura>`;
}

function attachmentXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Naglowek><KodFormularza kodSystemowy="FA (3)">FA</KodFormularza></Naglowek>
  <Podmiot1><DaneIdentyfikacyjne><Nazwa>Seller</Nazwa><NIP>1111111111</NIP></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>ATT/1</P_2>
    <P_15>123.00</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
    <FaWiersz><P_7>energia elektryczna</P_7><P_8B>1</P_8B><P_9A>100</P_9A><P_11>100</P_11><P_12>23</P_12></FaWiersz>
  </Fa>
  <Zalacznik>
    <BlokDanych>
      <MetaDane><ZKlucz>Miejsce poboru energii</ZKlucz><ZWartosc>ul. Polna 1, 00-001 Warszawa</ZWartosc></MetaDane>
      <Tabela>
        <Opis>Odczyty</Opis>
        <TNaglowek><Kol Typ="txt"><NKom>Licznik/Strefa</NKom></Kol></TNaglowek>
        <Wiersz><WKom>Energia elektryczna czynna</WKom></Wiersz>
        <Suma><SKom>Ogolna wartosc - sprzedaz energii:</SKom></Suma>
      </Tabela>
    </BlokDanych>
  </Zalacznik>
</Faktura>`;
}

function staticOfficialTextXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Naglowek><KodFormularza kodSystemowy="FA (3)">FA</KodFormularza></Naglowek>
  <Podmiot1><DaneIdentyfikacyjne><NIP>1111111111</NIP><Nazwa>Seller</Nazwa></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><NIP>2222222222</NIP><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Podmiot3>
    <DaneIdentyfikacyjne><NIP>3333333333</NIP><Nazwa>F.H.U. Grazyna Kowalska</Nazwa></DaneIdentyfikacyjne>
    <Rola>4</Rola>
    <Udzial>50%</Udzial>
  </Podmiot3>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>STATIC/1</P_2>
    <P_13_1>100</P_13_1>
    <P_14_1>23</P_14_1>
    <P_15>123</P_15>
    <RodzajFaktury>KOR</RodzajFaktury>
    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <UU_ID>aaaa111133339997</UU_ID>
      <P_7>usluga testowa</P_7>
      <P_8A>szt</P_8A>
      <P_8B>1</P_8B>
      <P_9A>100</P_9A>
      <P_11>100</P_11>
      <P_12>23</P_12>
      <StanPrzed>1</StanPrzed>
    </FaWiersz>
  </Fa>
</Faktura>`;
}

function correctionEffectXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Naglowek><KodFormularza kodSystemowy="FA (3)">FA</KodFormularza></Naglowek>
  <Podmiot1><DaneIdentyfikacyjne><NIP>1111111111</NIP><Nazwa>Seller</Nazwa></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><NIP>2222222222</NIP><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>KOR/STATIC/1</P_2>
    <P_13_1>100</P_13_1>
    <P_14_1>23</P_14_1>
    <P_15>123</P_15>
    <RodzajFaktury>KOR</RodzajFaktury>
    <PrzyczynaKorekty>bledne dane</PrzyczynaKorekty>
    <TypKorekty>1</TypKorekty>
    <DaneFaKorygowanej>
      <DataWystFaKorygowanej>2026-05-10</DataWystFaKorygowanej>
      <NrFaKorygowanej>FV/1</NrFaKorygowanej>
    </DaneFaKorygowanej>
    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>usluga testowa</P_7>
      <P_8B>1</P_8B>
      <P_9A>100</P_9A>
      <P_11>100</P_11>
      <P_12>23</P_12>
    </FaWiersz>
  </Fa>
</Faktura>`;
}

function officialDictionaryXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Naglowek><KodFormularza kodSystemowy="FA (3)">FA</KodFormularza></Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne><NIP>1111111111</NIP><Nazwa>Seller</Nazwa></DaneIdentyfikacyjne>
    <StatusInfoPodatnika>1</StatusInfoPodatnika>
  </Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><NIP>2222222222</NIP><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <PodmiotUpowazniony>
    <RolaPU>1</RolaPU>
    <DaneIdentyfikacyjne><NIP>3333333333</NIP><Nazwa>Authorized</Nazwa></DaneIdentyfikacyjne>
  </PodmiotUpowazniony>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>DICT/1</P_2>
    <P_13_7>100</P_13_7>
    <P_15>100</P_15>
    <RodzajFaktury>VAT</RodzajFaktury>
    <FaWiersz>
      <NrWierszaFa>1</NrWierszaFa>
      <P_7>usluga testowa</P_7>
      <P_8B>1</P_8B>
      <P_9A>100</P_9A>
      <P_11>100</P_11>
      <P_12>zw</P_12>
    </FaWiersz>
    <Platnosc>
      <FormaPlatnosci>6</FormaPlatnosci>
      <RachunekBankowy>
        <NrRB>73111111111111111111111111</NrRB>
        <RachunekWlasnyBanku>1</RachunekWlasnyBanku>
      </RachunekBankowy>
    </Platnosc>
    <WarunkiTransakcji>
      <Transport>
        <RodzajTransportu>1</RodzajTransportu>
        <OpisLadunku>1</OpisLadunku>
      </Transport>
    </WarunkiTransakcji>
  </Fa>
</Faktura>`;
}

function textAtPath(root: Record<string, unknown>, xmlPath: Array<string | number>) {
  let current: unknown = root;
  for (const segment of xmlPath) {
    current = typeof segment === "number" ? (current as unknown[])[segment] : (current as Record<string, unknown>)[segment];
  }
  return (current as { _text?: string })._text;
}
