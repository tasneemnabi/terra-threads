/**
 * Beaumont Organic locator.
 *
 * Beaumont's Shopify body_html embeds composition in four distinct shapes,
 * which is why the default locator leaves 15 products in review:
 *
 *   1. Explicit percentage bullet (most products):
 *        - Made from 68% bamboo, 28% organic cotton, 4% elastane.
 *      The default extractor already handles these. They are only in review
 *      because their body_hash is stale — `force-rescan` clears them without
 *      a locator. Listed here anyway so the fast path stays routed through
 *      the locator on future runs.
 *
 *   2. Explicit percentage bullet with parenthetical qualifier:
 *        - Made from 95% Cotton (80% Recycled Denim), 5% Other Fibres
 *      The parenthetical `(80% Recycled Denim)` doubles up the regex match
 *      and breaks the default extractor's 100% total check. We strip the
 *      parenthetical before feeding to the extractor. The surviving "5%
 *      Other Fibres" component is dropped and rebalanced into the largest
 *      trusted material via `dropOtherAndRebalance` (strictly capped at 5%
 *      and gated on all named materials being trusted and summing to ≥90%).
 *
 *   3. Dual-panel composition:
 *        - Made from 100% linen front and 100% organic cotton back
 *      Two independent 100% declarations for separate fabric panels. The
 *      default extractor sums to 200% and rejects. We detect the `100% X
 *      ... and 100% Y` shape and flatten to 50/50.
 *
 *   4. Prose-only single fiber (preloved items + a few legacy products):
 *        - "The Maria is crafted from a luxuriously soft lambswool."
 *        - "Made from Organic Cotton, the Lily-Ella is a round-neck sweater…"
 *        - "- Made from cotton needlecord"
 *      No percentage anywhere in body_html. We infer 100% of the single
 *      named fiber when (a) the body has no `%` anywhere and (b) a
 *      `Made from|crafted from` anchor captures a trailing fiber keyword
 *      that normalizes to a single trusted material. Each candidate is
 *      `\b<canonical>\b` word-boundary verified against the source tail
 *      to reject the material-extractor dictionary's substring bleed
 *      (e.g. "wool" inside "lambswool" would otherwise misclassify Maria).
 *
 * All regexes are anchored on sentence/line boundaries with character-class
 * negation (`[^\n]`, `[^,.\n%]`) — no nested quantifiers, no alternation
 * over overlapping ranges. Safe from the catastrophic-backtracking shape
 * that killed the earlier Beaumont attempt.
 */

import type { Locator, LocatedComposition } from "./types.js";
import {
  extractMaterialsFromText,
} from "../shared/parsers.js";
import { scanForFiberChunk } from "../shared/locate.js";
import { TRUSTED_MATERIALS } from "../../lib/curation.js";

/**
 * Drop a small "Other" / "Other Fibres" / "Other Fibers" component and
 * rebalance into the largest trusted material. Returns null if no "Other"
 * component is present, if the unspecified share exceeds the cap, or if
 * the surviving named materials aren't all trusted.
 *
 * Motivating case: Beaumont discloses recycled denim/wool blends as
 * "55% Recycled Cotton, 10% Cotton, 30% Recycled Wool, 5% Other" — the
 * 5% is undisclosed fibre from the recycling stream, typically natural
 * cellulose that survived the mechanical sort. Without this rebalance
 * the product stays in review forever despite being ~95% natural.
 *
 * This is a conservative policy choice:
 *   - Cap the rebalance at 5% (NOT 10%) to align with the strictest
 *     reading of the curation rules.
 *   - Require every OTHER material to be in TRUSTED_MATERIALS — we only
 *     lose the small unknown, never silently convert an untrusted bulk
 *     material.
 *   - Require named materials to sum to ≥90% before rebalance — rejects
 *     pathological inputs like "50% Cotton, 50% Other".
 *
 * Applied to both Strategy 1 (explicit bullet) and scanner fallbacks so
 * Finley/Geraldine (regex extraction → explicit Other) get the same
 * outcome as Dominique/Fleur (which slip through via an unrelated
 * dictionary re-attribution inside material-extractor.ts — see
 * sync-next-steps.md).
 */
const OTHER_NAMES = new Set(["Other", "Other Fibres", "Other Fibers"]);
const OTHER_MAX_PCT = 5;
const OTHER_MIN_NAMED_SUM = 90;

function dropOtherAndRebalance(
  mats: Record<string, number>
): Record<string, number> | null {
  let otherPct = 0;
  const named: Record<string, number> = {};
  for (const [name, pct] of Object.entries(mats)) {
    if (OTHER_NAMES.has(name)) {
      otherPct += pct;
    } else {
      named[name] = pct;
    }
  }
  if (otherPct === 0) return null;
  if (otherPct > OTHER_MAX_PCT) return null;
  const namedSum = Object.values(named).reduce((a, b) => a + b, 0);
  if (namedSum < OTHER_MIN_NAMED_SUM) return null;
  const namedKeys = Object.keys(named);
  if (namedKeys.length === 0) return null;
  if (!namedKeys.every((n) => TRUSTED_MATERIALS.has(n))) return null;
  // Absorb Other into the largest named component so we still hit
  // exactly 100% after rounding.
  namedKeys.sort((a, b) => named[b] - named[a]);
  named[namedKeys[0]] += otherPct;
  return named;
}

function withOtherRebalance(
  composition: LocatedComposition | null
): LocatedComposition | null {
  if (!composition) return composition;
  const rebalanced = dropOtherAndRebalance(composition.materials);
  if (!rebalanced) return composition;
  return { ...composition, materials: rebalanced };
}

/**
 * Strip HTML while preserving the `\d%` tokenization that the shared
 * material-extractor regex needs. `shared/parsers.stripHtml` replaces
 * every tag with a space, which turns `68<span>%` into `68 %` and
 * breaks the PCT_THEN_NAME regex (which requires `\d{1,3}%` with no
 * interior whitespace). Matching the private stripHtml in
 * `scripts/lib/material-extractor.ts`: block-level tags become newlines,
 * other tags disappear, so `68<span>% bamboo` → `68% bamboo`.
 */
function stripBodyHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, "")
    // Mojibake cleanup: Beaumont's CMS occasionally persists non-breaking
    // spaces as the literal character sequence `¬†` (U+00AC + U+2020),
    // the Windows-1252 rendering of UTF-8 bytes `\xc2\xa0`. Neither char
    // is whitespace, so `\s+` in the Made-from regex fails on rows like
    // "Made from¬†55% Recycled Cotton…" (Finley, Geraldine). Replace the
    // literal pair with a single space so downstream parsing works.
    .replace(/\u00ac\u2020/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Bullet line: `- Made from <rest of line>`. Single-line capture, bounded
// by newline, no nested quantifiers. Global flag so we can iterate every
// "Made from" occurrence — Beaumont's product descriptions often include
// a prose "…jumper made from recycled cotton denim fabric." sentence
// BEFORE the explicit "- Made from 95% …" bullet. The prose one has no
// percentage and fails extraction; we need to fall through to the bullet.
const MADE_FROM_LINE_RE = /Made from\s+([^\n]+)/gi;

// Dual-panel: `100% A ... and 100% B`. Negated character classes keep the
// captures bounded to a single clause.
const DUAL_PANEL_RE = /100\s*%\s*([^,.\n%]+?)\s+and\s+100\s*%\s*([^,.\n%]+)/i;

// Prose-only: `Made from <trailing phrase>` OR `crafted from <trailing
// phrase>`. Used only when the body has ZERO `%` signs anywhere. The
// captured phrase can include leading adjectives ("a luxuriously soft
// lambswool"); we progressively strip leading words and retry the
// extractor, letting the alias layer find the canonical fiber.
const PROSE_FIBER_RE = /(?:Made from|crafted from|made in)\s+([^,.<\n]+)/i;

export const beaumontOrganic: Locator = async (input) => {
  const body = input.shopifyProduct?.body_html || "";
  if (!body) {
    // Nothing cheap to work with — fall through to default path via scanner.
    try {
      return scanForFiberChunk(await input.fetchHtml(), "fallback_scan");
    } catch {
      return null;
    }
  }

  const stripped = stripBodyHtml(body);

  // Strategy 1: `Made from …` bullet. Iterate every occurrence — the first
  // match is often the prose description ("jumper made from recycled
  // cotton denim fabric") which has no percentage; we need to fall through
  // to the later "- Made from 95% …" bullet.
  for (const match of stripped.matchAll(MADE_FROM_LINE_RE)) {
    // Strip parentheticals (sub-percentages that trip the 100% sum check)
    // before feeding to the shared extractor.
    const cleaned = match[1].replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    const ex = extractMaterialsFromText(cleaned);
    if (ex && Object.keys(ex.materials).length > 0) {
      return withOtherRebalance({
        materials: ex.materials,
        confidence: 0.95,
        source: "fabric_div",
      });
    }

    // Strategy 1b: dual-panel "100% X ... and 100% Y" inside the same
    // Made-from line. Normalize each half via the shared extractor (lets
    // the alias layer handle trailing panel words like "front" / "back" /
    // "lining") and flatten to 50/50.
    const dp = cleaned.match(DUAL_PANEL_RE);
    if (dp) {
      const a = extractMaterialsFromText(`100% ${dp[1]}`);
      const b = extractMaterialsFromText(`100% ${dp[2]}`);
      if (a && b) {
        const nameA = Object.keys(a.materials)[0];
        const nameB = Object.keys(b.materials)[0];
        if (nameA && nameB && nameA !== nameB) {
          return {
            materials: { [nameA]: 50, [nameB]: 50 },
            confidence: 0.85,
            source: "fabric_div",
          };
        }
      }
    }
  }

  // Strategy 2: single-fiber prose inference. Only safe when the body has
  // no `%` sign anywhere — otherwise we'd mask a real composition with a
  // noisy "Made from X cotton dress" marketing sentence.
  if (!/\d\s*%/.test(stripped)) {
    const m = stripped.match(PROSE_FIBER_RE);
    if (m) {
      // Try progressively shorter tail suffixes so leading adjectives
      // ("a", "luxuriously", "soft", etc.) don't block the alias lookup.
      //
      // Each candidate is word-boundary verified: the extractor's
      // dictionary stage substring-matches material names (e.g.
      // "wool" matches inside "lambswool"), which would misclassify
      // Maria's "luxuriously soft lambswool" as plain "Wool". The
      // `\b<canonical>\b` check on the source tail catches this bleed
      // and falls through until we hit `"lambswool"` alone, which
      // alias-resolves cleanly to "Lambswool".
      const words = m[1].trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i++) {
        const tail = words.slice(i).join(" ");
        const ex = extractMaterialsFromText(`100% ${tail}`);
        if (!ex) continue;
        const names = Object.keys(ex.materials);
        if (names.length !== 1 || ex.materials[names[0]] !== 100) continue;
        const canonical = names[0].toLowerCase();
        const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const wordBoundary = new RegExp(`\\b${escaped}\\b`, "i");
        if (!wordBoundary.test(tail)) continue;
        return {
          materials: ex.materials,
          confidence: 0.85,
          source: "fabric_div",
        };
      }
    }
  }

  // Strategy 3: generic scanner fallback — first on the body_html, then on
  // the live product page. Keeps us on par with the default locator when
  // none of the brand-specific shapes hit.
  const bodyScan = scanForFiberChunk(body, "fallback_scan");
  if (bodyScan) return withOtherRebalance(bodyScan);

  try {
    const html = await input.fetchHtml();
    const ex = extractMaterialsFromText(html);
    if (ex && Object.keys(ex.materials).length > 0) {
      return withOtherRebalance({
        materials: ex.materials,
        confidence: 0.9,
        source: "product_page",
      });
    }
    return withOtherRebalance(scanForFiberChunk(html, "fallback_scan"));
  } catch {
    return null;
  }
};
