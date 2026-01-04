-- Migration: Add Logo Support to Server Tables
-- Description: Adds logo_url field to system_servers and user_servers tables

-- Add logo_url to system_servers table
ALTER TABLE system_servers 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Add logo_url to user_servers table
ALTER TABLE user_servers 
ADD COLUMN IF NOT EXISTS logo_url text;

-- Add comments
COMMENT ON COLUMN system_servers.logo_url IS 'URL to server logo/image (optional)';
COMMENT ON COLUMN user_servers.logo_url IS 'URL to server logo/image (optional)';

-- Optionally update existing system servers with placeholder logos
-- You can customize these URLs with actual logo URLs later
UPDATE system_servers 
SET logo_url = CASE 
  WHEN id = 'brave' THEN 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/brave/brave-original.svg'
  WHEN id = 'maps' THEN 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/google/google-original.svg'
  WHEN id = 'github' THEN 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg'
  WHEN id = 'playwright' THEN 'https://playwright.dev/img/playwright-logo.svg'
  ELSE NULL
END
WHERE logo_url IS NULL;
