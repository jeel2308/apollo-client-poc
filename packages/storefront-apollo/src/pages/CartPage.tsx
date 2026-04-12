import { useQuery, useMutation } from '@apollo/client/react';
import { Link } from 'react-router-dom';
import { graphql } from '@/gql';

/**
 * CartPage intentionally queries:
 * - ShippingLine (no id field) — inline in cache
 * - TaxLine (no id field) — inline in cache
 * - Adjustment (no id field) — inline in cache
 * - OrderAddress (no id field) — inline in cache
 * These will show up as non-normalized embedded objects in Apollo's InMemoryCache.
 */
const ActiveOrderQuery = graphql(`
  query ActiveOrder {
    activeOrder {
      id
      code
      state
      totalQuantity
      subTotal
      subTotalWithTax
      total
      totalWithTax
      currencyCode
      taxSummary {
        description
        taxRate
        taxBase
        taxTotal
      }
      discounts {
        adjustmentSource
        type
        description
        amount
        amountWithTax
      }
      shippingLines {
        shippingMethod {
          id
          name
          description
        }
        priceWithTax
        discountedPriceWithTax
        discounts {
          adjustmentSource
          type
          description
          amount
          amountWithTax
        }
      }
      lines {
        id
        quantity
        linePrice
        linePriceWithTax
        discountedLinePrice
        discountedLinePriceWithTax
        discounts {
          adjustmentSource
          type
          description
          amount
          amountWithTax
        }
        productVariant {
          id
          name
          sku
          price
          priceWithTax
          currencyCode
          product {
            id
            slug
            name
            featuredAsset {
              id
              preview
            }
          }
        }
        featuredAsset {
          id
          preview
        }
      }
    }
  }
`);

const AdjustOrderLineMutation = graphql(`
  mutation AdjustOrderLine($lineId: ID!, $quantity: Int!) {
    adjustOrderLine(orderLineId: $lineId, quantity: $quantity) {
      ... on Order {
        id
        totalQuantity
        totalWithTax
        lines {
          id
          quantity
          linePriceWithTax
        }
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`);

const RemoveOrderLineMutation = graphql(`
  mutation RemoveOrderLine($lineId: ID!) {
    removeOrderLine(orderLineId: $lineId) {
      ... on Order {
        id
        totalQuantity
        totalWithTax
        lines {
          id
          quantity
        }
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`);

function formatCents(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function CartPage() {
  const { data, loading } = useQuery(ActiveOrderQuery);
  const [adjustLine] = useMutation(AdjustOrderLineMutation);
  const [removeLine] = useMutation(RemoveOrderLineMutation);

  const order = data?.activeOrder;

  if (loading && !order) return (
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
              <div style={{ width: 80, height: 32, background: '#f3f4f6', borderRadius: 4 }} />
            </div>
          ))}
        </div>
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem', height: 'fit-content' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 16, background: '#e5e7eb', borderRadius: 4, marginBottom: '0.75rem' }} />
          ))}
          <div style={{ height: 44, background: '#e5e7eb', borderRadius: 6, marginTop: '1rem' }} />
        </div>
      </div>
    </div>
  );

  if (!order || order.lines.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Your cart is empty</h1>
        <Link to="/search" style={{ color: '#e94560', textDecoration: 'none' }}>Continue shopping →</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Shopping Cart</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '2rem' }}>
        <div>
          {order.lines.map(line => (
            <div key={line.id} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ width: 80, height: 80, flexShrink: 0, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                {(line.featuredAsset ?? line.productVariant.product.featuredAsset) && (
                  <img
                    src={(line.featuredAsset ?? line.productVariant.product.featuredAsset)!.preview}
                    alt={line.productVariant.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <Link to={`/products/${line.productVariant.product.slug}`} style={{ fontWeight: 500, textDecoration: 'none', color: '#111827' }}>
                  {line.productVariant.product.name}
                </Link>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{line.productVariant.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>SKU: {line.productVariant.sku}</div>
                {line.discounts.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                    {line.discounts.map((d, i) => <span key={i}>{d.description} </span>)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600 }}>{formatCents(line.linePriceWithTax, order.currencyCode)}</div>
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <button
                    onClick={() => adjustLine({ variables: { lineId: line.id, quantity: line.quantity - 1 } })}
                    style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer' }}
                  >−</button>
                  <span style={{ padding: '0 0.5rem', fontSize: '0.875rem' }}>{line.quantity}</span>
                  <button
                    onClick={() => adjustLine({ variables: { lineId: line.id, quantity: line.quantity + 1 } })}
                    style={{ padding: '0.25rem 0.5rem', border: 'none', background: 'none', cursor: 'pointer' }}
                  >+</button>
                </div>
                <button
                  onClick={() => removeLine({ variables: { lineId: line.id } })}
                  style={{ fontSize: '0.75rem', color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary — queries ShippingLine, TaxLine (no id fields) */}
        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem', height: 'fit-content' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Order Summary</h2>
          <div style={{ fontSize: '0.9rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Subtotal</span>
              <span>{formatCents(order.subTotalWithTax, order.currencyCode)}</span>
            </div>

            {order.shippingLines.map((sl, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#6b7280' }}>
                <span>{sl.shippingMethod.name}</span>
                <span>{formatCents(sl.priceWithTax, order.currencyCode)}</span>
              </div>
            ))}

            {order.discounts.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#10b981' }}>
                <span>{d.description}</span>
                <span>-{formatCents(Math.abs(d.amountWithTax), order.currencyCode)}</span>
              </div>
            ))}

            {order.taxSummary.map((t, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#6b7280', fontSize: '0.8rem' }}>
                <span>{t.description} ({t.taxRate}%)</span>
                <span>{formatCents(t.taxTotal, order.currencyCode)}</span>
              </div>
            ))}

            <div style={{ borderTop: '1px solid #e5e7eb', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem' }}>
              <span>Total</span>
              <span>{formatCents(order.totalWithTax, order.currencyCode)}</span>
            </div>
          </div>

          <Link
            to="/checkout"
            style={{ display: 'block', marginTop: '1rem', background: '#e94560', color: '#fff', padding: '0.75rem', borderRadius: 6, textDecoration: 'none', textAlign: 'center', fontWeight: 600 }}
          >
            Proceed to Checkout
          </Link>
        </div>
      </div>
    </div>
  );
}
