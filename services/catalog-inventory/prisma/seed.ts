import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const products = [
  [
    '0198a3c0-0000-7000-8000-000000000001',
    'KEYBOARD-001',
    'Mechanical Keyboard',
    'Compact hot-swappable mechanical keyboard.',
    '/products/keyboard.svg',
    54990,
    25,
  ],
  [
    '0198a3c0-0000-7000-8000-000000000002',
    'MOUSE-001',
    'Wireless Mouse',
    'Ergonomic wireless mouse with USB-C charging.',
    '/products/mouse.svg',
    24990,
    40,
  ],
  [
    '0198a3c0-0000-7000-8000-000000000003',
    'HEADSET-001',
    'Studio Headset',
    'Closed-back headset for work and entertainment.',
    '/products/headset.svg',
    39990,
    18,
  ],
  [
    '0198a3c0-0000-7000-8000-000000000004',
    'MONITOR-001',
    '27-inch Monitor',
    'QHD IPS monitor with an adjustable stand.',
    '/products/monitor.svg',
    189990,
    12,
  ],
  [
    '0198a3c0-0000-7000-8000-000000000005',
    'HUB-001',
    'USB-C Hub',
    'Seven-port USB-C hub with HDMI and Ethernet.',
    '/products/hub.svg',
    32990,
    30,
  ],
  [
    '0198a3c0-0000-7000-8000-000000000006',
    'CAMERA-001',
    'Web Camera',
    '1080p camera with privacy shutter.',
    '/products/camera.svg',
    28990,
    22,
  ],
] as const;

for (const [id, sku, name, description, imageUrl, priceAmount, onHand] of products) {
  await prisma.product.upsert({
    where: { sku },
    update: { name, description, imageUrl, priceAmount, active: true },
    create: {
      id,
      sku,
      name,
      description,
      imageUrl,
      priceAmount,
      inventory: { create: { onHand } },
    },
  });
}

await prisma.$disconnect();
