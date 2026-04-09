import { getSupabaseAdmin } from "./lib/env.js";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("Usage: npx tsx scripts/delete-brand.ts <brand-slug>");
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from("brands").delete().eq("slug", slug);
  if (error) {
    console.error("Delete failed:", error.message);
    process.exit(1);
  }
  console.log(`Deleted brand: ${slug}`);
}

main();
