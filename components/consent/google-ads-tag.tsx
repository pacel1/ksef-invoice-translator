"use client";

import Script from "next/script";
import { CONSENT_COOKIE_NAME, type ConsentState } from "@/lib/consent/types";

export interface GoogleAdsTagProps {
  consent: ConsentState | null;
}

/**
 * Basic consent mode: nothing is rendered (and nothing is sent to Google)
 * until the visitor grants marketing consent. The tag id comes from
 * NEXT_PUBLIC_GOOGLE_ADS_ID, set only in production, so development,
 * previews and tests never load Google scripts.
 *
 * The bootstrap defaults every signal to denied and derives the granted
 * state from the live consent cookie at execution time, not from
 * render-time props. A revocation that lands between render and script
 * execution therefore can never resurrect granted signals.
 */
export function GoogleAdsTag({ consent }: GoogleAdsTagProps) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId || !consent?.marketing) return null;

  const bootstrap = `(function () {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  window.gtag = window.gtag || gtag;
  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied'
  });
  try {
    var match = document.cookie.match(/(?:^|;\\s*)${CONSENT_COOKIE_NAME}=([^;]*)/);
    if (match) {
      var stored = JSON.parse(decodeURIComponent(match[1]));
      var signal = function (granted) { return granted ? 'granted' : 'denied'; };
      gtag('consent', 'update', {
        'ad_storage': signal(stored.marketing),
        'ad_user_data': signal(stored.marketing),
        'ad_personalization': signal(stored.marketing),
        'analytics_storage': signal(stored.analytics)
      });
    }
  } catch (error) { /* malformed cookie: signals stay denied */ }
  gtag('js', new Date());
  gtag('config', '${adsId}');
})();`;

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
