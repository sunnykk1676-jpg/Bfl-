-- Loan Status Portal — applications table
create table if not exists public.applications (
  id bigint generated always as identity primary key,
  application_id text not null unique,
  customer_name text not null,
  mobile text not null,
  loan_type text default '',
  loan_amount numeric default 0,
  status text not null default 'Pending',
  remarks text default '',
  last_updated date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists applications_application_id_idx
  on public.applications (application_id);

create index if not exists applications_mobile_idx
  on public.applications (mobile);

-- Row Level Security: only the server (using the service role key) can read/write.
-- No anon/public access — the browser never talks to Supabase directly.
alter table public.applications enable row level security;
