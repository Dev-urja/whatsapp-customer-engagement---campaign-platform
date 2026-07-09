-- Allow users.role to reference any role name (including custom roles)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
