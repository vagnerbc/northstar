import { Button, Heading, NumberInput, Text } from '@chakra-ui/react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { api } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { EmptyState, ErrorState, LoadingState } from '../components/async-state';
import { formatMoney } from '../utils/format';

export function CartPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const cart = useQuery({
    queryKey: ['cart'],
    queryFn: () => api.cart(auth.getToken),
    enabled: auth.authenticated,
  });
  const products = useQueries({
    queries: (cart.data?.items ?? []).map((item) => ({
      queryKey: ['product', item.productId],
      queryFn: () => api.product(item.productId, auth.getToken),
    })),
  });
  const update = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity?: number }) =>
      quantity
        ? api.setCartItem(productId, quantity, auth.getToken)
        : api.removeCartItem(productId, auth.getToken),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });
  if (!auth.authenticated) return <LoginRequired />;
  if (cart.isPending) return <LoadingState label="Loading your cart" />;
  if (cart.isError) return <ErrorState error={cart.error} retry={() => void cart.refetch()} />;
  if (cart.data.items.length === 0)
    return (
      <EmptyState>
        <ShoppingBag size={42} />
        <Heading>Your cart is empty</Heading>
        <Text>Explore the collection and add something useful.</Text>
        <Button asChild>
          <Link to="/">Continue shopping</Link>
        </Button>
      </EmptyState>
    );

  const productMap = new Map(
    products.flatMap((result) => (result.data ? [[result.data.id, result.data] as const] : [])),
  );
  const total = cart.data.items.reduce(
    (sum, item) => sum + (productMap.get(item.productId)?.priceAmount ?? 0) * item.quantity,
    0,
  );
  return (
    <div className="page-shell narrow-page">
      <Text className="eyebrow">YOUR SELECTION</Text>
      <Heading as="h1" size="3xl">
        Shopping cart
      </Heading>
      {update.isError && <ErrorState error={update.error} />}
      <div className="cart-layout">
        <section className="cart-items" aria-label="Cart items">
          {cart.data.items.map((item) => {
            const product = productMap.get(item.productId);
            return (
              <article className="cart-item" key={item.productId}>
                <img src={product?.imageUrl} alt="" />
                <div>
                  <Heading size="md">{product?.name ?? 'Loading product…'}</Heading>
                  <Text>{product ? formatMoney(product.priceAmount) : '—'}</Text>
                </div>
                <NumberInput.Root
                  min={1}
                  max={99}
                  value={String(item.quantity)}
                  width="90px"
                  onValueChange={({ valueAsNumber }) => {
                    if (Number.isInteger(valueAsNumber))
                      update.mutate({ productId: item.productId, quantity: valueAsNumber });
                  }}
                >
                  <NumberInput.Control />
                  <NumberInput.Input
                    aria-label={`Quantity for ${product?.name ?? item.productId}`}
                  />
                </NumberInput.Root>
                <Button
                  aria-label={`Remove ${product?.name ?? 'item'}`}
                  variant="ghost"
                  onClick={() => update.mutate({ productId: item.productId })}
                >
                  <Trash2 size={18} />
                </Button>
              </article>
            );
          })}
        </section>
        <aside className="summary-card">
          <Heading size="lg">Summary</Heading>
          <div>
            <span>Subtotal</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <Text fontSize="sm" color="fg.muted">
            Shipping and taxes are intentionally excluded from this study scope.
          </Text>
          <Button size="lg" asChild>
            <Link to="/checkout">Continue to checkout</Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}

function LoginRequired() {
  const auth = useAuth();
  return (
    <EmptyState>
      <Heading>Sign in to see your cart</Heading>
      <Text>Your cart is stored securely against your Keycloak identity.</Text>
      <Button onClick={() => void auth.login()}>Login</Button>
    </EmptyState>
  );
}
