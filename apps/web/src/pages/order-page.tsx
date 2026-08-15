import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button, Heading, Text } from '@chakra-ui/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CircleCheckBig, Clock3 } from 'lucide-react';
import { useParams } from 'react-router';
import { api } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { ErrorState, LoadingState } from '../components/async-state';
import { OrderStatusBadge, terminalStatuses } from '../components/order-status';
import type { PaymentSession } from '../types';
import { formatDate, formatMoney } from '../utils/format';

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

export function OrderPage() {
  const { orderId = '' } = useParams();
  const auth = useAuth();
  const order = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.order(orderId, auth.getToken),
    enabled: Boolean(orderId),
    refetchInterval: (query) =>
      query.state.data && terminalStatuses.includes(query.state.data.status) ? false : 2_000,
  });
  if (order.isPending) return <LoadingState label="Following your checkout" />;
  if (order.isError) return <ErrorState error={order.error} retry={() => void order.refetch()} />;
  const value = order.data;
  return (
    <div className="page-shell narrow-page">
      <div className="order-title">
        <div>
          <Text className="eyebrow">ORDER {value.displayId}</Text>
          <Heading as="h1" size="3xl">
            Checkout progress
          </Heading>
        </div>
        <OrderStatusBadge status={value.status} />
      </div>
      {!terminalStatuses.includes(value.status) && (
        <div className="progress-callout">
          <Clock3 />
          <div>
            <strong>Your checkout is running safely in the background.</strong>
            <p>
              This page refreshes every two seconds. You can leave and return from order history.
            </p>
          </div>
        </div>
      )}
      {value.status === 'CONFIRMED' && (
        <div className="success-callout">
          <CircleCheckBig />
          <div>
            <strong>Order confirmed</strong>
            <p>Inventory and payment are committed. A confirmation email has been queued.</p>
          </div>
        </div>
      )}
      {(value.status === 'FAILED' || value.status === 'MANUAL_REVIEW') && (
        <ErrorState error={new Error(value.failureReason ?? 'Checkout could not be completed.')} />
      )}
      {value.status === 'AWAITING_PAYMENT' && value.paymentId && (
        <PaymentPanel paymentId={value.paymentId} />
      )}
      <section className="detail-card">
        <Heading size="lg">Items</Heading>
        {value.items.map((item) => (
          <div className="detail-line" key={item.productId}>
            <span>
              {item.quantity} × {item.name ?? item.productId}
            </span>
            <strong>{formatMoney((item.unitPriceAmount ?? 0) * item.quantity)}</strong>
          </div>
        ))}
        <div className="detail-line total">
          <span>Total</span>
          <strong>{formatMoney(value.totalAmount)}</strong>
        </div>
      </section>
      <section className="detail-card">
        <Heading size="lg">Delivery</Heading>
        <address>
          {value.shippingAddress.recipientName}
          <br />
          {value.shippingAddress.line1}
          <br />
          {value.shippingAddress.line2 && (
            <>
              {value.shippingAddress.line2}
              <br />
            </>
          )}
          {value.shippingAddress.city}, {value.shippingAddress.state}{' '}
          {value.shippingAddress.postalCode}
          <br />
          Brazil
        </address>
        <Text fontSize="sm" color="fg.muted">
          Started {formatDate(value.createdAt)}
        </Text>
      </section>
    </div>
  );
}

function PaymentPanel({ paymentId }: { paymentId: string }) {
  const auth = useAuth();
  const session = useQuery({
    queryKey: ['payment-session', paymentId],
    queryFn: () => api.paymentSession(paymentId, auth.getToken),
  });
  if (session.isPending) return <LoadingState label="Preparing secure payment" />;
  if (session.isError)
    return <ErrorState error={session.error} retry={() => void session.refetch()} />;
  if (session.data.provider === 'fake') return <FakePayment session={session.data} />;
  if (!stripePromise)
    return <ErrorState error={new Error('Stripe publishable key is not configured.')} />;
  return (
    <section className="payment-card">
      <Heading size="lg">Secure card payment</Heading>
      <Elements
        stripe={stripePromise}
        options={{ clientSecret: session.data.clientSecret, appearance: { theme: 'stripe' } }}
      >
        <StripeForm />
      </Elements>
    </section>
  );
}

function FakePayment({ session }: { session: PaymentSession }) {
  const auth = useAuth();
  const authorize = useMutation({
    mutationFn: () => api.fakeAuthorize(session.paymentId, auth.getToken),
  });
  return (
    <section className="payment-card">
      <Heading size="lg">Automated-test payment</Heading>
      <Text>This deterministic adapter exists only in the isolated E2E environment.</Text>
      {authorize.isError && <ErrorState error={authorize.error} />}
      <Button loading={authorize.isPending} onClick={() => authorize.mutate()}>
        Authorize test payment
      </Button>
    </section>
  );
}

function StripeForm() {
  const stripe = useStripe();
  const elements = useElements();
  const confirm = useMutation({
    mutationFn: async () => {
      if (!stripe || !elements) throw new Error('Stripe is still loading.');
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (result.error) throw new Error(result.error.message ?? 'Payment authorization failed.');
    },
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        confirm.mutate();
      }}
    >
      <PaymentElement />
      {confirm.isError && <ErrorState error={confirm.error} />}
      <Button
        type="submit"
        width="full"
        marginTop="5"
        loading={confirm.isPending}
        disabled={!stripe}
      >
        Authorize payment
      </Button>
    </form>
  );
}
