
alter table public.restaurants
  add column if not exists facebook_url text,
  add column if not exists youtube_url text,
  add column if not exists telegram_url text,
  add column if not exists whatsapp_url text,
  add column if not exists linkedin_url text,
  add column if not exists website_url text;

