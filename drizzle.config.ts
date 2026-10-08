import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load .env / .env.local locally. In production (Fly.io) DATABASE_URL is
// injected as a real environment variable and dotenv is a no-op.
config({ path: ".env" });
config({ path: ".env.local", override: true });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env and provide a value.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
