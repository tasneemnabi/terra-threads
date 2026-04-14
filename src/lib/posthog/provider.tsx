"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

export function isPostHogEnabled(): boolean {
  return typeof POSTHOG_KEY === "string" && POSTHOG_KEY.length > 0;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isPostHogEnabled()) return;
    // Guard against double-init during React strict mode / HMR
    if (typeof window !== "undefined" && !(window as unknown as { __posthogInitialized?: boolean }).__posthogInitialized) {
      posthog.init(POSTHOG_KEY!, {
        api_host: POSTHOG_HOST,
        capture_pageview: false,
        capture_pageleave: true,
        persistence: "localStorage+cookie",
        person_profiles: "identified_only",
        respect_dnt: true,
        autocapture: false,
        session_recording: {
          maskAllInputs: true,
        },
      });
      (window as unknown as { __posthogInitialized?: boolean }).__posthogInitialized = true;
    }
  }, []);

  return <>{children}</>;
}
