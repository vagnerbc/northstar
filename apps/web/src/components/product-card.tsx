import { Badge, Button, Heading, Text } from '@chakra-ui/react';
import { Link } from 'react-router';
import type { Product } from '../types';
import { formatMoney } from '../utils/format';

export function ProductCard({
  product,
  onAdd,
  busy = false,
}: {
  product: Product;
  onAdd?: () => void;
  busy?: boolean;
}) {
  return (
    <article className="product-card">
      <Link to={`/products/${product.id}`} className="product-image-wrap">
        <img src={product.imageUrl} alt="" className="product-image" loading="lazy" />
      </Link>
      <div className="product-card-body">
        <div className="eyebrow-row">
          <Text className="eyebrow">{product.sku}</Text>
          {product.availableQuantity < 5 && <Badge colorPalette="orange">Low stock</Badge>}
        </div>
        <Heading size="md">
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </Heading>
        <Text lineClamp="2" color="fg.muted">
          {product.description}
        </Text>
        <div className="price-row">
          <strong>{formatMoney(product.priceAmount)}</strong>
          {onAdd && (
            <Button
              size="sm"
              disabled={product.availableQuantity === 0}
              loading={busy}
              onClick={onAdd}
            >
              Add to cart
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
