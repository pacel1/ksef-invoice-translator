/**
 * Legal entity displayed in the site footer, transactional emails, and the
 * legal documents (Regulamin, Polityka Prywatności). contactEmail is the
 * operator contact used for complaints, RODO requests, and support.
 */
export interface LegalEntity {
  name: string;
  nip: string;
  regon: string;
  address: string;
  contactEmail: string;
  copyrightYear: number;
}

export const LEGAL_ENTITY: LegalEntity = {
  name: "Nextflame Studio",
  nip: "PL5213500025",
  regon: "142699151",
  address: "ul. Jana Żabińskiego 10/7, 02-793 Warszawa",
  contactEmail: "kontakt@tlumaczksef.pl",
  copyrightYear: new Date().getFullYear()
};
