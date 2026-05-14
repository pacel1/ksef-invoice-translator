import {
  Body,
  Button,
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

export interface MagicLinkEmailProps {
  link: string;
  locale: "pl" | "en";
  recipientEmail: string;
}

const copy = {
  pl: {
    preview: "Zaloguj się do KSeF Translator",
    heading: "Zaloguj się jednym kliknięciem",
    body: "Kliknij poniższy przycisk, aby zalogować się do KSeF Translator. Link jest jednorazowy i wygasa po godzinie.",
    button: "Zaloguj się",
    fallback: "Jeśli przycisk nie działa, skopiuj ten link do przeglądarki:",
    ignore: "Jeśli nie próbowałeś się zalogować, możesz zignorować tę wiadomość.",
    footer: "KSeF Translator — narzędzie do tłumaczenia faktur KSeF dla zagranicznych kontrahentów."
  },
  en: {
    preview: "Sign in to KSeF Translator",
    heading: "One-click sign-in",
    body: "Click the button below to sign in to KSeF Translator. The link is single-use and expires in one hour.",
    button: "Sign in",
    fallback: "If the button doesn't work, copy this link into your browser:",
    ignore: "If you didn't try to sign in, you can ignore this email.",
    footer: "KSeF Translator — invoice translation for Polish businesses working with foreign contractors."
  }
} as const;

export function MagicLinkEmail({ link, locale, recipientEmail }: MagicLinkEmailProps) {
  const t = copy[locale];

  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Tailwind>
        <Body className="bg-slate-50 font-sans">
          <Container className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-sm">
            <Heading className="text-2xl font-semibold text-slate-950">{t.heading}</Heading>
            <Text className="mt-3 text-base leading-7 text-slate-700">{t.body}</Text>

            <Section className="mt-6 text-center">
              <Button
                href={link}
                className="rounded-md bg-slate-950 px-6 py-3 text-sm font-semibold text-white"
              >
                {t.button}
              </Button>
            </Section>

            <Text className="mt-6 text-sm text-slate-600">{t.fallback}</Text>
            <Text className="break-all rounded-md bg-slate-100 p-3 text-xs text-slate-700">
              <a href={link} className="text-slate-700 underline">{link}</a>
            </Text>

            <Hr className="my-6 border-slate-200" />

            <Text className="text-xs text-slate-500">{t.ignore}</Text>
            <Text className="mt-2 text-xs text-slate-400">{t.footer}</Text>
            <Text className="mt-1 text-xs text-slate-400">{recipientEmail}</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export default MagicLinkEmail;
