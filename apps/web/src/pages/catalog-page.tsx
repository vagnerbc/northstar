import { Button, Heading, Text } from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { ErrorState, LoadingState } from '../components/async-state';
import { ProductCard } from '../components/product-card';

export function CatalogPage() {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: () => api.products(auth.getToken) });
  const add = useMutation({
    mutationFn: (productId: string) => api.addCartItem(productId, 1, auth.getToken),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });
  if (products.isPending) return <LoadingState label="Loading products" />;
  if (products.isError)
    return <ErrorState error={products.error} retry={() => void products.refetch()} />;
  return (
    <div className="page-shell">
      <section className="hero">
        <Text className="eyebrow">PURPOSEFUL EVERYDAY GOODS</Text>
        <Heading as="h1" size="5xl">
          Less noise.
          <br />
          Better objects.
        </Heading>
        <Text fontSize="lg">
          A small, considered collection—and a serious distributed system behind it.
        </Text>
      </section>
      {add.isError && <ErrorState error={add.error} />}
      <section aria-labelledby="catalog-title">
        <div className="section-heading">
          <div>
            <Text className="eyebrow">THE COLLECTION</Text>
            <Heading id="catalog-title">Made to be used</Heading>
          </div>
          <Button variant="outline">{products.data.items.length} products</Button>
        </div>
        <div className="product-grid">
          {products.data.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              busy={add.isPending && add.variables === product.id}
              onAdd={() => (auth.authenticated ? add.mutate(product.id) : void auth.login())}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
