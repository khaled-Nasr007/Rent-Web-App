-- 1. Add manager_name column to the buildings table if it doesn't exist
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS manager_name TEXT;

-- 2. Trigger function to update the unit_count in the buildings table automatically when units are changed
CREATE OR REPLACE FUNCTION public.update_building_unit_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.buildings
        SET unit_count = COALESCE(unit_count, 0) + 1
        WHERE id = NEW.building_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.buildings
        SET unit_count = GREATEST(0, COALESCE(unit_count, 0) - 1)
        WHERE id = OLD.building_id;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF (OLD.building_id IS DISTINCT FROM NEW.building_id) THEN
            IF (OLD.building_id IS NOT NULL) THEN
                UPDATE public.buildings
                SET unit_count = GREATEST(0, COALESCE(unit_count, 0) - 1)
                WHERE id = OLD.building_id;
            END IF;
            IF (NEW.building_id IS NOT NULL) THEN
                UPDATE public.buildings
                SET unit_count = COALESCE(unit_count, 0) + 1
                WHERE id = NEW.building_id;
            END IF;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_building_unit_count ON public.units;

-- Create trigger on units table
CREATE TRIGGER trigger_update_building_unit_count
AFTER INSERT OR DELETE OR UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.update_building_unit_count();

-- One-time update to sync all existing unit counts in the database
UPDATE public.buildings b
SET unit_count = (
    SELECT COUNT(*)
    FROM public.units u
    WHERE u.building_id = b.id
);

-- 3. Create vouchers_expense table to store expense logs
CREATE TABLE IF NOT EXISTS public.vouchers_expense (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    voucher_number text NOT NULL UNIQUE,
    unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
    building_id uuid REFERENCES public.buildings(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    category text NOT NULL, -- 'Maintenance' / 'Utilities' / 'General' / custom text
    amount numeric(12,2) NOT NULL,
    payment_method text NOT NULL, -- 'Cash' / 'Bank Transfer'
    description text,
    approved_by text,              -- Manager name/title who approved this expense
    approval_status text DEFAULT 'pending', -- 'pending' / 'approved' / 'rejected'
    approval_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Migration: add columns to existing vouchers_expense table (safe, idempotent)
ALTER TABLE public.vouchers_expense ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE public.vouchers_expense ADD COLUMN IF NOT EXISTS approval_status text DEFAULT 'pending';
ALTER TABLE public.vouchers_expense ADD COLUMN IF NOT EXISTS approval_date timestamp with time zone;

-- Enable RLS
ALTER TABLE public.vouchers_expense ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to prevent collision
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.vouchers_expense;
DROP POLICY IF EXISTS "Allow insert access for authenticated users" ON public.vouchers_expense;
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.vouchers_expense;

-- Create policies (allowing authenticated users access)
CREATE POLICY "Allow read access for authenticated users" ON public.vouchers_expense
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert access for authenticated users" ON public.vouchers_expense
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow all access for authenticated users" ON public.vouchers_expense
    FOR ALL TO authenticated USING (true);

