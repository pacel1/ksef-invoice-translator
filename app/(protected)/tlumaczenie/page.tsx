import { permanentRedirect } from "next/navigation";

/**
 * Polish-friendly alias for the wizard route. Permanent (308) redirect
 * to /translate so any bookmark / shared link keeps working regardless
 * of which canonical URL the user has.
 */
export default function TlumaczenieAliasPage() {
  permanentRedirect("/translate");
}
