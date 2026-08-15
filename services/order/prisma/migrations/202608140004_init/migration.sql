CREATE TYPE "OrderStatus" AS ENUM ('CHECKOUT_REQUESTED', 'INVENTORY_RESERVED', 'AWAITING_PAYMENT', 'PAYMENT_AUTHORIZED', 'PAYMENT_CAPTURED', 'CONFIRMED', 'COMPENSATING', 'FAILED', 'MANUAL_REVIEW');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "Order" (
  "id" UUID NOT NULL,
  "displayId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'CHECKOUT_REQUESTED',
  "cartId" UUID NOT NULL,
  "cartVersion" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "shippingAddress" JSONB NOT NULL,
  "reservationId" UUID,
  "paymentId" UUID,
  "totalAmount" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_total_check" CHECK ("totalAmount" >= 0),
  CONSTRAINT "Order_currency_check" CHECK ("currency" = 'BRL')
);
CREATE UNIQUE INDEX "Order_displayId_key" ON "Order"("displayId");
CREATE UNIQUE INDEX "Order_userId_idempotencyKey_key" ON "Order"("userId", "idempotencyKey");
CREATE INDEX "Order_userId_id_idx" ON "Order"("userId", "id");

CREATE TABLE "OrderItem" (
  "orderId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "name" TEXT,
  "unitPriceAmount" INTEGER,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("orderId", "productId"),
  CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" > 0)
);

CREATE TABLE "InboxEvent" (
  "eventId" UUID NOT NULL,
  "eventType" TEXT NOT NULL,
  "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InboxEvent_pkey" PRIMARY KEY ("eventId")
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
