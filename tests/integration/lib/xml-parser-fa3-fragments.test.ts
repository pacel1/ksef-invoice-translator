import { describe, expect, it } from "vitest";
import { parseKsefXml } from "@/lib/xml/parser";

describe("parseKsefXml FA(3) correction and translation fragments", () => {
  it.each([2, 7, 11, 18])("extracts correction data from sample %s", (sampleNumber) => {
    const parsed = parseKsefXml(correctionXml(sampleNumber));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.invoice.correction?.reason).toBeTruthy();
    expect(parsed.invoice.correction?.type).toBeTruthy();
    expect(parsed.invoice.correction?.references?.length).toBeGreaterThan(0);
    expect(parsed.invoice.translationFragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "correction_reason",
          xmlPath: expect.arrayContaining(["Fa", "PrzyczynaKorekty"])
        })
      ])
    );
  });

  it("extracts collective correction period from sample 7", () => {
    const parsed = parseKsefXml(correctionXml(7, { period: "pierwsze polrocze 2026", references: 2 }));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.invoice.correction?.period).toMatch(/pierwsze/i);
    expect(parsed.invoice.correction?.isCollectiveDiscount).toBe(true);
    expect(parsed.invoice.translationFragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "correction_period",
          source: expect.stringMatching(/pierwsze/i)
        })
      ])
    );
  });

  it.each([24, 25])("extracts attachment fragments from sample %s", (sampleNumber) => {
    const parsed = parseKsefXml(attachmentXml(sampleNumber));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const fragments = parsed.invoice.translationFragments ?? [];
    expect(fragments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "attachment_key", source: "Miejsce poboru energii" }),
        expect.objectContaining({ kind: "attachment_table_description", source: expect.stringMatching(/Odczyty/i) }),
        expect.objectContaining({ kind: "attachment_column_header", source: expect.stringMatching(/Licznik/i) }),
        expect.objectContaining({ kind: "attachment_table_cell", source: expect.stringMatching(/Energia/i) }),
        expect.objectContaining({ kind: "attachment_summary_cell", source: expect.stringMatching(/sprzeda/i) })
      ])
    );
  });
});

function correctionXml(sampleNumber: number, options: { period?: string; references?: number } = {}) {
  const references = Array.from({ length: options.references ?? 1 }, (_, index) => `
      <DaneFaKorygowanej>
        <DataWystFaKorygowanej>2026-0${index + 1}-15</DataWystFaKorygowanej>
        <NrFaKorygowanej>FV2026/0${index + 1}/${sampleNumber}</NrFaKorygowanej>
        <NrKSeFFaKorygowanej>9999999999-20230908-8BEF280C8D35-${index + 1}D</NrKSeFFaKorygowanej>
      </DaneFaKorygowanej>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Naglowek><KodFormularza kodSystemowy="FA (3)">FA</KodFormularza></Naglowek>
  <Podmiot1><DaneIdentyfikacyjne><Nazwa>Seller</Nazwa><NIP>1111111111</NIP></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>KOR/${sampleNumber}</P_2>
    <P_15>123.00</P_15>
    <RodzajFaktury>KOR</RodzajFaktury>
    <PrzyczynaKorekty>bledna stawka VAT</PrzyczynaKorekty>
    <TypKorekty>3</TypKorekty>
    ${references}
    ${options.period ? `<OkresFaKorygowanej>${options.period}</OkresFaKorygowanej>` : ""}
    <FaWiersz><P_7>usluga testowa</P_7><P_8B>1</P_8B><P_9A>100</P_9A><P_11>100</P_11><P_12>23</P_12></FaWiersz>
  </Fa>
</Faktura>`;
}

function attachmentXml(sampleNumber: number) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Naglowek><KodFormularza kodSystemowy="FA (3)">FA</KodFormularza></Naglowek>
  <Podmiot1><DaneIdentyfikacyjne><Nazwa>Seller</Nazwa><NIP>1111111111</NIP></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>ATT/${sampleNumber}</P_2>
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
