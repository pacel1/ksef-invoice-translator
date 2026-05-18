import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ksef-invoice-translator.vercel.app"),
  title: {
    default: "KSeF Invoice Translator | Tłumacz faktur KSeF FA(3) XML i PDF",
    template: "%s | KSeF Invoice Translator"
  },
  description:
    "Polskojęzyczne narzędzie SaaS dla firm: tłumacz faktury KSeF FA(3) XML i PDF, generuj czytelny podgląd oraz profesjonalny PDF dla zagranicznych kontrahentów.",
  keywords: [
    "tłumacz faktur KSeF",
    "tłumaczenie faktury KSeF",
    "faktura KSeF po angielsku",
    "FA(3) viewer",
    "KSeF PDF translator",
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
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "KSeF Invoice Translator | Tłumacz faktur KSeF FA(3) XML i PDF",
    description:
      "Zamień polskie faktury KSeF XML lub PDF w profesjonalne tłumaczenia i eksporty PDF dla zagranicznych kontrahentów.",
    url: "/",
    siteName: "KSeF Invoice Translator",
    locale: "pl_PL",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "KSeF Invoice Translator",
    description: "Tłumacz faktury KSeF FA(3) XML i PDF dla zagranicznych kontrahentów."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={inter.variable}>
      <body className="bg-surface text-text-strong">{children}</body>
    </html>
  );
}
