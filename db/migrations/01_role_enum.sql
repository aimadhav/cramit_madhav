-- Run this in your Supabase SQL Editor to enforce the role enum on your public users table

-- 1. Create the ENUM type (only allows these two specific strings)
CREATE TYPE user_role AS ENUM ('student', 'teacher');

-- 2. Alter the users table to cast the existing text column to the new ENUM
-- Note: If you have existing users with weird roles (like "Admin"), this will fail. 
-- Make sure all current users are either 'student' or 'teacher' before running this!
ALTER TABLE users 
  ALTER COLUMN role TYPE user_role 
  USING role::user_role;

-- 3. Set the default value to 'student'
ALTER TABLE users 
  ALTER COLUMN role SET DEFAULT 'student'::user_role;
