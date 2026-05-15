import { describe, expect, it } from "vitest";
import { parseKsefXml } from "@/lib/xml/parser";

describe("parseKsefXml additional descriptions", () => {
  it("keeps simple text DodatkowyOpis entries for AI translation", () => {
    const parsed = parseKsefXml(`<?xml version="1.0" encoding="UTF-8"?>
<Faktura>
  <Podmiot1><DaneIdentyfikacyjne><Nazwa>Seller</Nazwa></DaneIdentyfikacyjne></Podmiot1>
  <Podmiot2><DaneIdentyfikacyjne><Nazwa>Buyer</Nazwa></DaneIdentyfikacyjne></Podmiot2>
  <Fa>
    <KodWaluty>PLN</KodWaluty>
    <P_1>2026-05-15</P_1>
    <P_2>FV/1</P_2>
    <P_15>123.00</P_15>
    <FaWiersz>
      <P_7>Usługa testowa</P_7>
      <P_8B>1</P_8B>
      <P_9A>100.00</P_9A>
      <P_11>100.00</P_11>
      <P_12>23</P_12>
    </FaWiersz>
  </Fa>
  <DodatkowyOpis>Lokalizacja: Warszawa</DodatkowyOpis>
</Faktura>`);

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.invoice.additionalDescriptions).toEqual([{ value: "Lokalizacja: Warszawa" }]);
  });
});
