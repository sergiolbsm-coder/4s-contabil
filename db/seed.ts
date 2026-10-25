import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

// Cria (se não existirem) o primeiro escritório e o administrador da plataforma.
// Dados vêm de SEED_* em .env.local — nada de senha no código.
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const senha = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !senha) throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD em .env.local");
  const nome = process.env.SEED_ESCRITORIO_NOME ?? "Meu Escritório";
  const slug = (process.env.SEED_ESCRITORIO_SLUG ?? "meu-escritorio").toLowerCase();

  const sql = neon(process.env.DATABASE_URL!);
  await sql.query(`INSERT INTO escritorios (nome, slug) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING`, [nome, slug]);
  const [esc] = await sql.query(`SELECT id FROM escritorios WHERE slug = $1`, [slug]);
  const hash = await bcrypt.hash(senha, 10);
  await sql.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel, escritorio_id, superadmin) VALUES ($1, $2, $3, 'admin', $4, true) ON CONFLICT (email) DO NOTHING`,
    ["Administrador", email, hash, esc.id],
  );
  console.log("ok:", slug, email);
}
main();
