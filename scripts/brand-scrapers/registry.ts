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
import { gilRodriguez } from "./locators/gil-rodriguez.js";
import { jungmaven } from "./locators/jungmaven.js";
import { magicLinen } from "./locators/magic-linen.js";
import { naadam } from "./locators/naadam.js";
import { pact } from "./locators/pact.js";
import { pyneAndSmith } from "./locators/pyne-and-smith.js";
import { unboundMerino } from "./locators/unbound-merino.js";

export const locators: Record<string, Locator> = {
  "gil-rodriguez": gilRodriguez,
  "jungmaven": jungmaven,
  "magic-linen": magicLinen,
  "naadam": naadam,
  "pact": pact,
  "pyne-and-smith": pyneAndSmith,
  "unbound-merino": unboundMerino,
};

export function getLocator(slug: string): Locator {
  return locators[slug] ?? defaultLocator;
}

export { defaultLocator };
