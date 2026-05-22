import fs from "fs";
import path from "path";

const migrationsDir = "supabase/migrations";
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql"));

const query = process.argv[2] || "trigger";
console.log(`Searching all SQL migrations for: "${query}"`);

for (const file of files) {
  const filepath = path.join(migrationsDir, file);
  const content = fs.readFileSync(filepath, "utf-8");
  if (content.toLowerCase().includes(query.toLowerCase())) {
    console.log(`Found in: ${file}`);
    // Print matching lines
    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      if (line.toLowerCase().includes(query.toLowerCase())) {
        console.log(`  Line ${idx + 1}: ${line.trim()}`);
      }
    });
  }
}
