import { permanentRedirect } from "next/navigation";

/**
 * Legacy workspace route. After the cutover (PR #E) the wizard at
 * /translate is the only authoring surface — this stub keeps any
 * bookmarked or in-the-wild /app links working until they re-render
 * via fresh server response.
 */
export default function AppLegacyRedirect() {
  permanentRedirect("/translate");
}
