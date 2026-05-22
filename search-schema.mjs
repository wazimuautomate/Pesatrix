import fs from "fs";

const filepath = "supabase/migrations/001_rebuild_pesatrix_schema.sql";
const content = fs.readFileSync(filepath, "utf-8");

function search(query) {
  console.log(`=== Searching for: "${query}" ===`);
  const regex = new RegExp(query, "gi");
  let match;
  let count = 0;
  while ((match = regex.exec(content)) !== null) {
    count++;
    const index = match.index;
    const start = Math.max(0, index - 300);
    const end = Math.min(content.length, index + 500);
    console.log(`[Match ${count}] near character ${index}:`);
    console.log(content.slice(start, end));
    console.log("------------------------------------------");
    if (count >= 5) break;
  }
  if (count === 0) console.log("No matches found.");
}

const args = process.argv.slice(2);
const query = args[0] || "sync_wallet_from_transactions";
search(query);
