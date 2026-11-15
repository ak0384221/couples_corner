import { redirect } from "next/navigation";
import { DateForm } from "@/components/date-form";
import { AppFrame } from "@/components/app-frame";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function NewDatePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (!membership) redirect("/pair");
  const { data: places, error } = await supabase.from("places").select("id, name, address, visit_count").eq("saved", true).order("visit_count", { ascending: false });
  if (error) throw new Error(`Could not load saved places: ${error.message}`);
  return <AppFrame title="Plan our date" backHref="/"><DateForm places={places ?? []} /></AppFrame>;
}
