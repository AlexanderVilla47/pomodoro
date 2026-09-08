import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";

/**
 * /login es una URL que el usuario puede tener bookmarkeada, y sin este
 * chequeo le muestra el login aunque su sesion este perfectamente viva: quien
 * guardo ese link en vez de la home tiene que iniciar sesion cada vez que abre
 * la app. El espejo de app/page.tsx, que manda aca cuando NO hay sesion.
 */
export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/");
  return <LoginForm />;
}
