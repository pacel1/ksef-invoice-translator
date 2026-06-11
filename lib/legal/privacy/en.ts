import type { LegalSection } from "@/components/marketing/legal-doc-layout";
import { LEGAL_ENTITY } from "@/lib/brand/legal";

/**
 * Privacy Policy (EN). Convenience translation of the Polish Polityka
 * Prywatności; the Polish language version is the binding one. Section ids
 * mirror pl.ts so anchors stay stable across locales.
 */
export const PRIVACY_SECTIONS_EN: ReadonlyArray<LegalSection> = [
  {
    id: "administrator",
    title: "1. Data controller",
    content: `The controller of personal data processed in the tlumaczksef.pl service (the Service) is ${LEGAL_ENTITY.name}, NIP (tax id): ${LEGAL_ENTITY.nip}, REGON: ${LEGAL_ENTITY.regon}, address: ${LEGAL_ENTITY.address} (the Controller).
For all matters concerning personal data you can contact us at: ${LEGAL_ENTITY.contactEmail}.
This policy fulfils the information obligations under art. 13 and 14 of Regulation (EU) 2016/679 (GDPR). This English text is a convenience translation; the Polish language version is the binding one.`
  },
  {
    id: "zakres-danych",
    title: "2. What data we process",
    content: `Depending on how you use the Service, we process the following categories of data:
1. Account data: email address, Account settings (interface language, optional display name), credit balance, translation history.
2. Demo data: the email address provided for one-time verification and the uploaded invoice XML file.
3. Billing data: buyer name, NIP (tax id), address, and purchase history. Payment card data is processed exclusively by the payment operator Stripe; we have no access to it and do not store it.
4. Invoice content: data contained in uploaded XML files conforming to the FA(3) schema, which may include seller and buyer data (names, NIP numbers, addresses, bank account numbers, invoice line items).
5. Technical data: IP address, server logs, session identifiers, and the result of anti-bot verification.`
  },
  {
    id: "cele-i-podstawy",
    title: "3. Purposes and legal bases",
    content: `We process data for the following purposes and on the following legal bases:
1. Providing services: maintaining the Account, one-time link sign-in, performing translations, storing files and history, operating the demo. Basis: art. 6(1)(b) GDPR (performance of a contract or steps prior to entering into one).
2. Billing and accounting: issuing VAT invoices, submitting them to the National e-Invoicing System (KSeF), retaining accounting records. Basis: art. 6(1)(c) GDPR (legal obligation under Polish tax and accounting law).
3. Security: keeping logs, preventing abuse, bot protection, detecting and handling incidents. Basis: art. 6(1)(f) GDPR (the Controller's legitimate interest in keeping the services secure).
4. Handling enquiries and complaints, and establishing, pursuing, and defending claims. Basis: art. 6(1)(b) and (f) GDPR.
5. Measuring ad performance and anonymous visit statistics: only after you give consent via the cookie banner. Basis: art. 6(1)(a) GDPR (consent); consent can be withdrawn at any time.
We do not send marketing communications without separate consent. Emails sent by the Service are transactional (sign-in link, purchase confirmation, invoice, notices of changes to the terms).`
  },
  {
    id: "powierzenie",
    title: "4. Invoice data: our role as processor",
    content: `Invoices uploaded to the Service may contain personal data of third parties, in particular the user's counterparties. For this data the user is the controller and we act as a processor within the meaning of art. 28 GDPR, under the entrustment described in § 14 of the Terms of Service.
We process invoice data solely to perform the translation and generate the PDF document, for the period indicated in section 7. We do not use invoice content or translations to train artificial intelligence models or for any purposes of our own.`
  },
  {
    id: "odbiorcy",
    title: "5. Data recipients",
    content: `We use the following entities that process data on our behalf:
1. Supabase: database, file storage, and authentication; data stored in Frankfurt (AWS region eu-central-1, European Union).
2. Vercel: application hosting and server infrastructure.
3. OpenAI: automatic translation of invoice content; based in the USA, data processing agreement in place.
4. Stripe (Stripe Payments Europe, Ltd., Ireland): payment processing.
5. Resend: transactional email delivery (sign-in links, confirmations); based in the USA, data processing agreement in place.
6. iFirma: issuing VAT invoices for purchases in the Service and submitting them to the National e-Invoicing System; based in Poland.
7. Cloudflare: anti-bot verification (Turnstile) protecting the Service's forms.
8. Google (Google Ireland Limited): measuring the performance of Google Ads campaigns, only after you consent to marketing cookies.
9. PostHog (PostHog EU): product analytics and usage statistics; data stored in the European Union (Frankfurt region). For visitors who have not accepted analytics cookies, analytics runs without cookies and without persistent browser identifiers. Analytics cookies are set only after the "analytics" category is accepted in the cookie banner. Events of signed-in users are linked to their account under our legitimate interest in understanding how the product is used.
Data may also be disclosed to public authorities where required by law, and to the National e-Invoicing System (KSeF) for VAT invoices documenting purchases in the Service. We do not sell personal data.`
  },
  {
    id: "transfery-poza-eog",
    title: "6. Transfers outside the EEA",
    content: `Some of our providers (OpenAI, Resend, Cloudflare, and, if you consent to marketing cookies, Google) are based in the United States or use infrastructure there, which may involve transferring data outside the European Economic Area (EEA).
Transfers take place on the basis of the European Commission's adequacy decision concerning the EU-US Data Privacy Framework for certified entities, and otherwise on the basis of standard contractual clauses approved by the European Commission, together with supplementary safeguards.
A copy of the safeguards can be obtained by contacting us at the address indicated in section 1. Invoice files and translations are stored exclusively on servers in the European Union; invoice content is passed to OpenAI only for the time needed to perform the translation.`
  },
  {
    id: "okresy-przechowywania",
    title: "7. How long we keep data",
    content: `We apply the following retention periods:
1. Invoice XML files: 30 days from upload, then permanently deleted.
2. Translations: 30 days from creation, then permanently deleted.
3. One-time sign-in links: 60 minutes from generation.
4. Account data (email, settings, credit balance): for as long as the Account exists; after Account deletion the data is permanently removed.
5. Accounting records and billing data (VAT invoices, purchase logs): 5 years from the end of the tax year in which the tax obligation arose, as required by law.
6. Server logs: 90 days.
7. Data processed for the defence of claims: until the limitation periods expire.
Files uploaded in the demo are subject to the same rules as files uploaded from an Account.`
  },
  {
    id: "prawa",
    title: "8. Your rights",
    content: `In connection with the processing of your personal data you have the right to:
1. access your data and obtain a copy of it (art. 15 GDPR),
2. rectify inaccurate data (art. 16 GDPR),
3. erasure, the right to be forgotten (art. 17 GDPR); you can delete your Account yourself in the Service settings,
4. restrict processing (art. 18 GDPR),
5. data portability (art. 20 GDPR); a JSON export of Account data is available in the Account settings,
6. object to processing based on legitimate interest (art. 21 GDPR).
To exercise these rights, write to: ${LEGAL_ENTITY.contactEmail}. We respond without undue delay, at the latest within one month.
You also have the right to lodge a complaint with the supervisory authority: the President of the Personal Data Protection Office (Prezes Urzędu Ochrony Danych Osobowych), ul. Stawki 2, 00-193 Warszawa, uodo.gov.pl.`
  },
  {
    id: "dobrowolnosc",
    title: "9. Voluntariness of providing data",
    content: `Providing data is voluntary but necessary to use the Service:
1. an email address is required to create an Account, sign in, and use the demo,
2. buyer details (name, NIP, address) are required by law to issue a VAT invoice for a purchase,
3. uploading an invoice file is necessary to perform the translation service.
Without this data it is not possible, respectively, to create an Account, make a purchase, or perform a translation.`
  },
  {
    id: "cookies",
    title: "10. Cookies",
    content: `The Service uses cookies in three categories:
1. necessary: sign-in session cookies (Supabase Auth), anti-bot verification cookies (Cloudflare Turnstile), and a cookie that remembers your consent decision; they are always active because the Service cannot work without them, and they do not require consent under the Polish Electronic Communications Law,
2. analytics: statistics about how the Service is used, via PostHog (PostHog EU); activated only after you give consent,
3. marketing: Google Ads cookies (Google Ireland Limited), used to measure ad performance; activated only after you give consent.
You can give or refuse consent in the cookie banner shown on your first visit. You can change your choice at any time using the "Cookie settings" link in the Service footer. Withdrawing consent is as easy as giving it and does not affect the lawfulness of processing carried out before the withdrawal.
The legal basis for processing related to analytics and marketing cookies is consent (art. 6(1)(a) GDPR). Until consent is given, the Google tag runs in Google Consent Mode with every signal set to denied: it stores no cookies and ad click data is redacted.
You can delete and block cookies in your browser settings, but blocking the necessary cookies will prevent signing in to the Service.`
  },
  {
    id: "bezpieczenstwo",
    title: "11. Data security",
    content: `We apply technical and organizational measures appropriate to the risk, in particular:
1. encryption of data in transit (TLS) and at rest,
2. storing files and the database on servers in the European Union (Frankfurt, AWS region eu-central-1),
3. passwordless sign-in, reducing the risk of password leaks,
4. restricting data access to authorized persons,
5. automatic deletion of files after the retention period.
In the event of a personal data breach likely to result in a high risk to rights and freedoms, we notify the affected persons in accordance with art. 34 GDPR, and the supervisory authority within 72 hours in accordance with art. 33 GDPR.`
  },
  {
    id: "decyzje-automatyczne",
    title: "12. Automated decision-making",
    content: `We do not make decisions about users based solely on automated processing, including profiling, that would produce legal effects or similarly significantly affect them.
Automatic translation concerns the content of documents and is not used to evaluate natural persons.`
  },
  {
    id: "zmiany-polityki",
    title: "13. Changes to this policy",
    content: `This privacy policy may be updated, in particular when the scope of services, the list of sub-processors, or the law changes.
We notify users with an Account of material changes by email and by publishing the new version on the Service together with the last-updated date.
The policy is drawn up in Polish; this English translation is provided for convenience and the Polish language version prevails. This version applies from 2026-06-11.`
  }
];
