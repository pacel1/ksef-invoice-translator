/**
 * Legal entity displayed in the site footer + transactional emails.
 *
 * REPLACE BEFORE LAUNCH — these placeholder values must be swapped for the
 * actual registered Polish entity. Tracked in
 * docs/superpowers/specs/2026-05-18-ui-overhaul-design.md §8.
 */
export interface LegalEntity {
  name: string;
  nip: string;
  regon: string;
  address: string;
  copyrightYear: number;
}

export const LEGAL_ENTITY: LegalEntity = {
  name: "Tłumacz Faktur KSeF (REPLACE_BEFORE_LAUNCH)",
  nip: "0000000000",
  regon: "000000000",
  address: "ul. REPLACE_BEFORE_LAUNCH 1, 00-000 Warszawa",
  copyrightYear: new Date().getFullYear()
};
