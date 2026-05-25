"use client";

import { useEffect, useState } from "react";
import {
  NameCaptureModal,
  type NameCaptureModalLabels
} from "@/components/account/name-capture-modal";

const SEEN_KEY = "name-capture-onboarding-seen";

export interface OnboardingNameModalProps {
  /**
   * True when the server thinks the user is missing one or both of
   * first_name / last_name. When false the component renders nothing
   * regardless of localStorage state.
   */
  missing: boolean;
  labels: NameCaptureModalLabels;
}

/**
 * One-shot post-OTP welcome dialog. Shows the soft NameCaptureModal the
 * first time a brand-new authenticated session lands on a protected
 * route with a missing first/last name. Subsequent loads on this
 * device are no-ops thanks to a localStorage flag.
 *
 * The hard-block path (the wizard's NameCaptureModal with dismissible
 * = false) still enforces the requirement at Translate-click time, so
 * dismissing this dialog never leaves us in an unsafe state — it just
 * defers the conversation.
 */
export function OnboardingNameModal({
  missing,
  labels
}: OnboardingNameModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!missing) return;
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(SEEN_KEY)) return;
    } catch {
      // localStorage might be disabled — fail closed by skipping the modal
      // (the hard-block still catches the case at Translate time).
      return;
    }
    setOpen(true);
  }, [missing]);

  function handleClose() {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // ignore — modal won't re-fire this session because state moved.
    }
  }

  return (
    <NameCaptureModal
      open={open}
      dismissible
      labels={labels}
      onClose={handleClose}
      onSaved={handleClose}
    />
  );
}
