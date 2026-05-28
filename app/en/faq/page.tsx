import { FaqPage } from "@/components/marketing/faq-page";

export const revalidate = 3600;

export default function FaqEn() {
  return <FaqPage locale="en" />;
}
