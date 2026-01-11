-- Remove the legacy Google Workspace system server
delete from public.system_servers where id = 'google-workspace';
