CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TABLE "Notification" (
  "id" UUID NOT NULL,
  "eventId" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "textBody" TEXT NOT NULL,
  "htmlBody" TEXT NOT NULL,
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Notification_eventId_key" ON "Notification"("eventId");

