-- Add authentication fields to users table
-- This migration handles existing users by providing default values

-- Add nullable fields first
ALTER TABLE "users" ADD COLUMN "password" TEXT;
ALTER TABLE "users" ADD COLUMN "email_verified" BOOLEAN DEFAULT false;
ALTER TABLE "users" ADD COLUMN "email_verification_token" TEXT;
ALTER TABLE "users" ADD COLUMN "password_reset_token" TEXT;
ALTER TABLE "users" ADD COLUMN "password_reset_expires" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "login_attempts" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "users" ADD COLUMN "lock_until" TIMESTAMP(3);

-- Set a temporary password for existing users (they'll need to reset it)
-- This is a bcrypt hash of "TemporaryPassword123!" (just a placeholder)
UPDATE "users" SET "password" = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWO' WHERE "password" IS NULL;

-- Make password required
ALTER TABLE "users" ALTER COLUMN "password" SET NOT NULL;

-- Add unique constraints
CREATE UNIQUE INDEX "users_email_verification_token_key" ON "users"("email_verification_token");
CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");
