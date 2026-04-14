import { useState } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import { useNavigate, Link } from 'react-router-dom';

const CheckoutOrderQuery = graphql`
  query CheckoutPageQuery {
    activeOrder {
      id code state totalWithTax subTotalWithTax currencyCode
      shippingAddress {
        fullName company streetLine1 streetLine2
        city province postalCode country countryCode phoneNumber
      }
      shippingLines {
        shippingMethod { id name description }
        priceWithTax
      }
      lines {
        id quantity linePriceWithTax
        productVariant {
          id name
          product { id name featuredAsset { id preview } }
        }
      }
    }
    eligibleShippingMethods {
      id name description priceWithTax price
    }
  }
`;

const SetShippingAddressMutation = graphql`
  mutation CheckoutPageSetShippingAddressMutation($input: CreateAddressInput!) {
    setOrderShippingAddress(input: $input) {
      ... on Order { id shippingAddress { fullName streetLine1 city postalCode country } }
      ... on ErrorResult { errorCode message }
    }
  }
`;

const SetShippingMethodMutation = graphql`
  mutation CheckoutPageSetShippingMethodMutation($ids: [ID!]!) {
    setOrderShippingMethod(shippingMethodId: $ids) {
      ... on Order { id shippingLines { shippingMethod { id name } priceWithTax } }
      ... on ErrorResult { errorCode message }
    }
  }
`;

const TransitionOrderMutation = graphql`
  mutation CheckoutPageTransitionOrderMutation($state: String!) {
    transitionOrderToState(state: $state) {
      ... on Order { id code state }
      ... on OrderStateTransitionError { errorCode message transitionError fromState toState }
    }
  }
`;

type Step = 'address' | 'shipping' | 'confirm';

function formatCents(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}

export function CheckoutPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('address');
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);

  const data = useLazyLoadQuery(CheckoutOrderQuery, {}) as any;
  const [setAddress, settingAddress] = useMutation(SetShippingAddressMutation);
  const [setShipping, settingShipping] = useMutation(SetShippingMethodMutation);
  const [transitionOrder, transitioningOrder] = useMutation(TransitionOrderMutation);

  const order = data?.activeOrder;
  if (!order) return <div style={{ padding: '2rem' }}>No active order. <Link to="/search">Shop now</Link></div>;

  async function handleAddressSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    setAddress({
      variables: {
        input: {
          fullName: get('fullName'),
          streetLine1: get('streetLine1'),
          streetLine2: get('streetLine2'),
          city: get('city'),
          province: get('province'),
          postalCode: get('postalCode'),
          countryCode: get('countryCode'),
          phoneNumber: get('phone'),
        },
      },
      onCompleted() { setStep('shipping'); },
    });
  }

  function handleShippingSubmit() {
    if (!selectedMethodId) return;
    setShipping({
      variables: { ids: [selectedMethodId] },
      onCompleted() { setStep('confirm'); },
    });
  }

  function handlePlaceOrder() {
    transitionOrder({
      variables: { state: 'ArrangingPayment' },
      onCompleted(res: any) {
        if (res.transitionOrderToState.__typename === 'Order') {
          navigate('/account/orders');
        }
      },
    });
  }

  const steps: Step[] = ['address', 'shipping', 'confirm'];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>Checkout</h1>

      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem' }}>
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step === s ? '#e94560' : steps.indexOf(step) > i ? '#10b981' : '#e5e7eb',
              color: step === s || steps.indexOf(step) > i ? '#fff' : '#6b7280',
              fontSize: '0.8rem', fontWeight: 600, flexShrink: 0,
            }}>
              {steps.indexOf(step) > i ? '✓' : i + 1}
            </div>
            <span style={{ marginLeft: '0.5rem', fontSize: '0.875rem', fontWeight: step === s ? 600 : 400, color: step === s ? '#111' : '#6b7280', textTransform: 'capitalize' }}>
              {s}
            </span>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: '#e5e7eb', margin: '0 0.75rem' }} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
        <div>
          {step === 'address' && (
            <form onSubmit={handleAddressSubmit}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Shipping Address</h2>
              {[
                { name: 'fullName', label: 'Full Name', required: true },
                { name: 'streetLine1', label: 'Street Address', required: true },
                { name: 'streetLine2', label: 'Apt / Suite (optional)' },
                { name: 'city', label: 'City', required: true },
                { name: 'province', label: 'State / Province', required: true },
                { name: 'postalCode', label: 'Postal Code', required: true },
                { name: 'countryCode', label: 'Country Code (e.g. US)', required: true },
                { name: 'phone', label: 'Phone Number' },
              ].map(field => (
                <div key={field.name} style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>{field.label}</label>
                  <input name={field.name} required={field.required} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <button type="submit" disabled={settingAddress} style={{ width: '100%', padding: '0.75rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                {settingAddress ? 'Saving...' : 'Continue to Shipping'}
              </button>
            </form>
          )}

          {step === 'shipping' && (
            <div>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Shipping Method</h2>
              {data.eligibleShippingMethods.map((method: any) => (
                <label key={method.id} style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem', border: selectedMethodId === method.id ? '2px solid #e94560' : '1px solid #e5e7eb', borderRadius: 6, marginBottom: '0.75rem', cursor: 'pointer' }}>
                  <input type="radio" name="shipping" value={String(method.id)} onChange={() => setSelectedMethodId(String(method.id))} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{method.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{method.description}</div>
                  </div>
                  <div style={{ fontWeight: 600 }}>{formatCents(method.priceWithTax)}</div>
                </label>
              ))}
              <button onClick={handleShippingSubmit} disabled={!selectedMethodId || settingShipping} style={{ width: '100%', padding: '0.75rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, marginTop: '1rem' }}>
                {settingShipping ? 'Saving...' : 'Continue to Confirm'}
              </button>
            </div>
          )}

          {step === 'confirm' && (
            <div>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Confirm Order</h2>
              {order.shippingAddress && (
                <div style={{ background: '#f9fafb', borderRadius: 6, padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 500, marginBottom: '0.5rem', fontSize: '0.875rem' }}>Shipping to</div>
                  <div style={{ fontSize: '0.875rem', color: '#374151' }}>
                    {order.shippingAddress.fullName}<br />
                    {order.shippingAddress.streetLine1}<br />
                    {order.shippingAddress.streetLine2 && <>{order.shippingAddress.streetLine2}<br /></>}
                    {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.postalCode}<br />
                    {order.shippingAddress.country}
                  </div>
                </div>
              )}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '1rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: '#92400e' }}>
                This is a demo checkout — no real payment will be processed.
              </div>
              <button onClick={handlePlaceOrder} disabled={transitioningOrder} style={{ width: '100%', padding: '0.75rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}>
                {transitioningOrder ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          )}
        </div>

        <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem', height: 'fit-content' }}>
          <h3 style={{ fontSize: '0.9rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>Order Summary</h3>
          {order.lines.map((line: any) => (
            <div key={line.id} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, flexShrink: 0, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                {line.productVariant.product.featuredAsset && (
                  <img src={line.productVariant.product.featuredAsset.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
              </div>
              <div style={{ flex: 1, fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 500 }}>{line.productVariant.product.name}</div>
                <div style={{ color: '#6b7280' }}>{line.productVariant.name} × {line.quantity}</div>
              </div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>{formatCents(line.linePriceWithTax)}</div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
            <span>Total</span>
            <span>{formatCents(order.totalWithTax, order.currencyCode)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
