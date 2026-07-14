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
    unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
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

-- Create single policy (allowing authenticated users full access)
CREATE POLICY "Allow all access for authenticated users" ON public.vouchers_expense
    FOR ALL TO authenticated USING (true);


-- 4. Create expired_contracts_archive table to store historical lease records
CREATE TABLE IF NOT EXISTS public.expired_contracts_archive (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id text REFERENCES public.units(id) ON DELETE CASCADE,
    building_id text REFERENCES public.buildings(id) ON DELETE CASCADE,
    tenant_name text NOT NULL,
    id_number text NOT NULL,
    phone_number text,
    contract_number text NOT NULL,
    monthly_rent numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) NOT NULL,
    payment_method text NOT NULL,
    period_start date NOT NULL,
    period_end date NOT NULL,
    archived_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.expired_contracts_archive ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Allow all access for authenticated users on expired_contracts_archive" ON public.expired_contracts_archive;

-- Create Policies
CREATE POLICY "Allow all access for authenticated users on expired_contracts_archive" 
ON public.expired_contracts_archive
FOR ALL TO authenticated USING (true);

-- Migration: add columns for financial settlement tracking to expired_contracts_archive (safe, idempotent)
ALTER TABLE public.expired_contracts_archive ADD COLUMN IF NOT EXISTS settlement_status text;
ALTER TABLE public.expired_contracts_archive ADD COLUMN IF NOT EXISTS final_carried_debt_amount numeric(12,2) DEFAULT 0;

-- Migration: Create system_logs table and RLS policies (safe, idempotent)
CREATE TABLE IF NOT EXISTS public.system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT NOT NULL,
    action_type TEXT NOT NULL, -- INSERT, UPDATE, DELETE, LOGIN, RENEWAL
    target_module TEXT NOT NULL, -- REAL_ESTATE, UNITS, RECEIPTS, EXPENSES, CONTRACTS, AUTH
    record_id TEXT,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to insert logs
CREATE OR REPLACE FUNCTION public.check_is_auth() RETURNS boolean AS $$
BEGIN
  RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Allow authenticated users to insert logs" ON public.system_logs;
CREATE POLICY "Allow authenticated users to insert logs"
ON public.system_logs FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow super admin to view logs" ON public.system_logs;
CREATE POLICY "Allow super admin to view logs"
ON public.system_logs FOR SELECT
TO authenticated
USING (auth.jwt()->>'email' = 'khalednasr007@gmail.com');

-- Migration: Add assigned_buildings column to profiles for building-level RBAC (safe, idempotent)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_buildings TEXT[] DEFAULT '{}';

-- Helper function to check if user has access to a building
CREATE OR REPLACE FUNCTION public.check_user_building_access(user_id uuid, target_building_id text)
RETURNS boolean AS $$
DECLARE
    user_role text;
    user_buildings text[];
BEGIN
    -- Get user role and assigned buildings
    SELECT role, assigned_buildings INTO user_role, user_buildings
    FROM public.profiles
    WHERE id = user_id;

    -- Admins have access to all buildings
    IF user_role = 'admin' THEN
        RETURN true;
    END IF;

    -- Check if target_building_id is in the assigned_buildings array
    RETURN target_building_id = ANY(user_buildings);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on buildings, units, receipts, vouchers_expense, expired_contracts_archive
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers_expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expired_contracts_archive ENABLE ROW LEVEL SECURITY;

-- 1. Policies for buildings
DROP POLICY IF EXISTS "Access assigned buildings only" ON public.buildings;
CREATE POLICY "Access assigned buildings only" ON public.buildings
    FOR ALL TO authenticated
    USING (public.check_user_building_access(auth.uid(), id))
    WITH CHECK (public.check_user_building_access(auth.uid(), id));

-- 2. Policies for units
DROP POLICY IF EXISTS "Access units of assigned buildings only" ON public.units;
CREATE POLICY "Access units of assigned buildings only" ON public.units
    FOR ALL TO authenticated
    USING (public.check_user_building_access(auth.uid(), building_id))
    WITH CHECK (public.check_user_building_access(auth.uid(), building_id));

-- 3. Policies for receipts
DROP POLICY IF EXISTS "Access receipts of assigned buildings only" ON public.receipts;
CREATE POLICY "Access receipts of assigned buildings only" ON public.receipts
    FOR ALL TO authenticated
    USING (public.check_user_building_access(auth.uid(), building_id))
    WITH CHECK (public.check_user_building_access(auth.uid(), building_id));

-- 4. Policies for vouchers_expense
DROP POLICY IF EXISTS "Allow all access for authenticated users" ON public.vouchers_expense;
DROP POLICY IF EXISTS "Access expenses of assigned buildings only" ON public.vouchers_expense;
CREATE POLICY "Access expenses of assigned buildings only" ON public.vouchers_expense
    FOR ALL TO authenticated
    USING (public.check_user_building_access(auth.uid(), building_id))
    WITH CHECK (public.check_user_building_access(auth.uid(), building_id));

-- 5. Policies for expired_contracts_archive
DROP POLICY IF EXISTS "Allow all access for authenticated users on expired_contracts_archive" ON public.expired_contracts_archive;
DROP POLICY IF EXISTS "Access archive of assigned buildings only" ON public.expired_contracts_archive;
CREATE POLICY "Access archive of assigned buildings only" ON public.expired_contracts_archive
    FOR ALL TO authenticated
    USING (public.check_user_building_access(auth.uid(), building_id))
    WITH CHECK (public.check_user_building_access(auth.uid(), building_id));

-- 6. Policies for profiles table (User RBAC and self-management)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
    RETURN user_role = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP POLICY IF EXISTS "Allow users to read their own profile or admin to read all" ON public.profiles;
CREATE POLICY "Allow users to read their own profile or admin to read all" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Allow users to update their own profile or admin to update all" ON public.profiles;
CREATE POLICY "Allow users to update their own profile or admin to update all" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.is_admin(auth.uid()))
    WITH CHECK (auth.uid() = id OR public.is_admin(auth.uid()));

-- 7. RPC function to update another user's email (username) and password securely as SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
    target_user_id uuid,
    new_email text,
    new_password text
)
RETURNS boolean AS $$
DECLARE
    executing_role text;
BEGIN
    -- Check if executing user is super admin
    SELECT role INTO executing_role FROM public.profiles WHERE id = auth.uid();
    IF executing_role <> 'admin' THEN
        RAISE EXCEPTION 'غير مصرح للقيام بهذه العملية';
    END IF;

    -- Update email in auth.users if provided
    IF new_email IS NOT NULL AND new_email <> '' THEN
        UPDATE auth.users
        SET email = new_email,
            email_change_confirm_status = 0
        WHERE id = target_user_id;

        -- Update public.profiles
        UPDATE public.profiles
        SET email = new_email
        WHERE id = target_user_id;
    END IF;

    -- Update password in auth.users if provided
    IF new_password IS NOT NULL AND new_password <> '' THEN
        UPDATE auth.users
        SET encrypted_password = crypt(new_password, gen_salt('bf'))
        WHERE id = target_user_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Alter profiles table to add username and password columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;

-- 9. Trigger function to sync changes from public.profiles to auth.users
CREATE OR REPLACE FUNCTION public.sync_user_credentials()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the secure auth password and email if changed in profiles
  UPDATE auth.users 
  SET email = COALESCE(NEW.email, email),
      encrypted_password = CASE 
          WHEN NEW.password IS NOT NULL AND NEW.password <> '' 
          THEN crypt(NEW.password, gen_salt('bf')) 
          ELSE encrypted_password 
      END
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trigger_sync_user_credentials ON public.profiles;

-- Create trigger on profiles table
CREATE TRIGGER trigger_sync_user_credentials
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_credentials();

-- ============================================================================
-- 10. MIGRATION: Fix Foreign Key Cascade Rules & Clean Orphaned Records
-- ============================================================================
-- Problem: unit_id FK on vouchers_expense was ON DELETE SET NULL, causing
-- orphaned expense vouchers when units are deleted. These orphans show as
-- "عام للمبنى" with null unit_id and corrupt financial metrics (negative balances).
--
-- IMPORTANT: Cleanup MUST run BEFORE constraint changes, otherwise Postgres
-- rejects the new FK because orphaned rows already violate it.
-- ============================================================================

-- Step 1: Clean up existing orphaned expense vouchers (unit was already deleted)
DELETE FROM public.vouchers_expense
WHERE unit_id IS NOT NULL
AND unit_id NOT IN (SELECT id FROM public.units);

-- Step 2: Clean up existing orphaned receipts (unit was already deleted)
DELETE FROM public.receipts
WHERE unit_id IS NOT NULL
AND unit_id NOT IN (SELECT id FROM public.units);

-- Step 3: Also clean vouchers/receipts with NULL unit_id that have no valid building
DELETE FROM public.vouchers_expense
WHERE unit_id IS NULL
AND building_id IS NOT NULL
AND building_id NOT IN (SELECT id FROM public.buildings);

DELETE FROM public.receipts
WHERE unit_id IS NULL
AND building_id IS NOT NULL
AND building_id NOT IN (SELECT id FROM public.buildings);

-- Step 4: Now safe to fix vouchers_expense.unit_id → ON DELETE CASCADE
ALTER TABLE public.vouchers_expense
DROP CONSTRAINT IF EXISTS vouchers_expense_unit_id_fkey,
ADD CONSTRAINT vouchers_expense_unit_id_fkey
FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;

-- Step 5: Fix receipts.unit_id → ON DELETE CASCADE
ALTER TABLE public.receipts
DROP CONSTRAINT IF EXISTS receipts_unit_id_fkey,
ADD CONSTRAINT receipts_unit_id_fkey
FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE CASCADE;
