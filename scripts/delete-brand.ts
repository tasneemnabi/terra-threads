import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/delete-brand.ts <brand-slug>");
    process.exit(1);
  }

  const env = loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;
  const supabase = createClient(url, key);

  const { error } = await supabase.from("brands").delete().eq("slug", slug);
  if (error) {
    console.error("Delete failed:", error.message);
    process.exit(1);
  }
  console.log(`Deleted brand: ${slug}`);
}

main();
