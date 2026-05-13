export type PublicKsefVerificationResult = {
  confirmed: boolean;
  ksefNumber?: string;
  statusCode?: number;
  error?: string;
};

const KSEF_CONFIRMED_TEXT = "Faktura znajduje si\u0119 w KSeF";
const KSEF_NUMBER_INPUT_REGEX = /id=["']KsefNumber["'][^>]*value=["']([^"']+)["']/i;
const KSEF_NUMBER_INPUT_TAG_REGEX = /<input\b[^>]*(?:id|name)=["']KsefNumber["'][^>]*>/i;
const VALUE_ATTRIBUTE_REGEX = /\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

async function fetchWithTimeout(url: string, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "TlumaczKSeF/1.0"
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyPublicKsefQrUrl(url: string): Promise<PublicKsefVerificationResult> {
  try {
    const response = await fetchWithTimeout(url, 5000);
    const html = await response.text();

    if (response.status !== 200) {
      return {
        confirmed: false,
        statusCode: response.status,
        error: "Public KSeF verification page returned non-OK status"
      };
    }

    const successTextFound = html.includes(KSEF_CONFIRMED_TEXT);
    const ksefNumber = extractKsefNumber(html);

    if (successTextFound && ksefNumber) {
      return {
        confirmed: true,
        ksefNumber,
        statusCode: response.status
      };
    }

    return {
      confirmed: false,
      statusCode: response.status,
      error: !successTextFound
        ? "Public KSeF verification page did not confirm the invoice"
        : "KSeF number was not found in public verification page HTML"
    };
  } catch {
    return {
      confirmed: false,
      error: "Request to public KSeF verification page failed or timed out"
    };
  }
}

function extractKsefNumber(html: string) {
  const directMatch = html.match(KSEF_NUMBER_INPUT_REGEX)?.[1]?.trim();
  if (directMatch) return decodeHtmlAttribute(directMatch);

  const inputTag = html.match(KSEF_NUMBER_INPUT_TAG_REGEX)?.[0];
  const value = inputTag?.match(VALUE_ATTRIBUTE_REGEX)?.slice(1).find((entry) => entry !== undefined)?.trim();
  return value ? decodeHtmlAttribute(value) : undefined;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&#34;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
