/*
  Warnings:

  - Made the column `email_verified` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "whatsapp_connected_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_messaging_limit" TEXT,
ADD COLUMN     "whatsapp_quality_rating" TEXT,
ALTER COLUMN "access_token" DROP NOT NULL,
ALTER COLUMN "is_active" SET DEFAULT false,
ALTER COLUMN "email_verified" SET NOT NULL;
