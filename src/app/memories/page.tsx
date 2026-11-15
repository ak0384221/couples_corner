import Image from "next/image";
import Link from "next/link";
import { AlbumCreateForm } from "@/components/album-create-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MemoriesPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (!membership) return <AppFrame title="Memories"><Card>Pair your accounts before keeping shared memories.</Card></AppFrame>;
  const { data: albums, error } = await supabase.from("albums").select("id, title, album_date, cover_photo_id").order("album_date", { ascending: false });
  if (error) throw new Error(`Could not load albums: ${error.message}`);
  const albumIds = (albums ?? []).map((album) => album.id);
  const { data: photos, error: photosError } = albumIds.length
    ? await supabase.from("photos").select("id, album_id, storage_path, created_at").in("album_id", albumIds).order("created_at", { ascending: true })
    : { data: [], error: null };
  if (photosError) throw new Error(`Could not load album covers: ${photosError.message}`);
  const firstPhotos = new Map<string, { id: string; storage_path: string }>();
  for (const photo of photos ?? []) if (!firstPhotos.has(photo.album_id)) firstPhotos.set(photo.album_id, photo);

  const coverUrls = new Map<string, string>();
  for (const album of albums ?? []) {
    const cover = firstPhotos.get(album.id);
    if (cover) {
      const { data, error: signedError } = await supabase.storage.from("photos").createSignedUrl(cover.storage_path, 3600);
      if (signedError) throw new Error(`Could not create a private photo link: ${signedError.message}`);
      coverUrls.set(album.id, data.signedUrl);
    }
  }

  return (
    <AppFrame title="Our memories">
      <div className="space-y-4">
        <Card className="bg-blush">
          <p className="text-sm font-bold">Little moments, kept close.</p>
          <p className="mt-1 text-sm text-ink-soft">Only the small, private copies are stored here.</p>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          {(albums ?? []).map((album) => {
            const cover = coverUrls.get(album.id);
            return (
              <Link key={album.id} href={`/memories/${album.id}`} className="overflow-hidden rounded-card border border-line bg-card">
                {cover ? <Image src={cover} alt="" width={300} height={200} unoptimized className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-blush text-4xl">♡</div>}
                <div className="p-3">
                  <p className="truncate font-bold">{album.title}</p>
                  <p className="text-xs text-ink-soft">{new Date(`${album.album_date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} · {(photos ?? []).filter((photo) => photo.album_id === album.id).length} photos</p>
                </div>
              </Link>
            );
          })}
        </div>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Start a new album</h2>
          <AlbumCreateForm />
        </Card>
      </div>
    </AppFrame>
  );
}
