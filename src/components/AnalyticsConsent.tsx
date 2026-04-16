"use client";

import CookieConsent from "react-cookie-consent";
import posthog from "posthog-js";
import { isPostHogEnabled } from "@/lib/posthog/provider";

const COOKIE_NAME = "fiber_analytics_consent";

export function AnalyticsConsent() {
  return (
    <CookieConsent
      cookieName={COOKIE_NAME}
      location="bottom"
      buttonText="Accept"
      declineButtonText="Decline"
      enableDeclineButton
      disableStyles
      containerClasses="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-4 border-t border-surface-dark bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-20"
      contentClasses="font-body text-[14px] leading-[22px] text-secondary"
      buttonWrapperClasses="flex gap-3"
      buttonClasses="inline-flex items-center justify-center px-5 py-2 font-body text-[13px] font-medium uppercase tracking-[0.08em] bg-text text-surface hover:opacity-90 transition-opacity"
      declineButtonClasses="inline-flex items-center justify-center px-5 py-2 font-body text-[13px] font-medium uppercase tracking-[0.08em] border border-surface-dark text-text hover:bg-surface-dark/10 transition-colors"
      onAccept={() => {
        if (isPostHogEnabled()) posthog.opt_in_capturing();
      }}
      onDecline={() => {
        if (isPostHogEnabled()) posthog.opt_out_capturing();
      }}
    >
      We use cookies to understand how visitors use FIBER. No personal data, no
      ads.
    </CookieConsent>
  );
}
