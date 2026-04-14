import { graphql, useLazyLoadQuery } from 'react-relay';
import { Link } from 'react-router-dom';
import { ProductGrid } from '@/components/product/ProductGrid';

const HomePageQuery = graphql`
  query HomePageQuery {
    collections(options: { topLevelOnly: true }) {
      items {
        id
        name
        slug
        description
        featuredAsset {
          id
          preview
        }
      }
      totalItems
    }
    search(input: { take: 40, groupByProduct: true }) {
      items {
        ...ProductCard_product
      }
      totalItems
    }
  }
`;

// This component suspends while data loads — the Suspense boundary in App.tsx
// shows the fallback. No explicit loading check needed here.
export function HomePage() {
  const data = useLazyLoadQuery(HomePageQuery, {}) as any;

  return (
    <div>
      <section style={{ textAlign: 'center', padding: '3rem 0', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', color: '#fff', borderRadius: 12, marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', margin: '0 0 1rem' }}>Relay Store</h1>
        <p style={{ color: '#ccc', fontSize: '1.1rem', margin: '0 0 2rem' }}>
          A complete storefront powered by Relay and Vendure
        </p>
        <Link to="/search" style={{ background: '#e94560', color: '#fff', padding: '0.75rem 2rem', borderRadius: 6, textDecoration: 'none', fontWeight: 600 }}>
          Shop Now
        </Link>
      </section>

      <section style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Shop by Category</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
          {data.collections.items.map((col: any) => (
            <Link
              key={col.id}
              to={`/collections/${col.slug}`}
              style={{
                display: 'block',
                background: col.featuredAsset ? `url(${col.featuredAsset.preview}) center/cover` : '#1a1a2e',
                color: '#fff',
                padding: '2rem 1rem',
                borderRadius: 8,
                textDecoration: 'none',
                fontWeight: 600,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
                minHeight: 100,
              }}
            >
              <span style={{ position: 'relative', zIndex: 1, background: 'rgba(0,0,0,0.5)', padding: '0.25rem 0.5rem', borderRadius: 4 }}>
                {col.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Featured Products</h2>
          <Link to="/search" style={{ color: '#e94560', textDecoration: 'none', fontSize: '0.9rem' }}>
            View all →
          </Link>
        </div>
        <ProductGrid products={data.search.items} />
      </section>
    </div>
  );
}
