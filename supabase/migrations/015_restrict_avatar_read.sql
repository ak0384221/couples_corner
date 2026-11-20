-- Avatar files are private to their owner and current couple.
-- This also means profile discovery can no longer display another user's avatar
-- until the two users are paired.
drop policy if exists photos_avatars_read on storage.objects;

create policy photos_avatars_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = 'avatars'
    and array_length(storage.foldername(name), 1) = 2
    and (
      (storage.foldername(name))[2] = (select auth.uid())::text
      or exists (
        select 1
        from public.couple_members as avatar_owner
        where avatar_owner.user_id::text = (storage.foldername(name))[2]
          and avatar_owner.couple_id = (select public.current_couple_id())
      )
    )
  );
