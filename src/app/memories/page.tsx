import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlbumCreateForm } from "@/components/album-create-form";
import { AppFrame } from "@/components/app-frame";
import { Card } from "@/components/ui";
import { getProfilePageData } from "@/lib/navigation-data";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { Heart } from "@/components/heart";

function MemoriesLoading() {
  return (
    <AppFrame title="Our memories" className="memory-app-frame">
      <div className="memory-page skeleton-fade" aria-label="Loading memories">
        <section className="memory-intro memory-intro-skeleton" aria-hidden="true">
          <div className="memory-couple-people">
            <div className="memory-skeleton-person ui-skeleton" />
            <div className="memory-skeleton-person ui-skeleton" />
            <div className="memory-couple-heart"><Heart size={54} /></div>
          </div>
          <div className="memory-lock-copy">
            <div className="ui-skeleton mx-auto h-7 w-48 rounded-full" />
            <div className="ui-skeleton mx-auto mt-3 h-10 w-56 max-w-full rounded-card" />
          </div>
          <div className="ui-skeleton mx-auto mt-auto h-4 w-32 rounded-full" />
        </section>
        <div className="memory-content">
          <div className="ui-skeleton h-20 rounded-card" />
          <div className="ui-skeleton mt-5 h-7 w-36 rounded-full" />
          <div className="memory-skeleton-albums mt-4">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="ui-skeleton aspect-square rounded-card" key={index} />
            ))}
          </div>
        </div>
      </div>
    </AppFrame>
  );
}

export default function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ cleanup?: string; deleted?: string }>;
}) {
  return (
    <Suspense fallback={<MemoriesLoading />}>
      <MemoriesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MemoriesContent({
  searchParams,
}: {
  searchParams: Promise<{ cleanup?: string; deleted?: string }>;
}) {
  const query = await searchParams;
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
  const [profileData, albumAssets] = await Promise.all([
    getProfilePageData(user.id),
    Promise.all(albumRows.map(async (album) => {
      const { data: photos, count, error: photosError } = await supabase
        .from("photos")
        .select("id, album_id, storage_path, thumb_path", { count: "exact" })
        .eq("album_id", album.id)
        .order("created_at", { ascending: true })
        .limit(3);
      if (photosError) throw new Error(`Could not load album photos: ${photosError.message}`);
      return { albumId: album.id, count: count ?? 0, photos: photos ?? [] };
    })),
  ]);
  const coverPhotoIds = albumRows.flatMap((album) => album.cover_photo_id ? [album.cover_photo_id] : []);
  const { data: coverRows, error: coverRowsError } = coverPhotoIds.length
    ? await supabase.from("photos").select("id, album_id, storage_path, thumb_path").in("id", coverPhotoIds)
    : { data: [], error: null };
  if (coverRowsError) throw new Error(`Could not load album covers: ${coverRowsError.message}`);
  const photosByAlbum = new Map(albumAssets.map((asset) => [asset.albumId, asset.photos]));
  const coversByAlbum = new Map((coverRows ?? []).map((photo) => [photo.album_id, photo]));
  const previewsByAlbum = new Map(albumRows.map((album) => {
    const cover = coversByAlbum.get(album.id);
    const photos = photosByAlbum.get(album.id) ?? [];
    const previews = cover
      ? [cover, ...photos.filter((photo) => photo.id !== cover.id)].slice(0, 3)
      : photos.slice(0, 3);
    return [album.id, previews] as const;
  }));
  const uniquePreviewPhotos = [...new Map(
    [...previewsByAlbum.values()].flat().map((photo) => [photo.id, photo]),
  ).values()];
  const signedByPhoto = new Map<string, string>();
  if (uniquePreviewPhotos.length) {
    const paths = uniquePreviewPhotos.map((photo) => photo.thumb_path ?? photo.storage_path);
    const { data: signedUrls, error: signedError } = await supabase.storage.from("photos").createSignedUrls(paths, 3600);
    if (signedError || !signedUrls) throw new Error(`Could not create private album cover links: ${signedError?.message ?? "No links returned."}`);
    signedUrls.forEach((signed, index) => {
      const photo = uniquePreviewPhotos[index];
      if (!photo || signed.error || !signed.signedUrl) {
        throw new Error(`Could not create a private album cover link: ${signed.error ?? "No link returned."}`);
      }
      signedByPhoto.set(photo.id, signed.signedUrl);
    });
  }
  const photoCounts = new Map(albumAssets.map((asset) => [asset.albumId, asset.count]));
  const totalPhotos = albumAssets.reduce((total, asset) => total + asset.count, 0);
  const avatarUrls = new Map("avatarUrls" in profileData ? profileData.avatarUrls : []);
  const people = [
    profileData.myProfile,
    "partner" in profileData ? profileData.partner : null,
  ].filter((person) => person !== null);

  return (
    <AppFrame title="Our memories" className="memory-app-frame">
      <div className="memory-page">
        <section className="memory-intro" aria-label="Our shared memories">
          {/* <p className="memory-brand">LoveAlarm</p> */}
          <div className="memory-couple-people" aria-hidden="true">
            {[0, 1].map((slot) => {
              const person = people[slot];
              const avatar = person ? avatarUrls.get(person.id) : null;
              return (
                <span className={`memory-person memory-person-${slot + 1}`} key={person?.id ?? slot}>
                  {avatar ? <Image src={avatar} alt="" fill sizes="74px" unoptimized /> : <PersonIcon />}
                </span>
              );
            })}
            <span className="memory-couple-heart"><Heart size={60} /></span>
          </div>
          <div className="memory-lock-copy">
            <span className="memory-lock" aria-hidden="true"><LockIcon /></span>
            <h1>Your heart is locked</h1>
            <p>{totalPhotos} photos in {albumRows.length} albums.<br />Little moments, kept close.</p>
          </div>
          <a className="memory-scroll-cue" href="#memory-albums">
            Scroll for albums
            <span aria-hidden="true">⌄</span>
          </a>
        </section>

        <section className="memory-content" id="memory-albums">
          {query.cleanup === "failed" ? (
            <Card className="border-primary/50 text-sm">
              <p role="status">Album deleted, but some stored image files could not be removed. Please try again later or contact support.</p>
            </Card>
          ) : null}
          {query.deleted === "album" ? (
            <Card className="border-primary/50 text-sm"><p role="status">Album and photos deleted.</p></Card>
          ) : null}
          <details className="memory-create">
            <summary>
              <span className="memory-create-icon" aria-hidden="true">+</span>
              <span><strong>Start a new album</strong><small>Ring a new memory together.</small></span>
            </summary>
            <div className="memory-create-form"><AlbumCreateForm /></div>
          </details>

          <h2 className="memory-albums-title">Our albums</h2>
          {albumRows.length ? (
            <ol className="memory-timeline" aria-label="Memory albums">
              {albumRows.map((album, index) => {
                const previews = previewsByAlbum.get(album.id) ?? [];
                const photoCount = photoCounts.get(album.id) ?? 0;
                return (
                  <li className="memory-timeline-item" key={album.id}>
                    <span className="memory-timeline-dot" aria-hidden="true" />
                    <Link href={`/memories/${album.id}`} className="memory-timeline-card">
                      <span className="memory-preview-grid" aria-hidden="true">
                        {Array.from({ length: 3 }, (_, previewIndex) => {
                          const photo = previews[previewIndex];
                          const src = photo ? signedByPhoto.get(photo.id) : null;
                          return photo && src ? (
                            <span className={`memory-preview memory-preview-${previewIndex + 1}`} key={photo.id}>
                              <Image src={src} alt="" fill sizes="(max-width: 430px) 50vw, 190px" unoptimized priority={index === 0} loading={index === 0 ? undefined : "lazy"} decoding="async" />
                            </span>
                          ) : (
                            <span className={`memory-preview memory-preview-${previewIndex + 1} memory-preview-placeholder`} key={`placeholder-${previewIndex}`} />
                          );
                        })}
                      </span>
                      <span className="memory-album-info">
                        <span className="memory-album-copy">
                          <strong>{album.title}</strong>
                          <small>{new Date(`${album.album_date}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</small>
                        </span>
                        <span className="memory-photo-count">{photoCount} {photoCount === 1 ? "photo" : "photos"}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <Card className="memory-no-albums text-center">
              No albums yet. Create your first album above to start saving memories.
            </Card>
          )}
        </section>
      </div>
    </AppFrame>
  );
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.7-3.6 3.3-5.5 7.5-5.5s6.8 1.9 7.5 5.5" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2.5" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}
