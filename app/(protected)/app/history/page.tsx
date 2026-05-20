import { permanentRedirect } from "next/navigation";

/**
 * Legacy history route — see /app/page.tsx for context. Both /app and
 * /app/history permanent-redirect into the /translate namespace after
 * the cutover.
 */
export default function AppHistoryLegacyRedirect() {
  permanentRedirect("/translate/history");
}
