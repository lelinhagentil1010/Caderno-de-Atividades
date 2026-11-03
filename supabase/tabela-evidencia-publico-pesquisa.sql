-- Atividade "Público e Pesquisa de Conteúdo" (Caderno Programa Evidência)
-- Rode uma vez no Supabase: SQL Editor > New query > cole tudo > Run.
-- Cria a tabela onde o cartão guarda as respostas (uma linha por aluno),
-- no mesmo formato das outras atividades (user_id + respostas + comentario_professor).

create table if not exists public.evidencia_publico_pesquisa (
  user_id uuid primary key references auth.users(id) on delete cascade,
  respostas jsonb not null default '{}'::jsonb,
  comentario_professor text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at sempre atualizado (o painel da professora ordena por ele)
create or replace function public.evidencia_publico_pesquisa_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists evidencia_publico_pesquisa_updated_at on public.evidencia_publico_pesquisa;
create trigger evidencia_publico_pesquisa_updated_at
  before update on public.evidencia_publico_pesquisa
  for each row execute function public.evidencia_publico_pesquisa_set_updated_at();

alter table public.evidencia_publico_pesquisa enable row level security;

-- Aluno: lê, cria e atualiza só a própria linha
drop policy if exists "evidencia_publico_pesquisa: aluno le a propria" on public.evidencia_publico_pesquisa;
create policy "evidencia_publico_pesquisa: aluno le a propria" on public.evidencia_publico_pesquisa
  for select using (auth.uid() = user_id);

drop policy if exists "evidencia_publico_pesquisa: aluno cria a propria" on public.evidencia_publico_pesquisa;
create policy "evidencia_publico_pesquisa: aluno cria a propria" on public.evidencia_publico_pesquisa
  for insert with check (auth.uid() = user_id);

drop policy if exists "evidencia_publico_pesquisa: aluno atualiza a propria" on public.evidencia_publico_pesquisa;
create policy "evidencia_publico_pesquisa: aluno atualiza a propria" on public.evidencia_publico_pesquisa
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Professora (role = 'admin' em profiles): lê todas e salva o comentário
drop policy if exists "evidencia_publico_pesquisa: admin le todas" on public.evidencia_publico_pesquisa;
create policy "evidencia_publico_pesquisa: admin le todas" on public.evidencia_publico_pesquisa
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "evidencia_publico_pesquisa: admin atualiza" on public.evidencia_publico_pesquisa;
create policy "evidencia_publico_pesquisa: admin atualiza" on public.evidencia_publico_pesquisa
  for update using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
