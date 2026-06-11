import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text
} from "@react-email/components";

export interface PaymentConfirmationEmailProps {
  locale: "pl" | "en";
  packageSize: number;
  /** Pre-formatted gross amount, e.g. "153,75 zł". */
  amountPaid: string;
  recipientEmail: string;
}

const copy = {
  pl: {
    preview: "Płatność potwierdzona, kredyty są już na Twoim koncie",
    heading: "Dziękujemy, płatność potwierdzona",
    credits: (n: number) =>
      `Na Twoje konto dodaliśmy ${n} kredytów na tłumaczenie faktur. Możesz z nich korzystać od razu.`,
    amount: (formatted: string) => `Kwota płatności: ${formatted} (brutto, z VAT).`,
    invoiceHeading: "Co z fakturą?",
    invoiceBody:
      "Fakturę VAT wystawimy automatycznie i prześlemy do KSeF (Krajowy System e-Faktur). " +
      "Nie wysyłamy faktury mailem. Znajdziesz ją w KSeF po numerze NIP podanym przy płatności.",
    footer: "KSeF Translator, narzędzie do tłumaczenia faktur KSeF dla zagranicznych kontrahentów."
  },
  en: {
    preview: "Payment confirmed, your credits are ready",
    heading: "Thank you, payment confirmed",
    credits: (n: number) =>
      `We added ${n} credits for invoice translation to your account. You can use them right away.`,
    amount: (formatted: string) => `Amount paid: ${formatted} (VAT included).`,
    invoiceHeading: "What about the invoice?",
    invoiceBody:
      "Your VAT invoice will be issued automatically and delivered to KSeF (the Polish national " +
      "e-invoicing system). We do not send invoices by email. You will find it in KSeF under the " +
      "NIP provided during checkout.",
    footer: "KSeF Translator, invoice translation for Polish businesses working with foreign contractors."
  }
} as const;

export function PaymentConfirmationEmail({
  locale,
  packageSize,
  amountPaid,
  recipientEmail
}: PaymentConfirmationEmailProps) {
  const t = copy[locale];

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Tailwind>
        <Body className="bg-slate-50 font-sans">
          <Container className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <Heading className="text-2xl font-semibold text-slate-950">{t.heading}</Heading>
            <Text className="mt-3 text-base leading-7 text-slate-700">
              {t.credits(packageSize)}
            </Text>
            <Text className="text-base leading-7 text-slate-700">{t.amount(amountPaid)}</Text>

            <Section className="mt-6 rounded-md bg-slate-100 p-4">
              <Heading as="h2" className="m-0 text-base font-semibold text-slate-950">
                {t.invoiceHeading}
              </Heading>
              <Text className="mb-0 mt-2 text-sm leading-6 text-slate-700">{t.invoiceBody}</Text>
            </Section>

            <Hr className="my-6 border-slate-200" />

            <Text className="text-xs text-slate-400">{t.footer}</Text>
            <Text className="mt-1 text-xs text-slate-400">{recipientEmail}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default PaymentConfirmationEmail;
