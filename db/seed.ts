import * as dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: ".env.local" });

// Cria o admin inicial a partir de SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (nada de senha no código)
async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const senha = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !senha) throw new Error("Defina SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD em .env.local");
  const sql = neon(process.env.DATABASE_URL!);
  const hash = await bcrypt.hash(senha, 10);
  await sql.query(
    `INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING`,
    ["Administrador", email, hash],
  );
  console.log("admin ok:", email);
}
main();
