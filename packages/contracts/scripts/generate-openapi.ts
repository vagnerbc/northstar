import { mkdir, writeFile } from 'node:fs/promises';
import { httpSchemas } from '../src/index.js';

const ref = (name: keyof typeof httpSchemas) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object) => ({ content: { 'application/json': { schema } } });
const response = (name: keyof typeof httpSchemas, description = 'Successful response') => ({
  description,
  ...json(ref(name)),
});
const problemResponses = {
  '400': response('Problem', 'Invalid request'),
  '401': response('Problem', 'Authentication required'),
  '403': response('Problem', 'Forbidden'),
};
const bearer = [{ bearerAuth: [] }];

const document = {
  openapi: '3.1.0',
  info: {
    title: 'Northstar E-commerce API',
    version: '1.0.0',
    description: 'Generated public HTTP contract. All monetary amounts are integer BRL centavos.',
  },
  servers: [{ url: 'http://localhost:8000', description: 'Local Kong Gateway' }],
  tags: [{ name: 'Catalog' }, { name: 'Cart' }, { name: 'Orders' }, { name: 'Payments' }],
  paths: {
    '/api/v1/products': {
      get: {
        tags: ['Catalog'],
        operationId: 'listProducts',
        parameters: [
          { name: 'cursor', in: 'query', schema: { type: 'string', format: 'uuid' } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          },
        ],
        responses: { '200': response('ProductPage') },
      },
    },
    '/api/v1/products/{productId}': {
      get: {
        tags: ['Catalog'],
        operationId: 'getProduct',
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': response('Product'), '404': response('Problem', 'Product not found') },
      },
    },
    '/api/v1/cart': {
      get: {
        tags: ['Cart'],
        operationId: 'getCart',
        security: bearer,
        responses: { '200': response('Cart'), ...problemResponses },
      },
    },
    '/api/v1/cart/items': {
      post: {
        tags: ['Cart'],
        operationId: 'addCartItem',
        security: bearer,
        parameters: [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string' } }],
        requestBody: { required: true, ...json(ref('CartItem')) },
        responses: { '201': response('Cart'), ...problemResponses },
      },
    },
    '/api/v1/cart/items/{productId}': {
      patch: {
        tags: ['Cart'],
        operationId: 'updateCartItem',
        security: bearer,
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          ...json({
            type: 'object',
            required: ['quantity'],
            properties: { quantity: { type: 'integer', minimum: 1, maximum: 99 } },
          }),
        },
        responses: { '200': response('Cart'), ...problemResponses },
      },
      delete: {
        tags: ['Cart'],
        operationId: 'removeCartItem',
        security: bearer,
        parameters: [
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': response('Cart'), ...problemResponses },
      },
    },
    '/api/v1/orders/checkout': {
      post: {
        tags: ['Orders'],
        operationId: 'checkout',
        security: bearer,
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', maxLength: 128 },
          },
        ],
        requestBody: { required: true, ...json(ref('CheckoutBody')) },
        responses: {
          '202': response('CheckoutAccepted', 'Checkout accepted for asynchronous processing'),
          ...problemResponses,
        },
      },
    },
    '/api/v1/orders': {
      get: {
        tags: ['Orders'],
        operationId: 'listOrders',
        security: bearer,
        responses: { '200': response('OrderPage'), ...problemResponses },
      },
    },
    '/api/v1/orders/{orderId}': {
      get: {
        tags: ['Orders'],
        operationId: 'getOrder',
        security: bearer,
        parameters: [
          {
            name: 'orderId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': response('Order'),
          '404': response('Problem', 'Order not found'),
          ...problemResponses,
        },
      },
    },
    '/api/v1/payments/{paymentId}/session': {
      get: {
        tags: ['Payments'],
        operationId: 'getPaymentSession',
        security: bearer,
        parameters: [
          {
            name: 'paymentId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '200': response('PaymentSession'),
          '404': response('Problem', 'Payment not found'),
          ...problemResponses,
        },
      },
    },
    '/api/v1/payments/webhooks/stripe': {
      post: {
        tags: ['Payments'],
        operationId: 'stripeWebhook',
        description:
          'Stripe signature is required and verified against the unmodified request body.',
        responses: {
          '200': { description: 'Webhook accepted' },
          '400': response('Problem', 'Invalid signature'),
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: Object.fromEntries(
      Object.entries(httpSchemas).map(([name, schema]) => [name, schema.toJSONSchema()]),
    ),
  },
};

const packageTarget = new URL('../openapi.json', import.meta.url);
const docsDirectory = new URL('../../../docs/api/', import.meta.url);
await mkdir(docsDirectory, { recursive: true });
const serialized = `${JSON.stringify(document, null, 2)}\n`;
await Promise.all([
  writeFile(packageTarget, serialized),
  writeFile(new URL('openapi.json', docsDirectory), serialized),
]);
