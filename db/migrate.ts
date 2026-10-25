import * as dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

// Aplica os .sql gerados pelo drizzle-kit em ordem (statements separados por "--> statement-breakpoint")
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const files = readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    for (const stmt of readFileSync(`db/migrations/${f}`, "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await sql.query(stmt);
    }
    console.log("aplicada", f);
  }
}
main();
