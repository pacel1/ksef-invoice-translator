import type { Metadata } from "next";
import { ContactPage } from "@/components/marketing/contact-page";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Napisz do zespołu Tłumacz Faktur KSeF. Czytamy każdą wiadomość i odpowiadamy najszybciej, jak się da.",
  alternates: {
    canonical: "/contact",
    languages: { pl: "/contact", en: "/en/contact" }
  }
};

export default function Contact() {
  return <ContactPage locale="pl" />;
}
