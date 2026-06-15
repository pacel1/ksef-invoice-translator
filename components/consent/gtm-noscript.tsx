import { resolveGtmId } from "@/lib/consent/gtm";

/**
 * Google Tag Manager <noscript> fallback, placed immediately after <body>.
 *
 * This is the standard GTM iframe for visitors with JavaScript disabled. It
 * cannot honour Consent Mode (no JS runs to read the cookie), so it only ever
 * applies to the JS-disabled minority; it is included per Google's standard
 * install. Env-gated on NEXT_PUBLIC_GTM_ID so dev/preview/test render nothing.
 *
 * The markup is injected verbatim because React cannot reliably render
 * <noscript> children across server and client.
 */
export function GtmNoScript() {
  const gtmId = resolveGtmId(process.env.NEXT_PUBLIC_GTM_ID);
  if (!gtmId) return null;

  return (
    <noscript
      dangerouslySetInnerHTML={{
        __html: `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`
      }}
    />
  );
}
