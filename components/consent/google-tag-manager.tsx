"use client";

import Script from "next/script";
import { resolveGtmId } from "@/lib/consent/gtm";
import { CONSENT_COOKIE_NAME } from "@/lib/consent/types";

/**
 * Google Tag Manager with advanced Consent Mode v2.
 *
 * A single inline script runs, in order: it seeds the dataLayer and the gtag
 * shim, defaults every Consent Mode v2 signal to denied, redacts ads data,
 * reads the live consent cookie to grant whatever the visitor already chose,
 * and only then loads the GTM container. Doing all of this in one script
 * guarantees the consent defaults are in the dataLayer before the container
 * starts, so tags inside GTM never fire ahead of consent. The granted state is
 * derived from the live cookie at execution time, never from render-time
 * props, so a revocation can never resurrect granted signals. Later decisions
 * flow through pushConsentUpdate, which targets the gtag shim defined here.
 *
 * The container id comes from NEXT_PUBLIC_GTM_ID, set only in production, so
 * development, previews and tests never load GTM.
 */
export function GoogleTagManager() {
  const gtmId = resolveGtmId(process.env.NEXT_PUBLIC_GTM_ID);
  if (!gtmId) return null;

  const init = `(function () {
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
  (function (w, d, s, l, i) {
    w[l] = w[l] || [];
    w[l].push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    var f = d.getElementsByTagName(s)[0],
      j = d.createElement(s),
      dl = l != 'dataLayer' ? '&l=' + l : '';
    j.async = true;
    j.src = 'https://www.googletagmanager.com/gtm.js?id=' + i + dl;
    f.parentNode.insertBefore(j, f);
  })(window, document, 'script', 'dataLayer', '${gtmId}');
})();`;

  return (
    <Script id="gtm-init" strategy="afterInteractive">
      {init}
    </Script>
  );
}
