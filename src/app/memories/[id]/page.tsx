import Image from "next/image";
import { notFound } from "next/navigation";
import { MemoryPhotoForm } from "@/components/memory-photo-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase.from("couple_members").select("couple_id").eq("user_id", user.id).maybeSingle();
  if (membershipError) throw new Error(`Could not load pairing: ${membershipError.message}`);
  if (!membership) notFound();
  const { data: album, error } = await supabase.from("albums").select("id, title, album_date").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load album: ${error.message}`);
  if (!album) notFound();
  const { data: photos, error: photosError } = await supabase.from("photos").select("id, storage_path, caption, created_at").eq("album_id", id).order("created_at", { ascending: true });
  if (photosError) throw new Error(`Could not load photos: ${photosError.message}`);
  const gallery = await Promise.all((photos ?? []).map(async (photo) => {
    const { data, error: signedError } = await supabase.storage.from("photos").createSignedUrl(photo.storage_path, 3600);
    if (signedError) throw new Error(`Could not create a private photo link: ${signedError.message}`);
    return { ...photo, url: data.signedUrl };
  }));
  return (
    <AppFrame title={album.title} backHref="/memories">
      <div className="space-y-4">
        <Card>
          <p className="font-bold">{new Date(`${album.album_date}T12:00:00`).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</p>
          <p className="mt-1 text-sm text-ink-soft">{gallery.length} {gallery.length === 1 ? "photo" : "photos"}</p>
        </Card>
        <div className="grid grid-cols-2 gap-2">
          {gallery.map((photo) => (
            <figure className="overflow-hidden rounded-field bg-card" key={photo.id}>
              <Image src={photo.url} alt={photo.caption || `Photo from ${album.title}`} width={500} height={500} unoptimized className="aspect-square w-full object-cover" />
              {photo.caption ? <figcaption className="p-2 text-sm">{photo.caption}</figcaption> : null}
            </figure>
          ))}
        </div>
        <Card>
          <h2 className="mb-3 text-lg font-bold">Add a photo</h2>
          <MemoryPhotoForm albumId={album.id} />
        </Card>
      </div>
    </AppFrame>
  );
}
