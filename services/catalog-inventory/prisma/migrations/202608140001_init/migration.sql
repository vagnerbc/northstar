CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'COMMITTED', 'RELEASED', 'EXPIRED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

CREATE TABLE "Product" (
  "id" UUID NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "priceAmount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

CREATE TABLE "InventoryItem" (
  "productId" UUID NOT NULL,
  "onHand" INTEGER NOT NULL,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("productId"),
  CONSTRAINT "InventoryItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "InventoryItem_nonnegative_check" CHECK ("onHand" >= 0 AND "reserved" >= 0 AND "reserved" <= "onHand")
);

CREATE TABLE "InventoryReservation" (
  "id" UUID NOT NULL,
  "orderId" UUID NOT NULL,
  "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InventoryReservation_orderId_key" ON "InventoryReservation"("orderId");

CREATE TABLE "ReservationItem" (
  "reservationId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("reservationId", "productId"),
  CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReservationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReservationItem_quantity_check" CHECK ("quantity" > 0)
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
