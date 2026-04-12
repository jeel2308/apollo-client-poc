import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { useSearchParams } from 'react-router-dom';
import { ProductGrid } from '@/components/product/ProductGrid';
import { ProductCardFragment } from '@/components/product/ProductCard';

const PAGE_SIZE = 40;

// Fetches UNFILTERED facets so the sidebar always shows all options.
const SearchFacetsQuery = gql`
  query SearchFacets($term: String) {
    search(input: { term: $term, take: 0, groupByProduct: true }) {
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

// Fetches filtered + paginated products.
// Uses facetValueFilters: OR within each facet group, AND between groups.
const SearchProductsQuery = gql`
  ${ProductCardFragment}
  query SearchProducts($input: SearchInput!) {
    search(input: $input) {
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

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const term = searchParams.get('q') ?? '';
  const page = parseInt(searchParams.get('page') ?? '1');
  const facetValueIds = searchParams.getAll('fv');

  // Always-unfiltered facet list.
  const { data: facetData } = useQuery(SearchFacetsQuery, {
    variables: { term: term || undefined },
    fetchPolicy: 'no-cache',
  });

  // Group selected IDs by facet. Wait for facetData when filters are active.
  const facetValueFilters = buildFacetValueFilters(
    facetValueIds,
    facetData?.search.facetValues ?? [],
  );
  const filtersReady = facetValueIds.length === 0 || !!facetData;

  // Filtered + paginated products.
  const { data, loading, fetchMore } = useQuery(SearchProductsQuery, {
    variables: {
      input: {
        term,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        groupByProduct: true,
        facetValueFilters,
      },
    },
    skip: !filtersReady,
  });

  function toggleFacet(id: string) {
    const current = searchParams.getAll('fv');
    const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    params.set('page', '1');
    next.forEach(v => params.append('fv', v));
    setSearchParams(params);
  }

  function loadMore() {
    const nextSkip = data?.search.items.length ?? 0;
    fetchMore({
      variables: {
        input: {
          term,
          skip: nextSkip,
          take: PAGE_SIZE,
          groupByProduct: true,
          facetValueFilters,
        },
      },
    });
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('page', String(page + 1));
      return next;
    });
  }

  type FacetGroupMap = Record<string, { facetName: string; values: { id: string; name: string; count: number }[] }>;
  const facetGroups = ((facetData?.search.facetValues ?? []) as any[]).reduce(
    (acc: FacetGroupMap, fv) => {
      const code = fv.facetValue.facet.code;
      if (!acc[code]) acc[code] = { facetName: fv.facetValue.facet.name, values: [] };
      acc[code].values.push({ id: String(fv.facetValue.id), name: fv.facetValue.name, count: fv.count });
      return acc;
    },
    {} as FacetGroupMap,
  );

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {term ? `Results for "${term}"` : 'All Products'}
      </h1>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        {loading ? 'Searching...' : `${data?.search.totalItems ?? 0} products found`}
      </p>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <aside style={{ width: 220, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Filter</div>
          {!facetData ? (
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
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>{group.facetName}</div>
              {group.values.map(v => (
                <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.25rem', cursor: 'pointer' }}>
                  <input type="checkbox" checked={facetValueIds.includes(v.id)} onChange={() => toggleFacet(v.id)} />
                  {v.name} <span style={{ color: '#9ca3af' }}>({v.count})</span>
                </label>
              ))}
            </div>
          ))}
        </aside>

        <div style={{ flex: 1 }}>
          <ProductGrid products={data?.search.items ?? []} loading={loading} />
          {data && data.search.items.length < data.search.totalItems && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={loadMore}
                disabled={loading}
                style={{ padding: '0.75rem 2rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
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
