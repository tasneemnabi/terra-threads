/**
 * Quick test: grab 4 pending products with no materials and run Gemini extraction.
 */
import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { extractMaterialsRegex } from "./lib/material-extractor.js";

// Load env
const envPath = path.resolve(__dirname, "..", ".env.local");
const env: Record<string, string> = {};
for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
    val = val.slice(1, -1);
  env[key] = val;
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY
);

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|li|ul|ol|h[1-6])[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#?\w+;/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  // 1. Find 4 pending products with no materials
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, raw_body_html, brands!inner(name)")
    .eq("sync_status", "pending")
    .not("raw_body_html", "is", null)
    .limit(20);

  if (error) { console.error(error); return; }

  // Filter to ones with no materials
  const ids = (products || []).map(p => p.id);
  const { data: mats } = await supabase
    .from("product_materials")
    .select("product_id")
    .in("product_id", ids);

  const hasMatSet = new Set((mats || []).map(m => m.product_id));
  const noMats = (products || []).filter(p => !hasMatSet.has(p.id)).slice(0, 4);

  console.log(`Found ${noMats.length} pending products with no materials:\n`);
  for (const p of noMats) {
    // @ts-ignore
    console.log(`  - ${p.name} (${p.brands?.name})`);
  }

  if (noMats.length === 0) { console.log("Nothing to test."); return; }

  // 1b. Test regex/dictionary extraction first
  console.log("\n--- Regex/Dictionary extraction ---\n");
  const llmNeeded: typeof noMats = [];
  for (const p of noMats) {
    const fakeProduct = {
      id: p.id, title: p.name, handle: "", vendor: "", product_type: "",
      body_html: p.raw_body_html || "", tags: [], variants: [],
    } as any;
    const result = extractMaterialsRegex(fakeProduct);
    if (result) {
      const mats = Object.entries(result.materials).map(([m, pct]) => `${pct}% ${m}`).join(", ");
      console.log(`  ✓ ${p.name}: ${mats} (confidence: ${result.confidence})`);
    } else {
      console.log(`  ✗ ${p.name}: no regex/dict match → LLM needed`);
      llmNeeded.push(p);
    }
  }

  if (llmNeeded.length === 0) {
    console.log("\nAll products handled by regex/dictionary! No LLM needed.");
    return;
  }

  // 2. Build Gemini prompt
  const productEntries = noMats.map((p, i) => {
    const desc = stripHtml(p.raw_body_html || "").slice(0, 800);
    return `[${i}] Product: ${p.name}\nDescription: ${desc}`;
  }).join("\n\n---\n\n");

  const prompt = `Extract material/fabric compositions from these product listings. Return ONLY a JSON array.

${productEntries}

Return a JSON array with one object per product, in order:
[
  {
    "index": 0,
    "materials": { "Material Name": percentage_number },
    "confidence": 0.0_to_1.0,
    "has_banned": true_or_false
  }
]

Rules:
- Material percentages must sum to 100 for each product
- Use standard names: "Organic Cotton", "Merino Wool", "Elastane", "Hemp", "Tencel Lyocell", "Silk", "Linen", "Wool", "Cotton", "Modal", "Viscose", etc.
- "Elastane", "Spandex", and "Lycra" should all be normalized to "Elastane"
- Set has_banned=true if polyester, nylon, acrylic, or polypropylene is present
- If you cannot determine a product's composition, use empty materials and confidence 0.0
- confidence: 0.9+ if explicitly stated, 0.6-0.8 if inferred, below 0.5 if guessing`;

  console.log("\n--- Sending to Gemini 2.5 Flash ---\n");

  // 3. Call Gemini
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  const response = await client.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    console.log("No JSON in response. Raw output:");
    console.log(text);
    return;
  }

  const results = JSON.parse(jsonMatch[0]);

  console.log("--- Results ---\n");
  for (const r of results) {
    const product = noMats[r.index];
    const mats = Object.entries(r.materials)
      .map(([m, p]) => `${p}% ${m}`)
      .join(", ");
    console.log(`${product.name}:`);
    console.log(`  Materials: ${mats || "(none found)"}`);
    console.log(`  Confidence: ${r.confidence}`);
    console.log(`  Banned: ${r.has_banned}`);
    console.log();
  }
}

main();
