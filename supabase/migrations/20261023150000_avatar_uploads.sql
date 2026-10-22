-- Profile picture uploads: public bucket, written only by the server (service role)
-- after validating the file signature. Users can point their profile at their own
-- folder only.
begin;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 98304, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles drop constraint profiles_image_check;
alter table public.profiles add constraint profiles_image_check check (
  image = ''
  or image ~ '^/assets/avatars/avatar-([1-9]|10)\.png$'
  or image ~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/'
              || id::text || '/[0-9a-f]{16}\.(webp|jpg)$')
);

commit;
