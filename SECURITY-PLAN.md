# Security Remediation Plan — FIBER

**Created**: 2026-04-12
**Sources**: `SECURITY-AUDIT.md`, `INDEPENDENT-SECURITY-REVIEW.md`
**Status**: IN PROGRESS

Both audits converged on the same core issues. This plan synthesizes them into a single prioritized remediation checklist with concrete implementation steps.

---

## Overview

| # | Issue | Severity | Effort | Status |
|---|-------|----------|--------|--------|
| 1 | Update Next.js 16.1.6 → 16.2.3 | CRITICAL | 5 min | [x] |
| 2 | Delete admin routes and server actions | CRITICAL | 5 min | [x] |
| 3 | Fix PostgREST filter injection in search | HIGH | 15 min | [x] |
| 4 | Restrict remote image patterns | HIGH | 15 min | [x] |
| 5 | Add security headers | MEDIUM | 15 min | [x] |
| 6 | ~~Sanitize error messages in admin actions~~ | ~~LOW~~ | — | [x] Resolved by #2 |
| 7 | Tighten RLS on `products` table | MEDIUM | 30 min | [ ] |
| 8 | Add rate limiting to public server actions | MEDIUM | 1–2 hrs | [x] |

---

## 1. Update Next.js to 16.1.7

**Severity**: CRITICAL
**Why**: 6 known CVEs in 16.1.6, including a Server Actions CSRF bypass (null origin) that is directly exploitable given this app's reliance on server actions.

### Steps

```bash
npm install next@16.1.7
```

- Run `npm audit` after to confirm zero remaining framework advisories.
- Smoke-test the dev server and verify pages render.

---

## 2. Delete admin routes and server actions

**Severity**: CRITICAL
**Why**: `/admin/review` and its 4 server actions (`updateProductStatus`, `batchUpdateStatus`, `approveAllPendingForBrand`, `updateProductMaterials`) use the Supabase service key with zero auth checks. Anyone who discovers the URL can approve, reject, or rewrite product data. Rather than adding auth to an internal tool, remove it entirely — product review/approval is handled via CLI scripts, not a web UI.

### Steps

**a) Delete the admin route directory:**

```
rm -rf src/app/admin/
```

This removes:
- `src/app/admin/review/page.tsx`
- `src/app/admin/review/actions.ts`
- `src/app/admin/review/ReviewDashboard.tsx`

**b) Delete the admin Supabase client if no other code uses it:**

Check for other imports of `createAdminClient` outside of `src/app/admin/`. If none, delete `src/lib/supabase/admin.ts`.

**c) Verification**

- `/admin/review` returns 404.
- No server actions referencing the service key are exposed to the web.
- Grep the `src/` tree for `createAdminClient` — zero hits.

---

## 3. Fix PostgREST filter injection in search

**Severity**: HIGH
**Why**: `searchProducts()` in `src/lib/queries/products.ts:51` interpolates raw user input into a `.or()` filter string. Special characters (`,`, `.`, `(`, `)`) can alter query semantics or enumerate data.

### Steps

Replace the current implementation:

```typescript
// BEFORE (vulnerable)
.or(`name.ilike.%${query}%,brand_name.ilike.%${query}%`)

// AFTER (safe)
const escaped = query.replace(/[%_\\]/g, "\\$&");
// Also strip PostgREST filter metacharacters
const safe = escaped.replace(/[,.()]/g, "");

// Use the sanitized value
.or(`name.ilike.%${safe}%,brand_name.ilike.%${safe}%`)
```

Better alternative — use a Supabase RPC with a parameterized `ILIKE`:

```sql
create or replace function search_products(p_query text, p_limit int default 48)
returns setof products_with_materials as $$
  select * from products_with_materials
  where name ilike '%' || p_query || '%'
     or brand_name ilike '%' || p_query || '%'
  order by created_at desc
  limit p_limit;
$$ language sql stable;
```

Then call via `supabase.rpc("search_products", { p_query: query, p_limit: limit })`.

### Verification

- Search for `test,id.neq.` → returns empty, no error.
- Search for `%_().,` → no crash, no unexpected results.
- Normal searches still work.

---

## 4. Restrict remote image patterns

**Severity**: HIGH
**Why**: `next.config.ts` allows `http` and `https` images from `hostname: "**"` — any origin. This enables SSRF through Next.js image optimization, user privacy leakage, and amplifies the `next/image` disk cache CVE.

### Steps

Replace the wildcard with an explicit allowlist in `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com" },
      { protocol: "https", hostname: "*.shopify.com" },
      // Add other known brand CDN domains as needed
    ],
  },
};
```

- Remove the `http` protocol entirely — all legitimate product images should be HTTPS.
- Audit the database for non-Shopify image URLs and add those specific domains if needed.
- For non-Shopify brands using arbitrary hosts, consider proxying images through a rehosting step during ingestion.

### Verification

- Product pages with Shopify images render correctly.
- An image URL pointing to an internal/private IP is rejected.

---

## 5. Add security headers

**Severity**: MEDIUM
**Why**: No `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or `Strict-Transport-Security` headers are configured. Vercel provides some defaults, but explicit headers significantly reduce XSS and clickjacking risk.

### Steps

Add a `headers()` function to `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ],
    },
  ],
  // ... existing config
};
```

A full CSP can be added later — start with these four headers as a baseline.

---

## ~~6. Sanitize error messages in admin actions~~

Resolved by item 2 — admin actions are deleted entirely.

---

## 7. Tighten RLS on `products` table

**Severity**: MEDIUM
**Why**: The `products` table RLS policy is `for select using (true)`, which means the browser anon key can read all rows — including rejected, pending, and review products with operational fields like `shopify_product_id`, `shopify_variant_id`, `raw_body_html`, and `sync_status`.

### Steps

**a) Restrict the products SELECT policy to approved rows only:**

```sql
-- Drop the existing overly-permissive policy
drop policy "Products are viewable by everyone" on products;

-- Replace with an approved-only policy
create policy "Products are viewable by everyone"
  on products for select
  using (sync_status = 'approved');
```

**b) Add explicit deny-all write policies as defense-in-depth:**

```sql
-- Explicit deny for writes from anon (belt-and-suspenders)
create policy "No public inserts" on products for insert with check (false);
create policy "No public updates" on products for update using (false);
create policy "No public deletes" on products for delete using (false);

-- Same for product_materials
create policy "No public inserts" on product_materials for insert with check (false);
create policy "No public updates" on product_materials for update using (false);
create policy "No public deletes" on product_materials for delete using (false);
```

**c) Verification:**

- Query `products` directly with the anon key → only `approved` rows returned.
- Query via `products_with_materials` view → still works (it already filters to approved).
- Admin operations via service key → still bypass RLS as expected.

---

## 8. Add rate limiting to public server actions

**Severity**: MEDIUM
**Why**: `fetchSearchResults`, `fetchProducts`, and other public server actions accept unlimited calls. Combined with the filter injection (item 3), this enables rapid data enumeration. Even after fixing injection, unlimited calls are a DoS vector.

### Approach

Use a simple in-memory rate limiter for the MVP (no external dependency needed). Upgrade to Upstash Redis-based rate limiting if traffic grows or for multi-instance deployments.

### Steps

**a) Create `src/lib/rate-limit.ts`:**

```typescript
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}
```

**b) Apply to `fetchSearchResults` in `src/app/shop/actions.ts`:**

```typescript
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";

export async function fetchSearchResults(query: string) {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for") ?? "unknown";
  if (!rateLimit(`search:${ip}`, 30, 60_000)) {
    return [];
  }
  // ... existing logic
}
```

**c) Consider also adding Vercel WAF rate limiting rules at the platform level for `/admin/*` and search endpoints.**

---

## Execution Order

The items are already numbered in priority order. The recommended approach:

1. **Items 1–4 first** (critical/high) — these are the items where real damage can occur.
2. **Item 5 next** (quick win) — 15 minutes, meaningful hardening.
3. **Items 7–8 last** (defense-in-depth) — important but lower blast radius.

Items 1, 2, 3, 4, and 5 are independent and can all be done in parallel.
Item 6 is resolved by item 2 (deleting admin routes removes the error-leaking code).
Item 7 requires a database migration and should be tested against the staging environment first.

---

## Verification Checklist

After all remediations:

- [x] `npm audit` shows 0 vulnerabilities (Next.js upgraded to 16.2.3)
- [x] `/admin/review` returns 404 (entire admin directory deleted)
- [x] No `createAdminClient` imports remain in `src/app/` (admin.ts deleted)
- [x] Search with `%,id.neq.` returns empty, no error (input sanitized)
- [x] Non-allowlisted image domains are rejected by `next/image` (explicit allowlist)
- [x] Response headers include `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Strict-Transport-Security`
- [x] ~~Admin error messages don't leak DB internals~~ (resolved by deleting admin routes)
- [ ] Anon key can only read approved products from `products` table (requires DB migration)
- [x] Rapid search requests from a single IP are throttled after 30/min
