// Authorization helper. Always uses getUser(), which asks Supabase Auth to verify
// the token. getSession() only reads the cookie and must not be trusted on the server.
import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
