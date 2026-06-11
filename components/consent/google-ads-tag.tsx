"use client";

import Script from "next/script";
import type { ConsentState } from "@/lib/consent/types";

export interface GoogleAdsTagProps {
  consent: ConsentState | null;
}

/**
 * Basic consent mode: nothing is rendered (and nothing is sent to Google)
 * until the visitor grants marketing consent. The tag id comes from
 * NEXT_PUBLIC_GOOGLE_ADS_ID, set only in production, so development,
 * previews and tests never load Google scripts.
 */
export function GoogleAdsTag({ consent }: GoogleAdsTagProps) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId || !consent?.marketing) return null;

  const analyticsSignal = consent.analytics ? "granted" : "denied";
  const bootstrap = `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent', 'default', {
  'ad_storage': 'granted',
  'ad_user_data': 'granted',
  'ad_personalization': 'granted',
  'analytics_storage': '${analyticsSignal}'
});
gtag('js', new Date());
gtag('config', '${adsId}');`;

  return (
    <>
      <Script
        id="google-ads-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-bootstrap" strategy="afterInteractive">
        {bootstrap}
      </Script>
    </>
  );
}
