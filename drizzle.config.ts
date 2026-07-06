import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Next stores secrets in .env.local; drizzle-kit only reads .env by default, so load it explicitly.
config({ path: ".env.local" });

// Migrations use the DIRECT connection (port 5432), not the pooler.
// The placeholder lets `drizzle-kit generate` run offline; `push`/`migrate` need a real URL.
const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgres://user:pass@localhost:5432/db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
