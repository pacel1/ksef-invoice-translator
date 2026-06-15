/**
 * Google Tag Manager container ids are always `GTM-` followed by an
 * uppercase-alphanumeric suffix. NEXT_PUBLIC_GTM_ID is an operator-supplied,
 * build-time value injected into an inline script literal and an iframe URL,
 * so we validate its shape at this boundary: a malformed value (a stray quote,
 * whitespace, or an Ads id pasted by mistake) resolves to null and the tag
 * simply does not render, rather than producing a broken or unsafe script.
 */
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/;

export function resolveGtmId(raw: string | undefined): string | null {
  if (!raw || !GTM_ID_PATTERN.test(raw)) return null;
  return raw;
}
