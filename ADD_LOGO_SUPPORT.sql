-- Add Logo Support to Server Tables
-- Supports both external URLs and Supabase Storage paths (e.g., "server-logos/brave.png")
-- Storage paths should be in format: bucket-name/path/to/image.jpg

-- Add logo_url column to system_servers (supports URLs or storage paths)
ALTER TABLE system_servers 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Add logo_url column to user_servers (supports URLs or storage paths)
ALTER TABLE user_servers 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Add comments explaining the field
-- Supports: External URLs (https://...) or Supabase Storage paths (bucket-name/path/to/image.jpg)
COMMENT ON COLUMN system_servers.logo_url IS 'Logo: External URL (https://...) or Storage path (server-logos/filename.png)';
COMMENT ON COLUMN user_servers.logo_url IS 'Logo: External URL (https://...) or Storage path (server-logos/filename.png)';

-- Update existing system servers with default logo URLs (optional - you can customize these)
UPDATE system_servers 
SET logo_url = CASE 
  WHEN id = 'brave' THEN 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/brave/brave-original.svg'
  WHEN id = 'maps' THEN 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg'
  WHEN id = 'github' THEN 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg'
  WHEN id = 'playwright' THEN 'https://playwright.dev/img/playwright-logo.svg'
  ELSE NULL
END
WHERE logo_url IS NULL;
