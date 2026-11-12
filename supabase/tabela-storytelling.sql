-- Caderno "Storytelling que posiciona"
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Cria a tabela onde o cartão guarda as respostas (uma linha por aluno),
-- no mesmo formato das outras atividades (user_id + respostas + comentario_professor).

create table if not exists public.storytelling (
  user_id uuid primary key references auth.users(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,
  comentario_professor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at sempre atualizado (o painel da professora ordena por ele)
create or replace function public.storytelling_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists storytelling_updated_at on public.storytelling;
create trigger storytelling_updated_at
  before update on public.storytelling
  for each row execute function public.storytelling_set_updated_at();

alter table public.storytelling enable row level security;

-- Aluno: lê, cria e atualiza só a própria linha
drop policy if exists "storytelling: aluno le a propria" on public.storytelling;
create policy "storytelling: aluno le a propria" on public.storytelling
  for select using (auth.uid() = user_id);

drop policy if exists "storytelling: aluno cria a propria" on public.storytelling;
create policy "storytelling: aluno cria a propria" on public.storytelling
  for insert with check (auth.uid() = user_id);

drop policy if exists "storytelling: aluno atualiza a propria" on public.storytelling;
create policy "storytelling: aluno atualiza a propria" on public.storytelling
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Professora (role = 'admin' em profiles): lê todas e salva o comentário
drop policy if exists "storytelling: admin le todas" on public.storytelling;
create policy "storytelling: admin le todas" on public.storytelling
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "storytelling: admin atualiza" on public.storytelling;
create policy "storytelling: admin atualiza" on public.storytelling
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
