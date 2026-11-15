import { notFound } from "next/navigation";
import { AlbumManagement } from "@/components/album-management";
import { MemoryPhotoForm } from "@/components/memory-photo-form";
import { PhotoGallery } from "@/components/photo-gallery";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cleanup?: string; deleted?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
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
    .select("id, storage_path, thumb_path, created_at")
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
    return { id: photo.id, url, thumbnailUrl };
  });

  return (
    <AppFrame title={album.title} backHref="/memories">
      <div className="space-y-4">
        {query.cleanup === "failed" ? (
          <Card className="border-primary/50 text-sm">
            <p role="status">The item was deleted, but some stored image files could not be removed. Please try again later or contact support.</p>
          </Card>
        ) : null}
        {query.deleted === "photo" ? (
          <Card className="border-primary/50 text-sm"><p role="status">Photo deleted.</p></Card>
        ) : null}
        <div className="flex items-center justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            <p className="font-bold">{new Date(`${album.album_date}T12:00:00`).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{gallery.length} {gallery.length === 1 ? "photo" : "photos"}</p>
          </div>
          <AlbumManagement albumId={album.id} title={album.title} albumDate={album.album_date} key={`${album.id}-${album.title}-${album.album_date}`} />
        </div>
        <MemoryPhotoForm albumId={album.id} />
        {gallery.length ? <PhotoGallery photos={gallery} albumId={album.id} albumTitle={album.title} /> : (
          <Card className="text-center text-sm text-ink-soft">Choose a few photos to start this album.</Card>
        )}
      </div>
    </AppFrame>
  );
}
