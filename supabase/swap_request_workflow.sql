create or replace function public.create_swap_request(
  p_shift_id uuid,
  p_requester_id uuid,
  p_target_employee_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_assignment_exists boolean;
  v_target_assignment_exists boolean;
begin
  if not exists (
    select 1
    from public.profiles
    where id = p_requester_id
      and (auth_user_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'Operazione non autorizzata';
  end if;

  select exists (
    select 1 from public.shift_assignments
    where shift_id = p_shift_id and employee_id = p_requester_id
  ) into v_requester_assignment_exists;

  if not v_requester_assignment_exists then
    raise exception 'Il richiedente non è assegnato a questo turno';
  end if;

  select exists (
    select 1 from public.shift_assignments
    where shift_id = p_shift_id and employee_id = p_target_employee_id
  ) into v_target_assignment_exists;

  if v_target_assignment_exists then
    raise exception 'Il collega selezionato è già assegnato a questo turno';
  end if;

  if exists (
    select 1 from public.swap_requests
    where shift_id = p_shift_id
      and requester_id = p_requester_id
      and target_employee_id = p_target_employee_id
      and status = 'pending'
  ) then
    raise exception 'Esiste già una richiesta pendente per questo collega';
  end if;

  insert into public.swap_requests (shift_id, requester_id, target_employee_id)
  values (p_shift_id, p_requester_id, p_target_employee_id);
end;
$$;

grant execute on function public.create_swap_request(uuid, uuid, uuid) to authenticated;

create or replace function public.respond_to_swap_request(
  p_swap_request_id uuid,
  p_decision text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.swap_requests%rowtype;
  v_assignment public.shift_assignments%rowtype;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decisione non valida';
  end if;

  select *
  into v_request
  from public.swap_requests
  where id = p_swap_request_id;

  if not found then
    raise exception 'Richiesta non trovata';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'La richiesta è già stata gestita';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_request.target_employee_id
      and (auth_user_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'Operazione non autorizzata';
  end if;

  if p_decision = 'rejected' then
    update public.swap_requests
    set status = 'rejected', responded_at = now()
    where id = p_swap_request_id;
    return;
  end if;

  select *
  into v_assignment
  from public.shift_assignments
  where shift_id = v_request.shift_id and employee_id = v_request.requester_id;

  if not found then
    raise exception 'Il turno del richiedente non esiste più';
  end if;

  if exists (
    select 1 from public.shift_assignments
    where shift_id = v_request.shift_id and employee_id = v_request.target_employee_id
  ) then
    raise exception 'Il collega è già assegnato al turno';
  end if;

  delete from public.shift_assignments
  where shift_id = v_request.shift_id and employee_id = v_request.requester_id;

  insert into public.shift_assignments (shift_id, employee_id, is_partial)
  values (v_request.shift_id, v_request.target_employee_id, v_assignment.is_partial);

  update public.swap_requests
  set status = 'accepted', responded_at = now()
  where id = p_swap_request_id;

  update public.swap_requests
  set status = 'cancelled', responded_at = now()
  where shift_id = v_request.shift_id
    and requester_id = v_request.requester_id
    and id <> p_swap_request_id
    and status = 'pending';
end;
$$;

grant execute on function public.respond_to_swap_request(uuid, text) to authenticated;