import { createServiceTokenProvider } from '@ecommerce/auth';
import { ApplicationFailure } from '@temporalio/common';
import type { OrderRepository } from '../application/ports.js';
import type { InventoryReservationResult } from '../domain/order.js';
import { config } from '../infrastructure/config.js';
import type { CheckoutActivities } from './types.js';

const tokenProvider = createServiceTokenProvider({
  tokenEndpoint:
    config.KEYCLOAK_TOKEN_URL ?? `${config.KEYCLOAK_ISSUER}/protocol/openid-connect/token`,
  clientId: config.SERVICE_CLIENT_ID,
  clientSecret: config.SERVICE_CLIENT_SECRET,
  scope: config.SERVICE_CLIENT_SCOPE,
});

export function createActivities(repository: OrderRepository): CheckoutActivities {
  const internalFetch = async (url: string, init: RequestInit, correlationId: string) => {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    headers.set('x-correlation-id', correlationId);
    if (!config.AUTH_DISABLED) headers.set('authorization', `Bearer ${await tokenProvider()}`);
    const response = await fetch(url, { ...init, headers });
    if (!response.ok) {
      const body = await response.text();
      const nonRetryable =
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429;
      if (nonRetryable)
        throw ApplicationFailure.nonRetryable(
          body || `HTTP ${response.status}`,
          `HTTP_${response.status}`,
        );
      throw new Error(body || `HTTP ${response.status}`);
    }
    return response;
  };

  return {
    async loadOrder(orderId) {
      const order = await repository.findById(orderId);
      if (!order) throw ApplicationFailure.nonRetryable('Order not found', 'ORDER_NOT_FOUND');
      return order;
    },
    async reserveInventory(order, correlationId) {
      const response = await internalFetch(
        `${config.INVENTORY_BASE_URL}/internal/v1/inventory/reservations/${order.id}`,
        {
          method: 'POST',
          body: JSON.stringify({
            items: order.items.map(({ productId, quantity }) => ({ productId, quantity })),
          }),
        },
        correlationId,
      );
      return response.json() as Promise<InventoryReservationResult>;
    },
    async applyReservation(orderId, reservation) {
      return repository.applyReservation(
        orderId,
        reservation.id,
        reservation.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          name: item.name,
          unitPriceAmount: item.unitPriceAmount,
        })),
      );
    },
    async createPayment(order, correlationId) {
      const response = await internalFetch(
        `${config.PAYMENT_BASE_URL}/internal/v1/payments`,
        {
          method: 'POST',
          headers: { 'idempotency-key': `${order.id}:create` },
          body: JSON.stringify({
            orderId: order.id,
            userId: order.userId,
            amount: order.totalAmount,
            currency: 'BRL',
          }),
        },
        correlationId,
      );
      const payment = (await response.json()) as { id: string };
      await repository.attachPayment(order.id, payment.id);
      return { paymentId: payment.id };
    },
    async markStatus(orderId, status) {
      await repository.setStatus(orderId, status);
    },
    async capturePayment(orderId, paymentId, correlationId) {
      await internalFetch(
        `${config.PAYMENT_BASE_URL}/internal/v1/payments/${paymentId}/capture`,
        { method: 'POST', headers: { 'idempotency-key': `${orderId}:capture` } },
        correlationId,
      );
    },
    async cancelPayment(orderId, paymentId, correlationId) {
      await internalFetch(
        `${config.PAYMENT_BASE_URL}/internal/v1/payments/${paymentId}/cancel`,
        { method: 'POST', headers: { 'idempotency-key': `${orderId}:cancel` } },
        correlationId,
      );
    },
    async refundPayment(orderId, paymentId, correlationId) {
      await internalFetch(
        `${config.PAYMENT_BASE_URL}/internal/v1/payments/${paymentId}/refund`,
        { method: 'POST', headers: { 'idempotency-key': `${orderId}:refund` } },
        correlationId,
      );
    },
    async commitInventory(orderId, correlationId) {
      await internalFetch(
        `${config.INVENTORY_BASE_URL}/internal/v1/inventory/reservations/${orderId}/commit`,
        { method: 'POST' },
        correlationId,
      );
    },
    async releaseInventory(orderId, correlationId) {
      await internalFetch(
        `${config.INVENTORY_BASE_URL}/internal/v1/inventory/reservations/${orderId}/release`,
        { method: 'POST' },
        correlationId,
      );
    },
    async confirmOrder(orderId, correlationId) {
      await repository.confirm(orderId, correlationId);
    },
    async failOrder(orderId, reason, manualReview, correlationId) {
      await repository.fail(orderId, reason, manualReview, correlationId);
    },
  };
}
