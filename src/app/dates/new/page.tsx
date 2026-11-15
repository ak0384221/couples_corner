import { redirect } from "next/navigation";
import { DateForm } from "@/components/date-form";
import { AppFrame } from "@/components/app-frame";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_DATE_OPTIONS, isDateOptionCategory } from "@/lib/date-options";

export default async function NewDatePage() {
  const user = await requireUser();
  const supabase = await createClient();
  const [membershipResult, placesResult] = await Promise.all([
    supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("places").select("id, name, address, visit_count").eq("saved", true).order("visit_count", { ascending: false }),
  ]);
  const { data: membership, error: membershipError } = membershipResult;
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (!membership) redirect("/pair");
  if (placesResult.error) throw new Error(`Could not load saved places: ${placesResult.error.message}`);
  const optionsResult = await supabase
    .from("date_options")
    .select("id, category, label, sort_order")
    .order("sort_order")
    .order("created_at");
  if (optionsResult.error) throw new Error(`Could not load date choices: ${optionsResult.error.message}`);
  let options = optionsResult.data;
  if (!options.length) {
    const seed = Object.entries(DEFAULT_DATE_OPTIONS).flatMap(([category, labels]) =>
      labels.map((label, sort_order) => ({
        couple_id: membership.couple_id,
        category,
        label,
        sort_order,
      })),
    );
    const { error: seedError } = await supabase
      .from("date_options")
      .upsert(seed, { onConflict: "couple_id,category,label", ignoreDuplicates: true });
    if (seedError) throw new Error(`Could not initialize date choices: ${seedError.message}`);
    const refreshed = await supabase
      .from("date_options")
      .select("id, category, label, sort_order")
      .order("sort_order")
      .order("created_at");
    if (refreshed.error) throw new Error(`Could not load date choices: ${refreshed.error.message}`);
    options = refreshed.data;
  }
  const typedOptions = (options ?? []).flatMap((option) =>
    isDateOptionCategory(option.category) ? [option] : [],
  );
  return <AppFrame title="Plan our date" backHref="/"><DateForm places={placesResult.data ?? []} options={typedOptions} /></AppFrame>;
}
