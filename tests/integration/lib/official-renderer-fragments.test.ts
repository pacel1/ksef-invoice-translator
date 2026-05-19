import { describe, expect, it } from "vitest";
import type { Invoice } from "@/types/invoice";
import { applyAppFreeTextToOfficialXml, parseOfficialFa3Xml } from "@/lib/mf-fa3/official-renderer";
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

function textAtPath(root: Record<string, unknown>, xmlPath: Array<string | number>) {
  let current: unknown = root;
  for (const segment of xmlPath) {
    current = typeof segment === "number" ? (current as unknown[])[segment] : (current as Record<string, unknown>)[segment];
  }
  return (current as { _text?: string })._text;
}
