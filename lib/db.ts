import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

// Conexão lazy: só abre no primeiro uso em runtime (o build não precisa de DATABASE_URL)
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada. Verifique .env.local");
    _db = drizzle(neon(url), { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get: (_t, prop) => Reflect.get(getDb(), prop),
});
