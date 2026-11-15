import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlbumCreateForm } from "@/components/album-create-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

function MemoriesLoading() {
  return (
    <AppFrame title="Our memories">
      <div className="space-y-4" aria-label="Loading memories">
        <div className="h-20 animate-pulse rounded-card border border-line bg-card" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="aspect-square animate-pulse rounded-card bg-line" key={index} />
          ))}
        </div>
      </div>
    </AppFrame>
  );
}

export default function MemoriesPage() {
  return (
    <Suspense fallback={<MemoriesLoading />}>
      <MemoriesContent />
    </Suspense>
  );
}

async function MemoriesContent() {
  const user = await requireUser();
  const supabase = await createClient();
  const [membershipResult, albumsResult] = await Promise.all([
    supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("albums").select("id, title, album_date, cover_photo_id").order("album_date", { ascending: false }),
  ]);
  const { data: membership, error: membershipError } = membershipResult;
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (!membership) return <AppFrame title="Memories"><Card>Pair your accounts before keeping shared memories.</Card></AppFrame>;
  const { data: albums, error } = albumsResult;
  if (error) throw new Error(`Could not load albums: ${error.message}`);
  const albumRows = albums ?? [];
  const [counts, fallbackCovers] = await Promise.all([
    Promise.all(albumRows.map(async (album) => {
      const { count, error: countError } = await supabase
        .from("photos")
        .select("id", { count: "exact", head: true })
        .eq("album_id", album.id);
      if (countError) throw new Error(`Could not count album photos: ${countError.message}`);
      return [album.id, count ?? 0] as const;
    })),
    Promise.all(albumRows.filter((album) => !album.cover_photo_id).map(async (album) => {
      const { data, error: coverError } = await supabase
        .from("photos")
        .select("id, album_id, storage_path, thumb_path")
        .eq("album_id", album.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (coverError) throw new Error(`Could not load album cover: ${coverError.message}`);
      return data;
    })),
  ]);
  const coverPhotoIds = albumRows.flatMap((album) => album.cover_photo_id ? [album.cover_photo_id] : []);
  const { data: coverRows, error: coverRowsError } = coverPhotoIds.length
    ? await supabase.from("photos").select("id, album_id, storage_path, thumb_path").in("id", coverPhotoIds)
    : { data: [], error: null };
  if (coverRowsError) throw new Error(`Could not load album covers: ${coverRowsError.message}`);
  const covers = new Map<string, { storage_path: string; thumb_path: string | null }>();
  for (const photo of [...(coverRows ?? []), ...fallbackCovers.filter((photo) => photo !== null)]) {
    covers.set(photo.album_id, { storage_path: photo.storage_path, thumb_path: photo.thumb_path });
  }
  const coverEntries = [...covers.entries()].flatMap(([albumId, cover]) =>
    [[albumId, cover.thumb_path ?? cover.storage_path] as const],
  );
  const signedByAlbum = new Map<string, string>();
  if (coverEntries.length) {
    const paths = coverEntries.map(([, path]) => path);
    const { data: signedUrls, error: signedError } = await supabase.storage.from("photos").createSignedUrls(paths, 3600);
    if (signedError || !signedUrls) throw new Error(`Could not create private album cover links: ${signedError?.message ?? "No links returned."}`);
    signedUrls.forEach((signed, index) => {
      const coverEntry = coverEntries[index];
      if (!coverEntry || signed.error || !signed.signedUrl) {
        throw new Error(`Could not create a private album cover link: ${signed.error ?? "No link returned."}`);
      }
      signedByAlbum.set(coverEntry[0], signed.signedUrl);
    });
  }
  const photoCounts = new Map(counts);

  return (
    <AppFrame title="Our memories">
      <div className="space-y-4">
        <Card className="bg-blush">
          <p className="text-sm font-bold">Little moments, kept close.</p>
          <p className="mt-1 text-sm text-ink-soft">Only small, private photo copies are stored here.</p>
        </Card>
        <div className="grid grid-cols-2 gap-3">
          {albumRows.map((album, index) => {
            const cover = signedByAlbum.get(album.id);
            return (
              <Link key={album.id} href={`/memories/${album.id}`} className="overflow-hidden rounded-card border border-line bg-card">
                {cover ? <Image src={cover} alt="" width={300} height={300} unoptimized priority={index < 2} loading={index < 2 ? undefined : "lazy"} decoding="async" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-blush text-4xl">♡</div>}
                <div className="p-3">
                  <p className="truncate font-bold">{album.title}</p>
                  <p className="text-xs text-ink-soft">{new Date(`${album.album_date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })} · {photoCounts.get(album.id) ?? 0} photos</p>
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
