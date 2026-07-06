// Drizzle client for server-side queries (Server Components / Server Actions).
// Uses the pooled Supabase connection; `prepare: false` is required for the
// transaction pooler (pgBouncer).

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no está definida (ver .env.local.example)");
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
