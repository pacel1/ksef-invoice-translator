import type { Metadata } from "next";
import { Inter, Space_Grotesk, DM_Sans } from "next/font/google";
import { ConsentProvider } from "@/components/consent/consent-provider";
import { GtmNoScript } from "@/components/consent/gtm-noscript";
import { SITE_URL } from "@/lib/seo/site-url";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["500", "600", "700"], display: "swap", variable: "--font-space-grotesk" });
const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-dm-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "KSeF Invoice Translator | Tłumacz faktur KSeF FA(3) XML",
    template: "%s | KSeF Invoice Translator"
  },
  description:
    "Polskojęzyczne narzędzie SaaS dla firm: tłumacz faktury KSeF FA(3) XML, generuj czytelny podgląd oraz profesjonalny PDF dla zagranicznych kontrahentów.",
  keywords: [
    "tłumacz faktur KSeF",
    "tłumaczenie faktury KSeF",
    "faktura KSeF po angielsku",
    "FA(3) viewer",
    "KSeF invoice translator",
    "XML invoice to PDF",
    "Translate KSeF invoice",
    "Polish invoice translation",
    "Invoice translator for contractors",
    "faktura XML do PDF",
    "tłumaczenie faktur dla kontrahentów"
  ],
  applicationName: "KSeF Invoice Translator",
  authors: [{ name: "KSeF Invoice Translator" }],
  creator: "KSeF Invoice Translator",
  publisher: "KSeF Invoice Translator",
  openGraph: {
    title: "KSeF Invoice Translator | Tłumacz faktur KSeF FA(3) XML",
    description:
      "Zamień polskie faktury KSeF XML w profesjonalne tłumaczenia i eksporty PDF dla zagranicznych kontrahentów.",
    url: "/",
    siteName: "KSeF Invoice Translator",
    locale: "pl_PL",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "KSeF Invoice Translator",
    description: "Tłumacz faktury KSeF FA(3) XML dla zagranicznych kontrahentów."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${inter.variable} ${spaceGrotesk.variable} ${dmSans.variable}`}>
      <body className="bg-surface text-text-strong">
        <GtmNoScript />
        <ConsentProvider>{children}</ConsentProvider>
      </body>
    </html>
  );
}
