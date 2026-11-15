import Image from "next/image";
import Link from "next/link";
import { respondClosetPreference, sendClosetPreference } from "@/app/actions";
import { ClosetItemForm } from "@/components/closet-item-form";
import { AppFrame } from "@/components/app-frame";
import { Card, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function ClosetPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (!membership) return <AppFrame title="Our closet"><Card>Pair your accounts before building a shared closet.</Card></AppFrame>;
  const { data: members, error: membersError } = await supabase.from("couple_members").select("user_id").eq("couple_id", membership.couple_id);
  if (membersError) throw new Error(`Could not load couple members: ${membersError.message}`);
  const partnerId = members?.find((member) => member.user_id !== user.id)?.user_id;
  const { data: items, error: itemsError } = await supabase.from("closet_items").select("id, owner_id, photo_path, kind, name, main_color").order("created_at", { ascending: false });
  if (itemsError) throw new Error(`Could not load closet items: ${itemsError.message}`);
  const itemViews = await Promise.all((items ?? []).map(async (item) => {
    const { data, error } = await supabase.storage.from("photos").createSignedUrl(item.photo_path, 3600);
    if (error) throw new Error(`Could not create a private closet image link: ${error.message}`);
    return { ...item, url: data.signedUrl };
  }));
  const { data: dates, error: datesError } = await supabase.from("dates").select("id, name, day, start_time, status, place_id").neq("status", "cancelled").order("day", { ascending: true });
  if (datesError) throw new Error(`Could not load dates for outfit planning: ${datesError.message}`);
  const { data: preferences, error: preferenceError } = await supabase.from("closet_preferences").select("id, date_id, created_by, status, created_at").order("created_at", { ascending: false }).limit(10);
  if (preferenceError) throw new Error(`Could not load outfit requests: ${preferenceError.message}`);
  const preferenceIds = (preferences ?? []).map((preference) => preference.id);
  const { data: preferenceItems, error: preferenceItemsError } = preferenceIds.length
    ? await supabase.from("closet_preference_items").select("preference_id, item_id, side").in("preference_id", preferenceIds)
    : { data: [], error: null };
  if (preferenceItemsError) throw new Error(`Could not load chosen outfit pieces: ${preferenceItemsError.message}`);

  const ownItems = itemViews.filter((item) => item.owner_id === user.id);
  const partnerItems = itemViews.filter((item) => item.owner_id === partnerId);
  const types = ["Dresses", "Bags", "Jewelry", "His", "Shoes"];
  return (
    <AppFrame title="Our closet" backHref="/">
      <div className="space-y-4">
        <Card className="bg-blush">
          <h2 className="text-xl font-bold">Looks for a date</h2>
          <p className="mt-1 text-sm text-ink-soft">Pick a date, choose both outfits, and send a separate look request.</p>
        </Card>
        {preferences?.map((preference) => {
          const date = dates?.find((item) => item.id === preference.date_id);
          const incoming = preference.created_by !== user.id;
          return (
            <Card key={preference.id}>
              <p className="font-bold">{date?.name || "Date outfit"} · {preference.status}</p>
              <p className="mt-1 text-sm text-ink-soft">{incoming ? "Your partner picked some looks for you." : "Waiting for your partner to answer."}</p>
              <p className="mt-2 text-sm">{(preferenceItems ?? []).filter((item) => item.preference_id === preference.id).map((chosen) => itemViews.find((item) => item.id === chosen.item_id)?.name).filter(Boolean).join(" · ") || "No item names available"}</p>
              {incoming && preference.status === "pending" ? (
                <div className="mt-4 space-y-3">
                  <form action={respondClosetPreference}>
                    <input type="hidden" name="preference_id" value={preference.id} />
                    <input type="hidden" name="answer" value="accept" />
                    <button className="primary-button w-full">Accept looks</button>
                  </form>
                  <form action={respondClosetPreference} className="space-y-3">
                    <input type="hidden" name="preference_id" value={preference.id} />
                    <input type="hidden" name="answer" value="change" />
                    <p className="text-sm font-bold">Suggest a change · choose your pieces</p>
                    <div className="flex flex-wrap gap-2">
                      {ownItems.map((item) => (
                        <label className="choice-chip" key={item.id}>
                          <input className="sr-only" type="checkbox" name="partner_item_id" value={item.id} />
                          <span>{item.name}</span>
                        </label>
                      ))}
                    </div>
                    <button className="secondary-button w-full">Send different looks</button>
                  </form>
                </div>
              ) : null}
            </Card>
          );
        })}
        <Card>
          <SectionTitle>Choose looks for a date</SectionTitle>
          <form action={sendClosetPreference} className="space-y-4">
            <label className="field-label">
              <span>Which date?</span>
              <select className="field-input" name="date_id" required defaultValue="">
                <option value="" disabled>Pick a date</option>
                {(dates ?? []).map((date) => (
                  <option value={date.id} key={date.id}>
                    {date.name || "Our date"} · {new Date(`${date.day}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })} · {date.status}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <p className="mb-2 text-sm font-bold">Your look</p>
              <div className="flex flex-wrap gap-2">{ownItems.map((item) => (
                <label className="choice-chip" key={item.id}><input className="sr-only" type="checkbox" name="creator_item_id" value={item.id} /><span>{item.name}</span></label>
              ))}</div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold">A match for your partner</p>
              <div className="flex flex-wrap gap-2">{partnerItems.map((item) => (
                <label className="choice-chip" key={item.id}><input className="sr-only" type="checkbox" name="partner_item_id" value={item.id} /><span>{item.name}</span></label>
              ))}</div>
            </div>
            <button className="primary-button w-full">Send closet preference</button>
          </form>
        </Card>
        {types.map((type) => {
          const sectionItems = itemViews.filter((item) => type === "His" ? item.owner_id === partnerId : item.kind.toLowerCase() === type.toLowerCase().replace(/s$/, ""));
          return (
            <section key={type}>
              <h2 className="mb-2 text-lg font-bold">{type}</h2>
              {sectionItems.length ? (
                <div className="grid grid-cols-2 gap-3">
                  {sectionItems.map((item) => (
                    <Card className="overflow-hidden p-0" key={item.id}>
                      <Image src={item.url} alt={item.name} width={400} height={400} unoptimized className="aspect-square w-full object-cover" />
                      <div className="p-3"><p className="font-bold">{item.name}</p><p className="text-xs text-ink-soft">{item.main_color || item.kind} · {item.owner_id === user.id ? "Yours" : "Partner"}</p></div>
                    </Card>
                  ))}
                </div>
              ) : <p className="rounded-card border border-dashed border-line p-4 text-sm text-ink-soft">Nothing here yet.</p>}
            </section>
          );
        })}
        <Card>
          <h2 className="mb-3 text-lg font-bold">Add an item</h2>
          <ClosetItemForm />
          <Link className="mt-3 block text-center text-sm font-bold text-primary" href="/settings/appearance">Make it feel like yours →</Link>
        </Card>
      </div>
    </AppFrame>
  );
}
