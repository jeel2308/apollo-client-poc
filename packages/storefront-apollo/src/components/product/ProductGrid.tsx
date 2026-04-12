import { FragmentType } from '@/gql';
import { ProductCard, ProductCardFragment } from './ProductCard';

type Props = {
  products: FragmentType<typeof ProductCardFragment>[];
  loading?: boolean;
};

export function ProductGrid({ products, loading }: Props) {
  if (loading && products.length === 0) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, aspectRatio: '1.2', background: '#f3f4f6', animation: 'pulse 1.5s infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
      {products.map((p, i) => (
        <ProductCard key={i} product={p} />
      ))}
    </div>
  );
}
