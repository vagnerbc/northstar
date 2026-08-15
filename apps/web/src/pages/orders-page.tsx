import { Button, Heading, Text } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { api } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { EmptyState, ErrorState, LoadingState } from '../components/async-state';
import { OrderStatusBadge } from '../components/order-status';
import { formatDate, formatMoney } from '../utils/format';

export function OrdersPage() {
  const auth = useAuth();
  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.orders(auth.getToken),
    enabled: auth.authenticated,
  });
  if (orders.isPending) return <LoadingState label="Loading orders" />;
  if (orders.isError)
    return <ErrorState error={orders.error} retry={() => void orders.refetch()} />;
  if (!orders.data.items.length)
    return (
      <EmptyState>
        <Heading>No orders yet</Heading>
        <Text>Your completed and active checkouts will appear here.</Text>
        <Button asChild>
          <Link to="/">Start shopping</Link>
        </Button>
      </EmptyState>
    );
  return (
    <div className="page-shell narrow-page">
      <Text className="eyebrow">ACCOUNT</Text>
      <Heading as="h1" size="3xl">
        Your orders
      </Heading>
      <div className="order-list">
        {orders.data.items.map((order) => (
          <Link to={`/orders/${order.id}`} className="order-row" key={order.id}>
            <div>
              <strong>{order.displayId}</strong>
              <Text fontSize="sm" color="fg.muted">
                {formatDate(order.createdAt)}
              </Text>
            </div>
            <OrderStatusBadge status={order.status} />
            <strong>{formatMoney(order.totalAmount)}</strong>
          </Link>
        ))}
      </div>
    </div>
  );
}
