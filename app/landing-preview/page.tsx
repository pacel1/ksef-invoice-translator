import type { Metadata } from "next";
import { LandingRebuild } from "@/components/landing/landing-rebuild";

export const metadata: Metadata = {
  title: "Landing preview (rebuild)",
  robots: { index: false, follow: false }
};

export default function LandingPreviewPage() {
  return <LandingRebuild locale="pl" />;
}
