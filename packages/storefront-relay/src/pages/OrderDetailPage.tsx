import { graphql, useLazyLoadQuery } from 'react-relay';
import { Link, useParams } from 'react-router-dom';

const OrderDetailQuery = graphql`
  query OrderDetailPageQuery($code: String!) {
    orderByCode(code: $code) {
      id code state createdAt updatedAt currencyCode
      subTotal subTotalWithTax shipping shippingWithTax total totalWithTax totalQuantity
      shippingAddress {
        fullName company streetLine1 streetLine2
        city province postalCode country countryCode phoneNumber
      }
      billingAddress {
        fullName company streetLine1 streetLine2
        city province postalCode country countryCode phoneNumber
      }
      shippingLines {
        shippingMethod { id name description }
        price priceWithTax discountedPrice discountedPriceWithTax
        discounts { adjustmentSource type description amount amountWithTax }
      }
      taxSummary { description taxRate taxBase taxTotal }
      discounts { adjustmentSource type description amount amountWithTax }
      lines {
        id quantity unitPrice unitPriceWithTax linePrice linePriceWithTax
        discountedLinePrice discountedLinePriceWithTax
        discounts { adjustmentSource type description amount amountWithTax }
        featuredAsset { id preview }
        productVariant {
          id name sku price priceWithTax currencyCode
          product { id slug name }
        }
      }
    }
  }
`;

function formatCents(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

function AddressBlock({ address, title }: { address: any; title: string }) {
  if (!address) return null;
  return (
    <div style={{ background: '#f9fafb', borderRadius: 6, padding: '1rem' }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ fontSize: '0.875rem', color: '#374151', lineHeight: 1.6 }}>
        {address.fullName && <div>{address.fullName}</div>}
        {address.company && <div>{address.company}</div>}
        {address.streetLine1 && <div>{address.streetLine1}</div>}
        {address.streetLine2 && <div>{address.streetLine2}</div>}
        {address.city && <div>{address.city}{address.province && `, ${address.province}`}{address.postalCode && ` ${address.postalCode}`}</div>}
        {address.country && <div>{address.country}</div>}
      </div>
    </div>
  );
}

export function OrderDetailPage() {
  const { code } = useParams<{ code: string }>();
  const data = useLazyLoadQuery(OrderDetailQuery, { code: code! }) as any;

  const order = data?.orderByCode;
  if (!order) return <div style={{ padding: '2rem' }}>Order not found.</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: 0 }}>Order #{order.code}</h1>
        <Link to="/account/orders" style={{ fontSize: '0.875rem', color: '#6b7280' }}>← Back to Orders</Link>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', fontSize: '0.875rem', color: '#6b7280' }}>
        <span>Placed {new Date(order.createdAt).toLocaleDateString()}</span>
        <span>·</span>
        <span style={{ fontWeight: 600, color: '#374151' }}>{order.state}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
        <div>
          <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Items</h2>
          {order.lines.map((line: any) => (
            <div key={line.id} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ width: 72, height: 72, flexShrink: 0, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
                {line.featuredAsset && <img src={line.featuredAsset.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ flex: 1 }}>
                <Link to={`/products/${line.productVariant.product.slug}`} style={{ fontWeight: 500, textDecoration: 'none', color: '#111' }}>
                  {line.productVariant.product.name}
                </Link>
                <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{line.productVariant.name}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>SKU: {line.productVariant.sku} · Qty: {line.quantity}</div>
                {line.discounts.map((d: any, i: number) => (
                  <div key={i} style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.15rem' }}>{d.description}</div>
                ))}
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 600 }}>{formatCents(line.linePriceWithTax, order.currencyCode)}</div>
                {line.discountedLinePriceWithTax < line.linePriceWithTax && (
                  <div style={{ textDecoration: 'line-through', color: '#9ca3af' }}>
                    {formatCents(line.discountedLinePriceWithTax, order.currencyCode)}
                  </div>
                )}
                <div style={{ color: '#6b7280' }}>{formatCents(line.unitPriceWithTax, order.currencyCode)} each</div>
              </div>
            </div>
          ))}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '2rem' }}>
            <AddressBlock address={order.shippingAddress} title="Shipping Address" />
            <AddressBlock address={order.billingAddress} title="Billing Address" />
          </div>
        </div>

        <div>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem', fontSize: '0.875rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Order Summary</h2>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Subtotal</span>
              <span>{formatCents(order.subTotalWithTax, order.currencyCode)}</span>
            </div>
            {order.shippingLines.map((sl: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#6b7280' }}>
                <span>{sl.shippingMethod.name}</span>
                <span>{formatCents(sl.priceWithTax, order.currencyCode)}</span>
              </div>
            ))}
            {order.discounts.map((d: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: '#10b981' }}>
                <span>{d.description}</span>
                <span>-{formatCents(Math.abs(d.amountWithTax), order.currencyCode)}</span>
              </div>
            ))}
            {order.taxSummary.map((t: any, i: number) => (
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
        </div>
      </div>
    </div>
  );
}
