import type { Metadata } from "next";
import { ContactPage } from "@/components/marketing/contact-page";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Write to the KSeF Invoice Translator team. We read every message and reply as fast as we can.",
  alternates: {
    canonical: "/en/contact",
    languages: { pl: "/contact", en: "/en/contact" }
  }
};

export default function Contact() {
  return <ContactPage locale="en" />;
}
