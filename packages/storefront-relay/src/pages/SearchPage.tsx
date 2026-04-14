import { Suspense, useState, useTransition } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useSearchParams } from 'react-router-dom';
import { ProductGrid, ProductGridSkeleton } from '@/components/product/ProductGrid';

const PAGE_SIZE = 40;

// Always-unfiltered facets for the sidebar.
const SearchFacetsQuery = graphql`
  query SearchPageFacetsQuery($term: String) {
    search(input: { term: $term, take: 0, groupByProduct: true }) {
      facetValues {
        count
        facetValue {
          id name
          facet { id name code }
        }
      }
    }
  }
`;

const SearchProductsQuery = graphql`
  query SearchPageProductsQuery($input: SearchInput!) {
    search(input: $input) {
      items { ...ProductCard_product }
      totalItems
    }
  }
`;

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

// Sidebar: suspends independently from products.
function SearchFacets({ term, facetValueIds, onToggle }: {
  term: string;
  facetValueIds: string[];
  onToggle: (id: string) => void;
}) {
  const data = useLazyLoadQuery(
    SearchFacetsQuery,
    { term: term || undefined },
    { fetchPolicy: 'network-only' },
  ) as any;

  type FacetGroupMap = Record<string, { facetName: string; values: { id: string; name: string; count: number }[] }>;
  const facetGroups = ((data.search.facetValues ?? []) as any[]).reduce(
    (acc: FacetGroupMap, fv) => {
      const code = fv.facetValue.facet.code;
      if (!acc[code]) acc[code] = { facetName: fv.facetValue.facet.name, values: [] };
      acc[code].values.push({ id: String(fv.facetValue.id), name: fv.facetValue.name, count: fv.count });
      return acc;
    },
    {} as FacetGroupMap,
  );

  return (
    <>
      {Object.entries(facetGroups).map(([code, group]: any) => (
        <div key={code} style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem' }}>{group.facetName}</div>
          {group.values.map((v: any) => (
            <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.25rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={facetValueIds.includes(v.id)} onChange={() => onToggle(v.id)} />
              {v.name} <span style={{ color: '#9ca3af' }}>({v.count})</span>
            </label>
          ))}
        </div>
      ))}
    </>
  );
}

// Products: re-suspends when term/filters/take change.
function SearchProducts({ term, facetValueIds, take, facetValues, onLoadMore }: {
  term: string;
  facetValueIds: string[];
  take: number;
  facetValues: any[];
  onLoadMore: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const facetValueFilters = buildFacetValueFilters(facetValueIds, facetValues);

  const data = useLazyLoadQuery(
    SearchProductsQuery,
    {
      input: {
        term: term || undefined,
        skip: 0,
        take,
        groupByProduct: true,
        facetValueFilters,
      },
    },
    { fetchPolicy: 'store-and-network' },
  ) as any;

  const items = data.search.items ?? [];
  const total = data.search.totalItems ?? 0;

  return (
    <div style={{ flex: 1 }}>
      <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        {total} products found
      </p>
      <ProductGrid products={items} pending={isPending} />
      {items.length < total && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={() => startTransition(() => onLoadMore())}
            disabled={isPending}
            style={{ padding: '0.75rem 2rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            {isPending ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

// FacetDataBridge: fetches facets once, then renders products with the right filters.
function FacetDataBridge({ term, facetValueIds, take, onLoadMore }: {
  term: string;
  facetValueIds: string[];
  take: number;
  onLoadMore: () => void;
}) {
  const data = useLazyLoadQuery(
    SearchFacetsQuery,
    { term: term || undefined },
    { fetchPolicy: 'network-only' },
  ) as any;

  return (
    <SearchProducts
      term={term}
      facetValueIds={facetValueIds}
      take={take}
      facetValues={data.search.facetValues ?? []}
      onLoadMore={onLoadMore}
    />
  );
}

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const term = searchParams.get('q') ?? '';
  const facetValueIds = searchParams.getAll('fv');
  const [take, setTake] = useState(PAGE_SIZE);
  const [, startFilterTransition] = useTransition();

  function toggleFacet(id: string) {
    startFilterTransition(() => {
      const current = searchParams.getAll('fv');
      const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
      const params = new URLSearchParams();
      if (term) params.set('q', term);
      next.forEach(v => params.append('fv', v));
      setSearchParams(params);
      setTake(PAGE_SIZE);
    });
  }

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
        {term ? `Results for "${term}"` : 'All Products'}
      </h1>

      <div style={{ display: 'flex', gap: '2rem' }}>
        <aside style={{ width: 220, flexShrink: 0 }}>
          <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Filter</div>
          <Suspense fallback={<FacetSidebarSkeleton />}>
            <SearchFacets term={term} facetValueIds={facetValueIds} onToggle={toggleFacet} />
          </Suspense>
        </aside>

        <Suspense fallback={<div style={{ flex: 1 }}><ProductGridSkeleton /></div>}>
          <FacetDataBridge
            term={term}
            facetValueIds={facetValueIds}
            take={take}
            onLoadMore={() => setTake(t => t + PAGE_SIZE)}
          />
        </Suspense>
      </div>
    </div>
  );
}

function FacetSidebarSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ marginBottom: '1.5rem' }}>
          <div style={{ width: 80, height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
          {Array.from({ length: 4 }).map((_, j) => (
            <div key={j} style={{ height: 14, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.4rem' }} />
          ))}
        </div>
      ))}
    </>
  );
}
