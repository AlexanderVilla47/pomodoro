import { betterAuth } from "better-auth";
import { Pool } from "pg";

const rawUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
const isSupabase = rawUrl?.includes("supabase");
// Strip sslmode from connection string so our ssl config takes precedence over it
const url = rawUrl?.replace(/([?&])sslmode=[^&]*/g, "$1").replace(/[?&]+$/, "");

export const auth = betterAuth({
  database: new Pool({
    connectionString: url,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  }),
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
