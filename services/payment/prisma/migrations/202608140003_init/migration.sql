CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'REQUIRES_ACTION', 'AUTHORIZED', 'CAPTURED', 'CANCELED', 'FAILED', 'REFUNDED', 'REFUND_FAILED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "Payment" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerPaymentId" TEXT NOT NULL,
  "clientSecret" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "Payment_currency_check" CHECK ("currency" = 'BRL')
);
CREATE UNIQUE INDEX "Payment_orderId_key" ON "Payment"("orderId");
CREATE UNIQUE INDEX "Payment_providerPaymentId_key" ON "Payment"("providerPaymentId");

CREATE TABLE "WebhookReceipt" (
  "providerEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookReceipt_pkey" PRIMARY KEY ("providerEventId")
);

CREATE TABLE "OutboxEvent" (
  "id" UUID NOT NULL,
  "topic" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "aggregateId" UUID NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutboxEvent_status_availableAt_idx" ON "OutboxEvent"("status", "availableAt");
