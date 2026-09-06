-- Row Level Security policies for a Supabase deployment of PodMind AI.
-- The Next.js backend talks to Postgres with a privileged role and enforces authorization itself
-- (see src/server/services/*). When the same tables are exposed through Supabase's PostgREST /
-- client SDK, these policies guarantee users only ever see their own rows.
--
-- Assumes `users.id` mirrors `auth.users.id` (Supabase auth). Run in the Supabase SQL editor.

alter table users          enable row level security;
alter table sessions       enable row level security;
alter table subscriptions  enable row level security;
alter table usage          enable row level security;
alter table podcasts       enable row level security;
alter table billing_events enable row level security;

-- Profiles: a user can read/update only their own profile.
create policy "profiles: own read"   on users for select using (auth.uid() = id);
create policy "profiles: own update" on users for update using (auth.uid() = id);

-- Sessions are server-only (service role bypasses RLS). No client policies on purpose.

-- Subscriptions: read own only. Writes happen server-side via the billing service / webhooks.
create policy "subscriptions: own read" on subscriptions for select using (auth.uid() = user_id);

-- Usage: read own only. Increments are server-side.
create policy "usage: own read" on usage for select using (auth.uid() = user_id);

-- Podcasts: owners have full access to their own rows.
create policy "podcasts: own select" on podcasts for select using (auth.uid() = user_id);
create policy "podcasts: own insert" on podcasts for insert with check (auth.uid() = user_id);
create policy "podcasts: own update" on podcasts for update using (auth.uid() = user_id);
create policy "podcasts: own delete" on podcasts for delete using (auth.uid() = user_id);

-- Public podcast pages: anyone (including anonymous) may read podcasts explicitly marked public and completed.
create policy "podcasts: public read" on podcasts for select
  using (visibility = 'public' and status = 'completed');

-- Billing events: read own only.
create policy "billing_events: own read" on billing_events for select using (auth.uid() = user_id);

-- Storage buckets (uploads, audio, covers) must be PRIVATE. Media is served only through
-- /api/media/* and /api/podcasts/:id/download using short-lived signed tokens.
