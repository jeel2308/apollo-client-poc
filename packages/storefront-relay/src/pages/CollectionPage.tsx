import { Suspense, useTransition, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ProductGrid, ProductGridSkeleton } from '@/components/product/ProductGrid';

const PAGE_SIZE = 40;

// Always-unfiltered query: collection info + full facet list for the sidebar.
// store-or-network: serves from Relay store on revisit (instant), fetches from
// network only on first load per slug.
const CollectionFacetsQuery = graphql`
  query CollectionPageFacetsQuery($slug: String!) {
    collection(slug: $slug) {
      id name slug description
      breadcrumbs { id name slug }
      children { id name slug }
      featuredAsset { id preview }
    }
    search(input: { collectionSlug: $slug, take: 0, groupByProduct: true }) {
      totalItems
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

// Filtered + paginated products.
// Uses facetValueFilters: OR within each facet group, AND between groups.
const CollectionProductsQuery = graphql`
  query CollectionPageProductsQuery($slug: String!, $skip: Int!, $take: Int!, $facetValueFilters: [FacetValueFilterInput!]) {
    search(input: {
      collectionSlug: $slug
      skip: $skip
      take: $take
      groupByProduct: true
      facetValueFilters: $facetValueFilters
    }) {
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

// ── CollectionFacets sub-component ──────────────────────────────────────────
// Suspends independently — breadcrumbs + filter sidebar load separately from products.
function CollectionFacets({ slug, facetValueIds, onToggleFacet }: {
  slug: string;
  facetValueIds: string[];
  onToggleFacet: (id: string) => void;
}) {
  const data = useLazyLoadQuery(
    CollectionFacetsQuery,
    { slug },
    // store-or-network: serve from store instantly on revisit, only fetch once per slug.
    // network-only would re-suspend every time you navigate back to this collection.
    { fetchPolicy: 'store-or-network' },
  ) as any;

  const collection = data.collection;

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
      {collection && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            {collection.breadcrumbs
              .filter((b: any) => b.slug !== '__root_collection__')
              .map((b: any, i: number) => (
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

      {collection?.children?.length > 0 && (
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

      <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Filter</div>
      {Object.entries(facetGroups).map(([code, group]: any) => (
        <div key={code} style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: '0.5rem', color: '#374151' }}>
            {group.facetName}
          </div>
          {group.values.map((v: any) => (
            <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', marginBottom: '0.25rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={facetValueIds.includes(v.id)}
                onChange={() => onToggleFacet(v.id)}
              />
              {v.name} <span style={{ color: '#9ca3af' }}>({v.count})</span>
            </label>
          ))}
        </div>
      ))}
    </>
  );
}

// ── CollectionProducts sub-component ────────────────────────────────────────
// Suspends independently — products can load/reload without re-suspending the sidebar.
// `take` grows as the user clicks Load More (via useTransition in the parent).
function CollectionProducts({ slug, take, facetValueFilters, onLoadMore }: {
  slug: string;
  take: number;
  facetValueFilters: any;
  onLoadMore: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const data = useLazyLoadQuery(
    CollectionProductsQuery,
    { slug, skip: 0, take, facetValueFilters },
    // store-or-network: avoids the double-render flash that store-and-network causes
    // (showing stale data briefly then overwriting with fresh data from the network).
    { fetchPolicy: 'store-or-network' },
  ) as any;

  const items = data.search.items ?? [];
  const total = data.search.totalItems ?? 0;
  const hasMore = items.length < total;

  function handleLoadMore() {
    startTransition(() => onLoadMore());
  }

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>
        <span>{total} products</span>
      </div>

      <ProductGrid products={items} pending={isPending} />

      {hasMore && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            style={{ padding: '0.75rem 2rem', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            {isPending ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
// Owns URL state and useTransition for filter changes.
// Renders two independent Suspense boundaries so facets and products load separately.
export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [, startFilterTransition] = useTransition();

  const facetValueIds = searchParams.getAll('fv');
  const [take, setTake] = useState(PAGE_SIZE);

  // Recompute facetValueFilters from URL on every render.
  // We don't have facet data here (it's in CollectionFacets), so we pass raw IDs
  // and let CollectionFacets resolve them to group filters once loaded.
  // For the products query we need the grouped filters — but we defer that until
  // CollectionFacets has rendered. Products query receives the same IDs as a
  // variable and builds the filter on its own by re-reading available facet values.
  //
  // NOTE: facetValueFilters are built inside CollectionProductsInner once we have
  // the facet data, or passed as raw IDs. To keep things simple and avoid prop
  // drilling from CollectionFacets → parent → CollectionProducts, we duplicate
  // the buildFacetValueFilters logic in a separate FacetAwareProduts component.

  function toggleFacet(id: string) {
    startFilterTransition(() => {
      const current = searchParams.getAll('fv');
      const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
      const params = new URLSearchParams();
      next.forEach(v => params.append('fv', v));
      setSearchParams(params);
      setTake(PAGE_SIZE); // reset to first page on filter change
    });
  }

  if (!slug) return null;

  return (
    <div>
      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Sidebar: breadcrumbs + child chips + filter checkboxes */}
        <aside style={{ width: 220, flexShrink: 0 }}>
          <Suspense fallback={<FacetsSkeleton />}>
            <CollectionFacets
              slug={slug}
              facetValueIds={facetValueIds}
              onToggleFacet={toggleFacet}
            />
          </Suspense>
        </aside>

        {/* Products grid with its own Suspense — re-suspends when filters change */}
        <Suspense fallback={<div style={{ flex: 1 }}><ProductGridSkeleton /></div>}>
          <FacetAwareProducts
            slug={slug}
            facetValueIds={facetValueIds}
            take={take}
            onLoadMore={() => setTake(t => t + PAGE_SIZE)}
          />
        </Suspense>
      </div>
    </div>
  );
}

// ── FacetAwareProducts ───────────────────────────────────────────────────────
// Fetches facets (for grouping) + products together so we can build correct
// facetValueFilters before firing the products query.
const FacetDataQuery = graphql`
  query CollectionPageFacetDataQuery($slug: String!) {
    search(input: { collectionSlug: $slug, take: 0, groupByProduct: true }) {
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

function FacetAwareProducts({ slug, facetValueIds, take, onLoadMore }: {
  slug: string;
  facetValueIds: string[];
  take: number;
  onLoadMore: () => void;
}) {
  const facetData = useLazyLoadQuery(
    FacetDataQuery,
    { slug },
    // store-or-network: CollectionFacets already fetched this data — hitting the store
    // here avoids a second network round-trip and, crucially, avoids suspending twice
    // when a filter changes (once for facets, once for products).
    { fetchPolicy: 'store-or-network' },
  ) as any;

  const facetValueFilters = buildFacetValueFilters(
    facetValueIds,
    facetData.search.facetValues ?? [],
  );

  return (
    <CollectionProducts
      slug={slug}
      take={take}
      facetValueFilters={facetValueFilters}
      onLoadMore={onLoadMore}
    />
  );
}

function FacetsSkeleton() {
  return (
    <>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ width: 160, height: 13, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
        <div style={{ width: 240, height: 28, background: '#f3f4f6', borderRadius: 4, marginBottom: '0.5rem' }} />
        <div style={{ width: 300, height: 14, background: '#f3f4f6', borderRadius: 4 }} />
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ width: 80, height: 30, background: '#f3f4f6', borderRadius: 20 }} />
        ))}
      </div>
      <div style={{ fontWeight: 600, marginBottom: '1rem' }}>Filter</div>
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
