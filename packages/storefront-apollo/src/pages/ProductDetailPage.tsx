import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useParams, Link } from 'react-router-dom';
import { graphql } from '@/gql';

/**
 * ProductVariantPrice has no id field — stored inline in Apollo cache.
 * This fragment exercises that type directly.
 */
const ProductVariantFragment = graphql(`
  fragment ProductVariantDetail on ProductVariant {
    id
    name
    sku
    stockLevel
    currencyCode
    price
    priceWithTax
    options {
      id
      code
      name
      group {
        id
        name
        code
      }
    }
    assets {
      id
      preview
      name
    }
    featuredAsset {
      id
      preview
    }
  }
`);

const ProductDetailQuery = gql`
  ${ProductVariantFragment}
  query ProductDetail($slug: String!) {
    product(slug: $slug) {
      id
      name
      slug
      description
      featuredAsset {
        id
        preview
        name
      }
      assets {
        id
        preview
        name
      }
      facetValues {
        id
        name
        facet {
          id
          name
          code
        }
      }
      optionGroups {
        id
        name
        code
        options {
          id
          name
          code
        }
      }
      variants {
        ...ProductVariantDetail
      }
      collections {
        id
        name
        slug
        breadcrumbs {
          id
          name
          slug
        }
      }
    }
  }
`;

const AddToCartMutation = graphql(`
  mutation AddToCart($variantId: ID!, $quantity: Int!) {
    addItemToOrder(productVariantId: $variantId, quantity: $quantity) {
      ... on Order {
        id
        totalQuantity
        totalWithTax
        lines {
          id
          quantity
          linePriceWithTax
          productVariant {
            id
            name
          }
        }
      }
      ... on ErrorResult {
        errorCode
        message
      }
    }
  }
`);

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, loading } = useQuery(ProductDetailQuery, {
    variables: { slug: slug! },
    skip: !slug,
  });
  const [addToCart, { loading: adding }] = useMutation(AddToCartMutation);

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [selectedAssetIndex, setSelectedAssetIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [addedMessage, setAddedMessage] = useState('');

  const product = data?.product;
  const variants = product?.variants ?? [];
  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? variants[0];
  const allAssets = product?.assets ?? [];
  const displayAsset = allAssets[selectedAssetIndex] ?? selectedVariant?.featuredAsset ?? product?.featuredAsset;

  async function handleAddToCart() {
    if (!selectedVariant) return;
    const res = await addToCart({ variables: { variantId: selectedVariant.id, quantity } });
    if (res.data?.addItemToOrder.__typename === 'Order') {
      setAddedMessage('Added to cart!');
      setTimeout(() => setAddedMessage(''), 2000);
    }
  }

  if (loading) return (
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
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ width: 70, height: 36, background: '#f3f4f6', borderRadius: 4 }} />
            ))}
          </div>
          <div style={{ height: 48, background: '#f3f4f6', borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
  if (!product) return <div style={{ padding: '2rem', color: '#e94560' }}>Product not found.</div>;

  return (
    <div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1.5rem' }}>
        {product.collections[0]?.breadcrumbs.filter(b => b.slug !== '__root_collection__').map((b, i) => (
          <span key={b.id}>
            {i > 0 && ' / '}
            <Link to={`/collections/${b.slug}`} style={{ color: '#6b7280' }}>{b.name}</Link>
          </span>
        ))}
        {product.collections[0] && ' / '}
        {product.name}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem' }}>
        {/* Image gallery */}
        <div>
          <div style={{ aspectRatio: '1', background: '#f3f4f6', borderRadius: 8, overflow: 'hidden', marginBottom: '0.75rem' }}>
            {displayAsset ? (
              <img src={displayAsset.preview} alt={displayAsset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af' }}>No image</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {allAssets.map((asset, i) => (
              <button
                key={asset.id}
                onClick={() => setSelectedAssetIndex(i)}
                style={{
                  width: 64, height: 64, padding: 0, border: i === selectedAssetIndex ? '2px solid #e94560' : '1px solid #e5e7eb',
                  borderRadius: 4, overflow: 'hidden', cursor: 'pointer', background: 'none',
                }}
              >
                <img src={asset.preview} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Product info */}
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>{product.name}</h1>

          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#e94560', marginBottom: '1rem' }}>
            {selectedVariant ? `$${(selectedVariant.priceWithTax / 100).toFixed(2)}` : '—'}
          </div>

          <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: '1.5rem' }}>{product.description}</p>

          {/* Option groups */}
          {product.optionGroups.map(group => (
            <div key={group.id} style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>{group.name}</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {group.options.map(opt => {
                  const variantWithOpt = variants.find(v => v.options.some(o => o.id === opt.id));
                  const isSelected = selectedVariant?.options.some(o => o.id === opt.id);
                  return (
                    <button
                      key={opt.id}
                      onClick={() => variantWithOpt && setSelectedVariantId(variantWithOpt.id)}
                      style={{
                        padding: '0.4rem 0.8rem', borderRadius: 4,
                        border: isSelected ? '2px solid #1a1a2e' : '1px solid #e5e7eb',
                        background: isSelected ? '#1a1a2e' : '#fff',
                        color: isSelected ? '#fff' : '#374151',
                        cursor: 'pointer', fontSize: '0.875rem',
                      }}
                    >
                      {opt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* SKU */}
          <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem' }}>
            SKU: {selectedVariant?.sku} | Stock: {selectedVariant?.stockLevel}
          </div>

          {/* Quantity + add to cart */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}>−</button>
              <span style={{ padding: '0 0.75rem', fontWeight: 500 }}>{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} style={{ padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem' }}>+</button>
            </div>
            <button
              onClick={handleAddToCart}
              disabled={adding || !selectedVariant}
              style={{ flex: 1, padding: '0.75rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}
            >
              {adding ? 'Adding...' : addedMessage || 'Add to Cart'}
            </button>
          </div>

          {/* Facet values */}
          {product.facetValues.length > 0 && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {product.facetValues.map(fv => (
                <span key={fv.id} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', background: '#f3f4f6', borderRadius: 4, color: '#6b7280' }}>
                  {fv.facet.name}: {fv.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
