import { notFound } from "next/navigation";
import { MemoryPhotoForm } from "@/components/memory-photo-form";
import { PhotoGallery } from "@/components/photo-gallery";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const [membershipResult, albumResult] = await Promise.all([
    supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle(),
    supabase.from("albums").select("id, title, album_date").eq("id", id).maybeSingle(),
  ]);
  const { data: membership, error: membershipError } = membershipResult;
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (!membership) notFound();
  const { data: album, error: albumError } = albumResult;
  if (albumError) throw new Error(`Could not load album: ${albumError.message}`);
  if (!album) notFound();

  const { data: photos, error: photosError } = await supabase
    .from("photos")
    .select("id, storage_path, thumb_path, caption, created_at")
    .eq("album_id", id)
    .order("created_at", { ascending: true });
  if (photosError) throw new Error(`Could not load photos: ${photosError.message}`);

  const photoRows = photos ?? [];
  const paths = [...new Set(photoRows.flatMap((photo) => [photo.storage_path, photo.thumb_path ?? photo.storage_path]))];
  const { data: signedUrls, error: signedError } = paths.length
    ? await supabase.storage.from("photos").createSignedUrls(paths, 3600)
    : { data: [], error: null };
  if (signedError) throw new Error(`Could not create private photo links: ${signedError.message}`);
  const urls = new Map<string, string>();
  for (const signed of signedUrls ?? []) {
    if (signed.error || !signed.path || !signed.signedUrl) {
      throw new Error(`Could not create a private photo link: ${signed.error ?? "No link returned."}`);
    }
    urls.set(signed.path, signed.signedUrl);
  }
  const gallery = photoRows.map((photo) => {
    const url = urls.get(photo.storage_path);
    const thumbnailUrl = urls.get(photo.thumb_path ?? photo.storage_path) ?? null;
    if (!url) throw new Error("Could not create a private link for every album photo.");
    return { id: photo.id, url, thumbnailUrl, caption: photo.caption };
  });

  return (
    <AppFrame title={album.title} backHref="/memories">
      <div className="space-y-4">
        <Card className="flex items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate font-bold">{new Date(`${album.album_date}T12:00:00`).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</p>
            <p className="mt-1 text-sm text-ink-soft">{gallery.length} {gallery.length === 1 ? "photo" : "photos"}</p>
          </div>
          <MemoryPhotoForm albumId={album.id} />
        </Card>
        {gallery.length ? <PhotoGallery photos={gallery} albumTitle={album.title} /> : (
          <Card className="text-center text-sm text-ink-soft">Choose a few photos to start this album.</Card>
        )}
      </div>
    </AppFrame>
  );
}
