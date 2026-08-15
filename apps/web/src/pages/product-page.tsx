import { Button, Heading, Text } from '@chakra-ui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { api } from '../api/client';
import { useAuth } from '../auth/auth-context';
import { ErrorState, LoadingState } from '../components/async-state';
import { formatMoney } from '../utils/format';

export function ProductPage() {
  const { productId = '' } = useParams();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const product = useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.product(productId, auth.getToken),
    enabled: Boolean(productId),
  });
  const add = useMutation({
    mutationFn: () => api.addCartItem(productId, 1, auth.getToken),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['cart'] }),
  });
  if (product.isPending) return <LoadingState label="Loading product" />;
  if (product.isError)
    return <ErrorState error={product.error} retry={() => void product.refetch()} />;
  return (
    <div className="page-shell product-detail">
      <Link to="/" className="back-link">
        <ArrowLeft size={17} /> Back to shop
      </Link>
      <div className="product-detail-grid">
        <div className="product-detail-image">
          <img src={product.data.imageUrl} alt="" />
        </div>
        <section>
          <Text className="eyebrow">{product.data.sku}</Text>
          <Heading as="h1" size="3xl">
            {product.data.name}
          </Heading>
          <Text fontSize="2xl" fontWeight="bold">
            {formatMoney(product.data.priceAmount)}
          </Text>
          <Text fontSize="lg" color="fg.muted">
            {product.data.description}
          </Text>
          <div className="stock-note">
            <PackageCheck />
            <span>{product.data.availableQuantity} ready to reserve</span>
          </div>
          {add.isSuccess && <Text color="green.600">Added to your cart.</Text>}
          {add.isError && <ErrorState error={add.error} />}
          <Button
            size="lg"
            width="full"
            loading={add.isPending}
            disabled={product.data.availableQuantity === 0}
            onClick={() => (auth.authenticated ? add.mutate() : void auth.login())}
          >
            Add to cart
          </Button>
        </section>
      </div>
    </div>
  );
}
