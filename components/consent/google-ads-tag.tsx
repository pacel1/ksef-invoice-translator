"use client";

import Script from "next/script";
import { CONSENT_COOKIE_NAME } from "@/lib/consent/types";

/**
 * Advanced consent mode: gtag.js loads for every visitor (so Google can
 * verify the tag), but every Consent Mode v2 signal defaults to denied and
 * ads data is redacted, so no marketing or analytics cookies are set and
 * only cookieless pings are sent until the visitor consents. The granted
 * state is derived from the live consent cookie at execution time, never
 * from render-time props, so a revocation can never resurrect granted
 * signals. Later decisions flow through pushConsentUpdate.
 *
 * The tag id comes from NEXT_PUBLIC_GOOGLE_ADS_ID, set only in production,
 * so development, previews and tests never load Google scripts.
 */
export function GoogleAdsTag() {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId) return null;

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
  gtag('set', 'ads_data_redaction', true);
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
