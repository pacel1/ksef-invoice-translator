/**
 * Founder card content. REPLACE BEFORE LAUNCH — placeholder values must be
 * swapped for real founder photo, name, statement, and contact email. Tracked
 * in docs/superpowers/specs/2026-05-18-ui-overhaul-design.md §8.
 */
export interface Founder {
  name: string;
  photoUrl: string;
  statement: string;
  contactEmail: string;
}

export const FOUNDER: Founder = {
  name: "Founder Name (REPLACE_BEFORE_LAUNCH)",
  photoUrl: "/founder-placeholder.svg",
  statement:
    "REPLACE_BEFORE_LAUNCH: dwa zdania o tym, dlaczego prowadzisz tłumaczksef.pl i że osobiście czytasz każdą wiadomość.",
  contactEmail: "kontakt@example.test"
};
