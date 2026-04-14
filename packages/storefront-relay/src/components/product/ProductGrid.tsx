import { ProductCard } from './ProductCard';

type Props = {
  products: any[]; // ProductCard_product$key[] after `pnpm relay`
  pending?: boolean;
};

export function ProductGrid({ products, pending }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', opacity: pending ? 0.6 : 1, transition: 'opacity 0.2s' }}>
      {products.map((p, i) => (
        <ProductCard key={i} product={p} />
      ))}
    </div>
  );
}

export function ProductGridSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, aspectRatio: '1.2', background: '#f3f4f6' }} />
      ))}
    </div>
  );
}
