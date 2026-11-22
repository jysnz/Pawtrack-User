-- The address of a facility as it is written on its official papers (the physical address is where the pin is).
alter table public.shelters add column if not exists paper_address text;
alter table public.shelters drop constraint if exists shelters_paper_address_len;
alter table public.shelters add constraint shelters_paper_address_len check (paper_address is null or char_length(paper_address) <= 300);
notify pgrst, 'reload schema';
