-- Migration script to add slug column and populate it for existing posts
-- This script should be run manually on the database

-- Step 1: Add slug column if it doesn't exist
ALTER TABLE communications ADD COLUMN IF NOT EXISTS slug TEXT;

-- Step 2: Create a function to generate slug from Vietnamese text
CREATE OR REPLACE FUNCTION generate_slug(text_input TEXT) 
RETURNS TEXT AS $$
DECLARE
    slug TEXT;
BEGIN
    slug := LOWER(text_input);
    
    -- Replace Vietnamese characters
    slug := TRANSLATE(slug,
        'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
        'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd'
    );
    
    -- Remove special characters and replace spaces with hyphens
    slug := REGEXP_REPLACE(slug, '[^a-z0-9\s-]', '', 'g');
    slug := REGEXP_REPLACE(slug, '\s+', '-', 'g');
    slug := REGEXP_REPLACE(slug, '-+', '-', 'g');
    slug := TRIM(BOTH '-' FROM slug);
    
    RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Update existing posts with slugs
DO $$
DECLARE
    post_record RECORD;
    new_slug TEXT;
    counter INTEGER;
BEGIN
    FOR post_record IN SELECT id, title FROM communications WHERE slug IS NULL ORDER BY id
    LOOP
        new_slug := generate_slug(post_record.title);
        counter := 1;
        
        -- Check if slug exists and make it unique
        WHILE EXISTS (SELECT 1 FROM communications WHERE slug = new_slug AND id != post_record.id) LOOP
            new_slug := generate_slug(post_record.title) || '-' || counter;
            counter := counter + 1;
        END LOOP;
        
        UPDATE communications SET slug = new_slug WHERE id = post_record.id;
    END LOOP;
END $$;

-- Step 4: Make slug column NOT NULL and UNIQUE after populating
ALTER TABLE communications ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_communications_slug ON communications(slug);

-- Step 5: Verify the migration
SELECT id, title, slug FROM communications ORDER BY id LIMIT 10;
