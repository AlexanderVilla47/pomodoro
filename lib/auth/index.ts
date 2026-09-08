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
  // El default de better-auth es 7 dias, y como el Max-Age de la cookie sale
  // de aca, la sesion moria a los 7 dias del login aunque la fila en la base
  // siguiera viva. 90 dias con deslizamiento diario: quien entra al menos una
  // vez cada 90 dias no vuelve a ver la pantalla de login.
  session: {
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
