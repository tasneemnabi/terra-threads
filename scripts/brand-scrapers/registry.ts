/**
 * Brand-scraper locator registry.
 *
 * `getLocator(slug)` returns the brand-specific locator if one is registered,
 * otherwise falls back to `defaultLocator`. Locators are pure extraction
 * functions — they return raw composition data and never touch the DB or
 * run curation (that's the caller's job).
 */

import type { Locator } from "./locators/types.js";
import { defaultLocator } from "./locators/default.js";
import { naadam } from "./locators/naadam.js";
import { pact } from "./locators/pact.js";
import { unboundMerino } from "./locators/unbound-merino.js";

export const locators: Record<string, Locator> = {
  "naadam": naadam,
  "pact": pact,
  "unbound-merino": unboundMerino,
};

export function getLocator(slug: string): Locator {
  return locators[slug] ?? defaultLocator;
}

export { defaultLocator };
