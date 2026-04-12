import { Link } from 'react-router-dom';
import { graphql, FragmentType, getFragmentData } from '@/gql';

/**
 * Fragment for ProductCard.
 *
 * Intentionally queries `priceWithTax` which resolves to SearchResultPrice —
 * a union of PriceRange | SinglePrice, both types WITHOUT id fields.
 * These will be stored inline (non-normalized) in Apollo's cache.
 */
export const ProductCardFragment = graphql(`
  fragment ProductCard on SearchResult {
    productId
    productName
    slug
    priceWithTax {
      ... on PriceRange {
        min
        max
      }
      ... on SinglePrice {
        value
      }
    }
    productAsset {
      id
      preview
    }
    collectionIds
    inStock
  }
`);

type Props = {
  product: FragmentType<typeof ProductCardFragment>;
};

function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function ProductCard({ product }: Props) {
  const p = getFragmentData(ProductCardFragment, product);

  const priceLabel =
    p.priceWithTax.__typename === 'PriceRange'
      ? `${formatPrice(p.priceWithTax.min)} – ${formatPrice(p.priceWithTax.max)}`
      : p.priceWithTax.__typename === 'SinglePrice'
        ? formatPrice(p.priceWithTax.value)
        : '—';

  return (
    <Link to={`/products/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          overflow: 'hidden',
          transition: 'box-shadow 0.15s',
          background: '#fff',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)')}
        onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.boxShadow = 'none')}
      >
        <div style={{ aspectRatio: '1', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {p.productAsset ? (
            <img
              src={p.productAsset.preview}
              alt={p.productName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>No image</span>
          )}
        </div>
        <div style={{ padding: '0.75rem' }}>
          <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.productName}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#e94560', fontWeight: 600, fontSize: '0.9rem' }}>{priceLabel}</span>
            {!p.inStock && (
              <span style={{ fontSize: '0.7rem', color: '#9ca3af', border: '1px solid #e5e7eb', padding: '0.1rem 0.4rem', borderRadius: 3 }}>
                Out of stock
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
