"use client";

import { useEffect } from "react";
import { identifyAuthenticatedUser } from "@/lib/analytics/client";

export function IdentifyUser({
  userId,
  email,
  locale
}: {
  userId: string;
  email?: string;
  locale?: string;
}) {
  // Syncing the PostHog external system with the auth state.
  useEffect(() => {
    identifyAuthenticatedUser(userId, { email, locale });
  }, [userId, email, locale]);

  return null;
}
