-- Una tienda puede tener varias sucursales o solo una.
-- Las tiendas que ya existen quedan habilitadas para no cambiar su uso.

alter table public.tiendas
  add column sucursales_habilitadas boolean not null default true;

create or replace function public.trg_cupo_sucursales()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.activa)
    or (tg_op = 'UPDATE' and new.activa and not old.activa) then
    if exists (
      select 1
      from public.tiendas as t
      where t.id = new.tienda_id
        and not t.sucursales_habilitadas
    ) and exists (
      select 1
      from public.sucursales as s
      where s.tienda_id = new.tienda_id
        and s.activa
        and s.id <> new.id
    ) then
      raise exception 'Esta tienda no tiene sucursales habilitadas.';
    end if;
    perform public.exigir_cupo_plan(new.tienda_id, 'sucursales');
  end if;
  return new;
end;
$$;
