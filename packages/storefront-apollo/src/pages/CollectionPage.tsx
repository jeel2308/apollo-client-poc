import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductCardFragment } from '@/components/product/ProductCard';

const PAGE_SIZE = 40;

// Fetches collection metadata + UNFILTERED facets so the filter sidebar
// always shows all available options regardless of active selections.
const CollectionFacetsQuery = gql`
  query CollectionFacets($slug: String!) {
    collection(slug: $slug) {
      id
      name
      slug
      description
      breadcrumbs { id name slug }
      children { id name slug }
      featuredAsset { id preview }
    }
    search(input: { collectionSlug: $slug, take: 0, groupByProduct: true }) {
      totalItems
      facetValues {
        count
        facetValue {
          id
          name
          facet { id name code }
        }
      }
    }
  }
`;

// Fetches filtered + paginated products separately.
// Uses facetValueFilters instead of facetValueIds so that selections from
// different facet groups are ANDed together (OR within each group).
const CollectionProductsQuery = gql`
  ${ProductCardFragment}
  query CollectionProducts($slug: String!, $skip: Int!, $take: Int!, $facetValueFilters: [FacetValueFilterInput!]) {
    search(input: {
      collectionSlug: $slug
      skip: $skip
      take: $take
      groupByProduct: true
      facetValueFilters: $facetValueFilters
    }) {
      items { ...ProductCard }
      totalItems
    }
  }
`;

// Groups selected facet value IDs by their parent facet, then builds a
// facetValueFilters array: OR within each group, AND between groups.
function buildFacetValueFilters(selectedIds: string[], allFacetValues: any[]) {
  if (!selectedIds.length) return undefined;
  const groupMap: Record<string, string[]> = {};
  for (const fv of allFacetValues) {
    const id = String(fv.facetValue.id);
    if (selectedIds.includes(id)) {
      const facetId = String(fv.facetValue.facet.id);
      if (!groupMap[facetId]) groupMap[facetId] = [];
      groupMap[facetId].push(id);
    }
  }
  const groups = Object.values(groupMap);
  return groups.length ? groups.map(ids => ({ or: ids })) : undefined;
}

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page') ?? '1');
  const facetValueIds = searchParams.getAll('fv');

  // Always-unfiltered query: collection info + full facet list.
  // fetchPolicy: 'no-cache' keeps this query out of the shared Query.search
  // cache entry so it never clobbers the products query's items array.
  const { data: facetData } = useQuery(CollectionFacetsQuery, {
    variables: { slug: slug! },
    skip: !slug,
    fetchPolicy: 'no-cache',
  });

  // Group selected IDs by facet so we can build facetValueFilters.
  // Wait for facetData before firing the products query when filters are active,
  // so we always have the grouping information available.
  const facetValueFilters = buildFacetValueFilters(
    facetValueIds,
    facetData?.search.facetValues ?? [],
  );
  const filtersReady = facetValueIds.length === 0 || !!facetData;

  // Filtered + paginated products query.
  const { data: productData, loading, fetchMore } = useQuery(CollectionProductsQuery, {
    variables: {
      slug: slug!,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      facetValueFilters,
    },
    skip: !slug || !filtersReady,
  });

  const totalPages = Math.ceil((productData?.search.totalItems ?? 0) / PAGE_SIZE);

  function toggleFacet(id: string) {
    const current = searchParams.getAll('fv');
    const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
    const params = new URLSearchParams();
    params.set('page', '1');
    next.forEach(v => params.append('fv', v));
    setSearchParams(params);
  }

  function loadMore() {
    const nextSkip = productData?.search.items.length ?? 0;
    fetchMore({ variables: { skip: nextSkip, take: PAGE_SIZE } });
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(page + 1));
      return next;
    });
  }

  type FacetGroupMap = Record<string, { facetName: string; values: { id: string; name: string; count: number }[] }>;
  const facetGroups = ((facetData?.search.facetValues ?? []) as any[]).reduce(
    (acc: FacetGroupMap, fv) => {
      const facetCode = fv.facetValue.facet.code;
      if (!acc[facetCode]) acc[facetCode] = { facetName: fv.facetValue.facet.name, values: [] };
      acc[facetCode].values.push({ id: String(fv.facetValue.id), name: fv.facetValue.name, count: fv.count });
      return acc;
    },
    {} as FacetGroupMap,
  );

  const collection = facetData?.collection;
  const facetLoading = !facetData;

  return (
    <div>
      {facetLoading ? (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ width: 160, height: 13, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
          <div style={{ width: 240, height: 28, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
          <div style={{ width: 300, height: 14, background: '#f3f4f6', borderRadius: 4 }} />
        </div>
      ) : collection && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            {collection.breadcrumbs.filter((b: any) => b.slug !== '__root_collection__').map((b: any, i: number) => (
              <span key={b.id}>
                {i > 0 && ' / '}
                <Link to={`/collections/${b.slug}`} style={{ color: '#6b7280' }}>{b.name}</Link>
              </span>
            ))}
          </div>
          <h1 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem' }}>{collection.name}</h1>
          {collection.description && (
            <p style={{ color: '#6b7280', margin: 0 }}>{collection.description}</p>
          )}
        </div>
      )}

      {facetLoading ? (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ width: 80, height: 30, background: '#f3f4f6', borderRadius: 20 }} />
          ))}
        </div>
      ) : collection?.children && collection.children.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          {collection.children.map((child: any) => (
            <Link
              key={child.id}
              to={`/collections/${child.slug}`}
              style={{ padding: '0.4rem 0.8rem', border: '1px solid #e5e7eb', borderRadius: 20, fontSize: '0.85rem', textDecoration: 'none', color: '#374151' }}
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: '2rem' }}>
        <aside style={{ width: 220, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Filter</div>
          {facetLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ marginBottom: '1.5rem' }}>
                <div style={{ width: 80, height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} style={{ height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.4rem' }} />
                ))}
              </div>
            ))
          ) : Object.entries(facetGroups).map(([code, group]) => (
            <div key={code} style={{ marginBottom: '1.5rem' }}>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem', color: '#374151' }}>
                {group.facetName}
              </div>
              {group.values.map(v => (
                <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.25rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={facetValueIds.includes(v.id)}
                    onChange={() => toggleFacet(v.id)}
                  />
                  {v.name} <span style={{ color: '#9ca3af' }}>({v.count})</span>
                </label>
              ))}
            </div>
          ))}
        </aside>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
            <span>{productData?.search.totalItems ?? '...'} products</span>
            <span>Page {page} of {totalPages || '...'}</span>
          </div>

          <ProductGrid products={productData?.search.items ?? []} loading={loading} />

          {productData && productData.search.items.length < productData.search.totalItems && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={loadMore}
                disabled={loading}
                style={{ padding: '0.75rem 2rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem' }}
              >
                {loading ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
