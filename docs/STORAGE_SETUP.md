# Supabase Storage Setup for Server Logos

## Overview

The `logo_url` field in `system_servers` and `user_servers` tables supports two formats:

1. **External URL**: `https://example.com/logo.png`
2. **Supabase Storage Path**: `server-logos/brave.png` (will be converted to full URL)

## Step 1: Create Storage Bucket

Run this SQL to create a storage bucket for server logos:

```sql
-- Create storage bucket for server logos (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public)
VALUES ('server-logos', 'server-logos', true)
ON CONFLICT (id) DO NOTHING;
```

Or via Dashboard:
1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Name: `server-logos`
4. Public bucket: **Yes** (checked)
5. Click **Create bucket**

## Step 2: Set Storage Policies

Run this SQL to allow public read access:

```sql
-- Allow public read access to server logos
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'server-logos');

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'server-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow users to update their own uploads
CREATE POLICY "Users can update their uploads"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'server-logos' 
  AND auth.role() = 'authenticated'
);

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete their uploads"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'server-logos' 
  AND auth.role() = 'authenticated'
);
```

## Step 3: Upload Logo Images

### Option A: Via Supabase Dashboard
1. Go to **Storage** → **server-logos**
2. Click **Upload file**
3. Upload your logo images (e.g., `brave.png`, `github.png`)
4. Note the file path: `server-logos/filename.png`

### Option B: Via Supabase Client (JavaScript/TypeScript)
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Upload logo
const { data, error } = await supabase.storage
  .from('server-logos')
  .upload('brave.png', file)

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('server-logos')
  .getPublicUrl('brave.png')
```

## Step 4: Store Logo Path in Database

### For External URLs:
```sql
UPDATE system_servers 
SET logo_url = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/brave/brave-original.svg'
WHERE id = 'brave';
```

### For Supabase Storage:
Use the storage path format: `server-logos/filename.png`

```sql
UPDATE system_servers 
SET logo_url = 'server-logos/brave.png'
WHERE id = 'brave';
```

## Step 5: Get Full Storage URL in Application

In your application code, convert storage paths to full URLs:

```typescript
function getLogoUrl(logoUrl: string | undefined, supabaseUrl: string): string | undefined {
  if (!logoUrl) return undefined;
  
  // If it's already a full URL, return as-is
  if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
    return logoUrl;
  }
  
  // If it's a storage path, convert to full URL
  // Format: bucket-name/path/to/file.jpg
  const [bucket, ...pathParts] = logoUrl.split('/');
  const path = pathParts.join('/');
  
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}
```

Or using Supabase client:

```typescript
const { data: { publicUrl } } = supabase.storage
  .from('server-logos')
  .getPublicUrl('brave.png');
```

## Example: Complete Logo Setup

```sql
-- 1. Add logo_url columns (run ADD_LOGO_SUPPORT.sql first)

-- 2. Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('server-logos', 'server-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Set storage policies (run policies from Step 2 above)

-- 4. After uploading logos via Dashboard or API, update database:
UPDATE system_servers 
SET logo_url = 'server-logos/brave.png'
WHERE id = 'brave';

UPDATE system_servers 
SET logo_url = 'server-logos/github.png'
WHERE id = 'github';

-- Or use external URLs:
UPDATE system_servers 
SET logo_url = 'https://example.com/logo.png'
WHERE id = 'maps';
```

## Storage Path Format

- **Bucket name**: `server-logos`
- **File path**: `brave.png`, `github.svg`, `custom/team-logo.png`
- **Full format**: `server-logos/brave.png`
- **Full URL**: `https://<project-ref>.supabase.co/storage/v1/object/public/server-logos/brave.png`

## Notes

- Public buckets allow anyone to access images (good for logos)
- Private buckets require authentication
- File size limits: Check your Supabase plan limits
- Supported formats: PNG, JPG, SVG, GIF, WebP
- Recommended size: 64x64 to 256x256 pixels for logos
