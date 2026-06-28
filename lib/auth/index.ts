import { betterAuth } from "better-auth";
import { Pool } from "pg";

const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
const isSupabase = url?.includes("supabase");

export const auth = betterAuth({
  database: new Pool({
    connectionString: url,
    ssl: isSupabase ? { rejectUnauthorized: false } : false,
  }),
  user: {
    tableName: "users",
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
