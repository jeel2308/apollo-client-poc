import { Suspense } from 'react';
import { Routes, Route, useParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { CollectionPage } from '@/pages/CollectionPage';
import { SearchPage } from '@/pages/SearchPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { AccountPage } from '@/pages/AccountPage';
import { OrderHistoryPage } from '@/pages/OrderHistoryPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';
import { ProductGridSkeleton } from '@/components/product/ProductGrid';

// ── Page-level skeletons ─────────────────────────────────────────────────────
// Each matches the rough shape of its page so the layout doesn't jump.

function HomePageSkeleton() {
  return (
    <div>
      <div style={{ height: 200, background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: 12, marginBottom: '3rem' }} />
      <div style={{ width: 200, height: 24, background: '#f3f4f6', borderRadius: 4, marginBottom: '1.5rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '3rem' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 120, background: '#f3f4f6', borderRadius: 8 }} />
        ))}
      </div>
      <div style={{ width: 200, height: 24, background: '#f3f4f6', borderRadius: 4, marginBottom: '1.5rem' }} />
      <ProductGridSkeleton />
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div>
      <div style={{ width: 200, height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '1.5rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
        <div>
          <div style={{ aspectRatio: '1', background: '#f3f4f6', borderRadius: 8, marginBottom: '0.75rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ width: 64, height: 64, background: '#f3f4f6', borderRadius: 4 }} />
            ))}
          </div>
        </div>
        <div>
          <div style={{ height: 32, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.75rem' }} />
          <div style={{ width: 100, height: 28, background: '#f3f4f6', borderRadius: 4, marginBottom: '1rem' }} />
          <div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
          <div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem', width: '80%' }} />
          <div style={{ height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '1.5rem', width: '60%' }} />
          <div style={{ height: 48, background: '#f3f4f6', borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div>
      <div style={{ width: 180, height: 28, background: '#f3f4f6', borderRadius: 4, marginBottom: '2rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
        <div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ width: 80, height: 80, background: '#f3f4f6', borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 16, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
                <div style={{ width: '60%', height: 14, background: '#f3f4f6', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem', height: 220 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 16, background: '#e5e7eb', borderRadius: 4, marginBottom: '0.75rem' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TwoColumnFormSkeleton() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ width: 160, height: 28, background: '#f3f4f6', borderRadius: 4, marginBottom: '2rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
        <div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ marginBottom: '1rem' }}>
              <div style={{ width: 100, height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.25rem' }} />
              <div style={{ height: 38, background: '#f3f4f6', borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem', height: 200 }} />
      </div>
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div>
      <div style={{ width: 180, height: 28, background: '#f3f4f6', borderRadius: 4, marginBottom: '2rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem' }}>
            <div style={{ width: 80, height: 18, background: '#e5e7eb', borderRadius: 4, marginBottom: '1rem' }} />
            <div style={{ height: 16, background: '#e5e7eb', borderRadius: 4, marginBottom: '0.5rem' }} />
            <div style={{ width: '70%', height: 14, background: '#e5e7eb', borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderListSkeleton() {
  return (
    <div>
      <div style={{ width: 180, height: 28, background: '#f3f4f6', borderRadius: 4, marginBottom: '2rem' }} />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} style={{ width: 52, height: 52, background: '#f3f4f6', borderRadius: 4 }} />
            ))}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ width: 140, height: 16, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
            <div style={{ width: 100, height: 13, background: '#f3f4f6', borderRadius: 4 }} />
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ width: 80, height: 18, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
            <div style={{ width: 60, height: 22, background: '#f3f4f6', borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ width: 200, height: 28, background: '#f3f4f6', borderRadius: 4 }} />
        <div style={{ width: 120, height: 16, background: '#f3f4f6', borderRadius: 4 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
        <div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ width: 72, height: 72, background: '#f3f4f6', borderRadius: 6, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 16, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
                <div style={{ width: '50%', height: 13, background: '#f3f4f6', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem', height: 200 }} />
      </div>
    </div>
  );
}

// Wrappers that read the URL slug and pass it as `key` so React fully unmounts
// and remounts the page component on every collection/product change.
// Without this, React Router reuses the same component instance across slugs —
// local state (e.g. `take`) carries over and Relay's previous query subscriptions
// can bleed through before new data arrives, showing the wrong collection's products.
function KeyedCollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  return <CollectionPage key={slug} />;
}

function KeyedProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  return (
    <Suspense fallback={<ProductDetailSkeleton />} key={slug}>
      <ProductDetailPage />
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Suspense fallback={<HomePageSkeleton />}><HomePage /></Suspense>} />
        <Route path="/collections/:slug" element={<KeyedCollectionPage />} />
        <Route path="/products/:slug" element={<KeyedProductDetailPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/cart" element={<Suspense fallback={<CartSkeleton />}><CartPage /></Suspense>} />
        <Route path="/checkout" element={<Suspense fallback={<TwoColumnFormSkeleton />}><CheckoutPage /></Suspense>} />
        <Route path="/account" element={<Suspense fallback={<AccountSkeleton />}><AccountPage /></Suspense>} />
        <Route path="/account/orders" element={<Suspense fallback={<OrderListSkeleton />}><OrderHistoryPage /></Suspense>} />
        <Route path="/account/orders/:code" element={<Suspense fallback={<OrderDetailSkeleton />}><OrderDetailPage /></Suspense>} />
      </Route>
    </Routes>
  );
}
