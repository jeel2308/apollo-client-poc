import { Suspense } from 'react';
import { Outlet, Link, NavLink, useNavigate } from 'react-router-dom';
import { graphql, useLazyLoadQuery } from 'react-relay';

const CartBadgeQuery = graphql`
  query LayoutCartBadgeQuery {
    activeOrder {
      id
      totalQuantity
    }
  }
`;

// Isolated Suspense island: suspends only itself while the cart badge loads.
// Layout never blocks waiting for cart count — the rest of the nav renders immediately.
function CartBadge() {
  const data = useLazyLoadQuery(CartBadgeQuery, {}) as any;
  const qty = data?.activeOrder?.totalQuantity;
  return (
    <Link to="/cart" style={{ color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}>
      Cart {qty ? `(${qty})` : ''}
    </Link>
  );
}

export function Layout() {
  const navigate = useNavigate();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = (e.currentTarget.elements.namedItem('q') as HTMLInputElement).value.trim();
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh' }}>
      <header style={{ background: '#1a1a2e', color: '#fff', padding: '0 2rem' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem', height: 60 }}>
          <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '1.2rem' }}>
            Relay Store
          </Link>

          <nav style={{ display: 'flex', gap: '1rem', flex: 1 }}>
            {[
              { to: '/collections/electronics', label: 'Electronics' },
              { to: '/collections/clothing', label: 'Clothing' },
              { to: '/collections/books', label: 'Books' },
              { to: '/collections/home-garden', label: 'Home' },
              { to: '/collections/sports-outdoors', label: 'Sports' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                style={({ isActive }) => ({
                  color: isActive ? '#e94560' : '#ccc',
                  textDecoration: 'none',
                  fontSize: '0.9rem',
                })}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              name="q"
              placeholder="Search products..."
              style={{ padding: '0.3rem 0.6rem', borderRadius: 4, border: 'none', fontSize: '0.875rem' }}
            />
            <button type="submit" style={{ padding: '0.3rem 0.7rem', borderRadius: 4, background: '#e94560', color: '#fff', border: 'none', cursor: 'pointer' }}>
              Search
            </button>
          </form>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/account" style={{ color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}>Account</Link>
            {/* CartBadge is an isolated Suspense island — its pending state only affects itself */}
            <Suspense fallback={<Link to="/cart" style={{ color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}>Cart</Link>}>
              <CartBadge />
            </Suspense>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>
        <Outlet />
      </main>

      <footer style={{ background: '#f5f5f5', padding: '2rem', marginTop: '4rem', textAlign: 'center', color: '#666', fontSize: '0.875rem' }}>
        Relay Store — Demo Storefront
      </footer>
    </div>
  );
}
