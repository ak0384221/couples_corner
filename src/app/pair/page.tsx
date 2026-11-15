import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { respondPairRequest } from "@/app/actions";
import { PairRequestForm } from "@/components/pair-request-form";
import { AppFrame } from "@/components/app-frame";
import { Card, Field } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
type SearchParams = Promise<{ username?: string; sent?: string; declined?: string; email?: string; optional?: string }>;

export default async function PairPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id, name").eq("id", user.id).maybeSingle();
  if (profileError) throw new Error(`Could not load your profile: ${profileError.message}`);
  if (!profile) redirect("/profile/setup");
  const { data: membership, error: membershipError } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (membership) redirect("/");

  const { data: requestData, error: requestsError } = await supabase.rpc("get_my_pair_requests");
  if (requestsError) throw new Error(`Could not load pairing requests: ${requestsError.message}`);
  const requestSchema = z.array(z.object({
    request_id: z.string().uuid(),
    direction: z.enum(["incoming", "outgoing"]),
    status: z.string(),
    created_at: z.string(),
    other_id: z.string().uuid(),
    other_name: z.string(),
    other_username: z.string(),
    other_bio: z.string().nullable(),
    other_photo_path: z.string().nullable(),
  }));
  const parsedRequests = requestSchema.safeParse(requestData ?? []);
  if (!parsedRequests.success) throw new Error("Pairing request data did not match the expected format.");
  const requests = parsedRequests.data;
  let matches: { id: string; name: string; username: string; bio: string | null; photo_path: string | null }[] = [];
  if (params.username) {
    const { data, error } = await supabase.rpc("search_profile_by_username", { p_username: params.username });
    if (error) throw new Error(`Could not search for that username: ${error.message}`);
    const profileSchema = z.array(z.object({
      id: z.string().uuid(),
      name: z.string(),
      username: z.string(),
      bio: z.string().nullable(),
      photo_path: z.string().nullable(),
    }));
    const parsedProfiles = profileSchema.safeParse(data ?? []);
    if (!parsedProfiles.success) throw new Error("Profile search returned an unexpected result.");
    matches = parsedProfiles.data;
  }
  const incoming = (requests ?? []).filter((request) => request.direction === "incoming");
  const outgoing = (requests ?? []).filter((request) => request.direction === "outgoing");
  const avatarPaths = [
    ...incoming.map((request) => request.other_photo_path),
    ...matches.map((match) => match.photo_path),
  ].filter((path): path is string => Boolean(path));
  const avatarUrls = await Promise.all(avatarPaths.map(async (path) => {
    const { data, error } = await supabase.storage.from("photos").createSignedUrl(path, 3600);
    if (error) throw new Error(`Could not create a private profile image link: ${error.message}`);
    return [path, data.signedUrl] as const;
  }));
  const avatarMap = new Map(avatarUrls);

  return (
    <AppFrame title={`Hi, ${profile.name}`}>
      <div className="space-y-4">
        {incoming.map((request) => (
          <Card key={request.request_id}>
            <div className="flex items-center gap-3">
              {request.other_photo_path && avatarMap.get(request.other_photo_path) ? <Image src={avatarMap.get(request.other_photo_path)!} alt="" width={64} height={64} unoptimized className="h-16 w-16 rounded-full object-cover" /> : <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blush text-2xl">{request.other_name.charAt(0)}</span>}
              <p className="text-xl font-bold">{request.other_name} wants to pair with you</p>
            </div>
            <p className="mt-2 text-sm text-ink-soft">@{request.other_username} · {request.other_bio ?? "Ready to share a little corner."}</p>
            <div className="mt-4 rounded-field bg-blush p-3 text-sm">Accepting links your accounts. Your dates and memories stay private to the two of you.</div>
            <div className="mt-4 flex gap-2">
              <form action={respondPairRequest} className="flex-1">
                <input type="hidden" name="request_id" value={request.request_id} />
                <input type="hidden" name="accept" value="true" />
                <button className="primary-button w-full">Accept and pair</button>
              </form>
              <form action={respondPairRequest}>
                <input type="hidden" name="request_id" value={request.request_id} />
                <input type="hidden" name="accept" value="false" />
                <button className="secondary-button">Not now</button>
              </form>
            </div>
          </Card>
        ))}
        {outgoing.length ? <Card><p className="font-bold">Pair request sent</p><p className="mt-1 text-sm text-ink-soft">Waiting for @{outgoing[0]?.other_username} to accept.</p></Card> : null}
        <Card className="bg-blush">
          <p className="font-bold">{params.optional ? "Your profile is ready!" : "Pair whenever you are ready"}</p>
          <p className="mt-1 text-sm text-ink-soft">Find your partner now, or skip this and add them later from your home screen, Profile, or Settings.</p>
          <Link className="secondary-button mt-4 w-full" href="/">Do this later</Link>
        </Card>
        <Card>
          <h2 className="text-xl font-bold">Find your partner</h2>
          <p className="mt-1 text-sm text-ink-soft">Type their exact username and check the profile before sending.</p>
          <form method="get" className="mt-4 space-y-3">
            <Field label="Username" name="username" placeholder="Their username" required maxLength={21} />
            <button className="secondary-button w-full">Find profile</button>
          </form>
          {matches.map((match) => (
            <div key={match.id} className="mt-4 rounded-card border border-line p-4">
              <div className="flex items-center gap-3">
                {match.photo_path && avatarMap.get(match.photo_path) ? <Image src={avatarMap.get(match.photo_path)!} alt="" width={56} height={56} unoptimized className="h-14 w-14 rounded-full object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blush text-xl">{match.name.charAt(0)}</span>}
                <p className="font-bold">{match.name}</p>
              </div>
              <p className="text-sm text-primary">@{match.username}</p>
              <p className="mt-1 text-sm text-ink-soft">{match.bio || "A little corner is waiting."}</p>
              <PairRequestForm profileId={match.id} />
            </div>
          ))}
          {params.username && matches.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No profile found for that exact username.</p> : null}
          {params.sent ? <p role="status" className="mt-3 font-semibold text-primary">Your request is on its way.</p> : null}
          {params.email === "not-sent" ? <p role="status" className="mt-3 text-sm text-ink-soft">The in-app request was saved. Email delivery is paused for now.</p> : null}
          {params.declined ? <p role="status" className="mt-3 text-sm text-ink-soft">Request declined.</p> : null}
        </Card>
      </div>
    </AppFrame>
  );
}
