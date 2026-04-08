# Design Audit: /brands
**Date:** 2026-03-31
**URL:** http://localhost:3000/brands
**Viewport:** 1440x900 (desktop), 768x1024 (tablet), 375x812 (mobile)

---

## First Impression

- The site communicates **"curated natural fiber brand directory."**
- I notice **the headline has strong editorial energy, but the card grid below reads as a flat database listing — there's a disconnect between the brand voice and the visual delivery.**
- The first 3 things my eye goes to are: **1) the H1 headline**, **2) the dusty rose "OUR CURATION" label**, **3) the uniform card grid**.
- If I had to describe this in one word: **"clean"** — but verging on sterile.

---

## Design System Comparison

| Property | Spec | Actual | Status |
|---|---|---|---|
| Display font | Space Grotesk | Space Grotesk | PASS |
| Body font | DM Sans | DM Sans | PASS |
| Background | #FAF7F2 | #FAF7F2 | PASS |
| Accent (dusty rose) | #A3535A | #A3535A | PASS |
| Slate secondary | #475658 | #475658 | PASS |
| H1 display size | 56-72px | **48px** | FAIL |
| Heading levels | No skipped levels | H1 -> H3 (no H2) | FAIL |
| Body text | 16-18px | 17px | PASS |
| Caption tracking | 0.08em | 0.12em | DEVIATION |
| Grid gap | 32px (groups) | 20px | DEVIATION |
| Footer touch targets | >= 44px | **19px** | FAIL |
| Off-palette color | warm neutrals | #757575 (pure gray) | DEVIATION |

---

## Findings

### HIGH IMPACT

**FINDING-001: H1 undersized at 48px (spec: 56-72px)**
- I notice the headline feels appropriate for a section heading, not a page hero.
- What if the H1 were 56px? It would establish the editorial authority the brand promises.
- Category: Typography
- Severity: HIGH

**FINDING-002: No active state on "Brands" nav link**
- I notice the "Brands" link looks identical to "Shop" and "About" — same color (rgb(44,36,32)), same weight (400).
- I think the current page's nav link needs differentiation because users have no orientation.
- Category: Interaction States
- Severity: HIGH

**FINDING-003: H1 missing `text-wrap: balance`**
- I notice "Brands that never / use plastic." breaks with a short orphan line.
- What if `text-wrap: balance` were applied? The two lines would have more equal visual weight.
- Category: Typography
- Severity: HIGH

**FINDING-004: Footer link touch targets at 19px**
- I notice footer links are only 19px tall — less than half the 44px WCAG minimum.
- Category: Interaction States / Accessibility
- Severity: HIGH

**FINDING-005: Skipped heading level (H1 -> H3, no H2)**
- I notice brand names jump from H1 to H3. Screen readers and SEO expect sequential levels.
- I think these should be H2 since they're the primary content headings on the page.
- Category: Typography / Accessibility
- Severity: HIGH

### MEDIUM IMPACT

**FINDING-006: Grid gap 20px vs 32px spec**
- I notice the cards feel slightly cramped. The design system specifies 32px for group spacing.
- Category: Spacing & Layout
- Severity: MEDIUM

**FINDING-007: Filter button missing hover state**
- I notice hovering over "Filter & Sort" produces no visual change — the button feels inert.
- What if it darkened slightly or shifted border color on hover?
- Category: Interaction States
- Severity: MEDIUM

**FINDING-008: All brand logos lazy-loaded (even above fold)**
- All 29 `<img>` elements have `loading="lazy"`. The first 3-6 visible logos should be eager.
- Category: Performance
- Severity: MEDIUM

**FINDING-009: Caption tracking too wide (0.12em vs 0.08em spec)**
- The "OUR CURATION" eyebrow uses `tracking-[0.12em]` instead of the specified `0.08em`.
- Category: Typography
- Severity: MEDIUM

### POLISH

**FINDING-010: Off-palette pure gray (#757575)**
- A neutral gray exists somewhere in the palette. All grays should be warm-tinted.
- Category: Color & Contrast
- Severity: POLISH

**FINDING-011: Nav link touch targets 42px (just under 44px)**
- Nav links measure 42px tall — 2px short of the 44px minimum.
- Category: Interaction States
- Severity: POLISH

**FINDING-012: No font preconnect hints**
- No `<link rel="preconnect">` tags found. Could improve font loading speed.
- Category: Performance
- Severity: POLISH

---

## Scores (Baseline)

| Category | Weight | Grade | Notes |
|---|---|---|---|
| Visual Hierarchy | 15% | B- | H1 undersized, empty right half of hero |
| Typography | 15% | C+ | H1 size, no balance, skipped level, tracking deviation |
| Color & Contrast | 10% | B+ | Palette on-spec except one off-palette gray |
| Spacing & Layout | 15% | B | Grid gap tight, hero spacing oversized |
| Interaction States | 10% | B | Card hover good, filter button + footer links bad |
| Responsive | 10% | A | Clean mobile/tablet breakpoints, proper collapse |
| Motion & Animation | 5% | B+ | Card hover transitions smooth, panel slides in |
| Content & Microcopy | 10% | A- | Strong headline, clear copy, good pill labels |
| AI Slop | 5% | A | No AI patterns detected — clean, intentional design |
| Performance | 5% | B | All-lazy images, no preconnect, but no console errors |

### **Design Score: B**
### **AI Slop Score: A**

---

## Litmus Checks

1. Brand/product unmistakable in first screen? **YES** — "FIBER" + "Brands that never use plastic" is clear
2. One strong visual anchor? **YES** — the headline
3. Page understandable by scanning headlines? **YES** — headline + brand names tell the story
4. Each section has one job? **YES** — hero = mission, grid = browse
5. Are cards actually necessary? **YES** — cards ARE the interaction (link to brand pages)
6. Does motion improve hierarchy? **YES** — card hover confirms clickability
7. Premium feel without decorative shadows? **YES** — shadows only appear on hover (functional)

---

## Fix Plan

Fixes ordered by impact. All are CSS-only or minimal JSX changes.

| # | Finding | Type | Risk |
|---|---|---|---|
| 1 | FINDING-001: H1 size 48px -> 56px | CSS | Low |
| 2 | FINDING-003: Add text-wrap: balance to H1 | CSS | Low |
| 3 | FINDING-005: H3 -> H2 for brand names | JSX | Low |
| 4 | FINDING-002: Active nav state | CSS/JSX | Low |
| 5 | FINDING-004: Footer link touch targets | CSS | Low |
| 6 | FINDING-006: Grid gap 20px -> 32px | CSS | Low |
| 7 | FINDING-007: Filter button hover state | CSS | Low |
| 8 | FINDING-009: Caption tracking 0.12em -> 0.08em | CSS | Low |
| 9 | FINDING-008: Above-fold images eager loading | JSX | Low |
