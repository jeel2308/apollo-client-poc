import { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { HomePage } from '@/pages/HomePage';
import { CollectionPage } from '@/pages/CollectionPage';
import { ProductDetailPage } from '@/pages/ProductDetailPage';
import { SearchPage } from '@/pages/SearchPage';
import { CartPage } from '@/pages/CartPage';
import { CheckoutPage } from '@/pages/CheckoutPage';
import { AccountPage } from '@/pages/AccountPage';
import { OrderHistoryPage } from '@/pages/OrderHistoryPage';
import { OrderDetailPage } from '@/pages/OrderDetailPage';

// Each page gets its own Suspense boundary so that navigating to a page shows
// that page's skeleton while its data loads, without blocking the rest of the app.
function PageSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: '#9ca3af' }}>Loading...</div>}>
      {children}
    </Suspense>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<PageSuspense><HomePage /></PageSuspense>} />
        <Route path="/collections/:slug" element={<CollectionPage />} />
        <Route path="/products/:slug" element={<PageSuspense><ProductDetailPage /></PageSuspense>} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/cart" element={<PageSuspense><CartPage /></PageSuspense>} />
        <Route path="/checkout" element={<PageSuspense><CheckoutPage /></PageSuspense>} />
        <Route path="/account" element={<PageSuspense><AccountPage /></PageSuspense>} />
        <Route path="/account/orders" element={<PageSuspense><OrderHistoryPage /></PageSuspense>} />
        <Route path="/account/orders/:code" element={<PageSuspense><OrderDetailPage /></PageSuspense>} />
      </Route>
    </Routes>
  );
}
