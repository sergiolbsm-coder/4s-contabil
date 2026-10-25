import * as dotenv from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

// Aplica os .sql do drizzle-kit em ordem e registra cada um em _migracoes (roda só o que falta)
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const files = readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort();

  await sql.query(`CREATE TABLE IF NOT EXISTS _migracoes (nome text PRIMARY KEY, aplicada_em timestamp NOT NULL DEFAULT now())`);
  const feitas = new Set((await sql.query(`SELECT nome FROM _migracoes`)).map((r) => r.nome as string));

  // Bancos criados antes do controle: as 3 primeiras migrações já estão aplicadas
  if (feitas.size === 0 && (await sql.query(`SELECT to_regclass('public.usuarios') AS t`))[0].t) {
    for (const f of files.filter((f) => /^000[0-2]_/.test(f))) {
      await sql.query(`INSERT INTO _migracoes (nome) VALUES ($1)`, [f]);
      feitas.add(f);
    }
  }

  for (const f of files) {
    if (feitas.has(f)) continue;
    for (const stmt of readFileSync(`db/migrations/${f}`, "utf8").split("--> statement-breakpoint")) {
      if (stmt.trim()) await sql.query(stmt);
    }
    await sql.query(`INSERT INTO _migracoes (nome) VALUES ($1)`, [f]);
    console.log("aplicada", f);
  }
  console.log("migrações em dia");
}
main();
