-- Allow trusted contacts to be saved outside of a group.
alter table public.trusted_contacts
  alter column group_category drop default,
  alter column group_category drop not null;