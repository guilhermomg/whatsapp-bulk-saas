-- AlterTable
ALTER TABLE "webhook_events" ADD COLUMN "external_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_external_id_key" ON "webhook_events"("external_id");
