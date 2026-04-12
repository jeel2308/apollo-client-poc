import { useQuery } from '@apollo/client/react';
import { Link } from 'react-router-dom';
import { graphql } from '@/gql';

/**
 * Order list queries TaxLine and ShippingLine (both id-less) per order.
 * As pagination grows, each new page adds more inline (non-normalized) objects.
 */
const OrderHistoryQuery = graphql(`
  query OrderHistory($skip: Int!, $take: Int!) {
    activeCustomer {
      id
      orders(options: { skip: $skip, take: $take, sort: { updatedAt: DESC } }) {
        totalItems
        items {
          id
          code
          state
          createdAt
          updatedAt
          totalWithTax
          currencyCode
          totalQuantity
          taxSummary {
            description
            taxRate
            taxBase
            taxTotal
          }
          shippingLines {
            shippingMethod {
              id
              name
            }
            priceWithTax
          }
          lines {
            id
            quantity
            productVariant {
              id
              name
              product {
                id
                name
                featuredAsset {
                  id
                  preview
                }
              }
            }
          }
        }
      }
    }
  }
`);

const PAGE_SIZE = 40;

const ORDER_STATE_COLORS: Record<string, string> = {
  PaymentAuthorized: '#dbeafe',
  PaymentSettled: '#d1fae5',
  Shipped: '#e0e7ff',
  Delivered: '#d1fae5',
  Cancelled: '#fee2e2',
  ArrangingPayment: '#fef3c7',
  AddingItems: '#f3f4f6',
};

const ORDER_STATE_TEXT: Record<string, string> = {
  PaymentAuthorized: '#1e40af',
  PaymentSettled: '#065f46',
  Shipped: '#3730a3',
  Delivered: '#065f46',
  Cancelled: '#991b1b',
  ArrangingPayment: '#92400e',
  AddingItems: '#374151',
};

function formatCents(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function OrderHistoryPage() {
  const { data, loading, fetchMore } = useQuery(OrderHistoryQuery, {
    variables: { skip: 0, take: PAGE_SIZE },
  });

  const orders = data?.activeCustomer?.orders;

  function loadMore() {
    fetchMore({ variables: { skip: orders?.items.length ?? 0, take: PAGE_SIZE } });
  }

  if (loading && !orders) return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div style={{ width: 180, height: 28, background: '#f3f4f6', borderRadius: 4 }} />
        <div style={{ width: 120, height: 16, background: '#f3f4f6', borderRadius: 4 }} />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
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

  if (!data?.activeCustomer) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <p>Please <Link to="/account" style={{ color: '#e94560' }}>sign in</Link> to view your orders.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Order History</h1>
        <Link to="/account" style={{ fontSize: '0.875rem', color: '#6b7280' }}>← Back to Account</Link>
      </div>

      {!orders?.items.length ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          <p>No orders yet.</p>
          <Link to="/search" style={{ color: '#e94560' }}>Start shopping →</Link>
        </div>
      ) : (
        <div>
          {orders.items.map(order => (
            <Link key={order.id} to={`/account/orders/${order.code}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem', marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                {/* Thumbnails */}
                <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                  {order.lines.slice(0, 3).map(line => (
                    <div key={line.id} style={{ width: 52, height: 52, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      {line.productVariant.product.featuredAsset && (
                        <img src={line.productVariant.product.featuredAsset.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  ))}
                  {order.lines.length > 3 && (
                    <div style={{ width: 52, height: 52, background: '#f3f4f6', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                      +{order.lines.length - 3}
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Order #{order.code}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    {new Date(order.updatedAt).toLocaleDateString()} · {order.totalQuantity} items
                  </div>
                  {order.shippingLines[0] && (
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                      via {order.shippingLines[0].shippingMethod.name}
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem' }}>
                    {formatCents(order.totalWithTax, order.currencyCode)}
                  </div>
                  <span style={{
                    fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: 4,
                    background: ORDER_STATE_COLORS[order.state] ?? '#f3f4f6',
                    color: ORDER_STATE_TEXT[order.state] ?? '#374151',
                  }}>
                    {order.state}
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {orders.items.length < orders.totalItems && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                onClick={loadMore}
                disabled={loading}
                style={{ padding: '0.75rem 2rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                {loading ? 'Loading...' : 'Load More Orders'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
