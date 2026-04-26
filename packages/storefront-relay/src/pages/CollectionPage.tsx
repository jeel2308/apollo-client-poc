import { Suspense, useTransition, useState } from 'react';
import { graphql, useLazyLoadQuery } from 'react-relay';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { ProductGrid, ProductGridSkeleton } from '@/components/product/ProductGrid';

const PAGE_SIZE = 40;

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

// ── CollectionProducts ───────────────────────────────────────────────────────
// Single query — no waterfall. facetValueFilters already computed by the parent
// (which already has facet data from CollectionFacetsQuery).
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
    { fetchPolicy: 'store-or-network' },
  ) as any;

  const items = data.search.items ?? [];
  const total = data.search.totalItems ?? 0;

  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
        {total} products
      </div>
      <ProductGrid products={items} pending={isPending} />
      {items.length < total && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <button
            onClick={() => startTransition(() => onLoadMore())}
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

// ── CollectionContent ────────────────────────────────────────────────────────
// Fetches facets (store-or-network) then renders sidebar inline + products in a
// nested Suspense. Because products receive facetValueFilters as a prop (already
// computed here), CollectionProducts only ever suspends on ONE query — no waterfall.
function CollectionContent({ slug, take, facetValueIds, onLoadMore, onToggleFacet }: {
  slug: string;
  take: number;
  facetValueIds: string[];
  onLoadMore: () => void;
  onToggleFacet: (id: string) => void;
}) {
  const data = useLazyLoadQuery(
    CollectionFacetsQuery,
    { slug },
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

  const facetValueFilters = buildFacetValueFilters(facetValueIds, data.search.facetValues ?? []);

  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0 }}>
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
      </aside>

      {/* Products — own Suspense so it can suspend without re-suspending the sidebar */}
      <Suspense fallback={<div style={{ flex: 1 }}><ProductGridSkeleton /></div>}>
        <CollectionProducts
          slug={slug}
          take={take}
          facetValueFilters={facetValueFilters}
          onLoadMore={onLoadMore}
        />
      </Suspense>
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [, startFilterTransition] = useTransition();
  const facetValueIds = searchParams.getAll('fv');
  const [take, setTake] = useState(PAGE_SIZE);

  function toggleFacet(id: string) {
    startFilterTransition(() => {
      const current = searchParams.getAll('fv');
      const next = current.includes(id) ? current.filter(v => v !== id) : [...current, id];
      const params = new URLSearchParams();
      next.forEach(v => params.append('fv', v));
      setSearchParams(params);
      setTake(PAGE_SIZE);
    });
  }

  if (!slug) return null;

  return (
    <Suspense fallback={<CollectionPageSkeleton />}>
      <CollectionContent
        slug={slug}
        take={take}
        facetValueIds={facetValueIds}
        onLoadMore={() => setTake(t => t + PAGE_SIZE)}
        onToggleFacet={toggleFacet}
      />
    </Suspense>
  );
}

function CollectionPageSkeleton() {
  return (
    <div style={{ display: 'flex', gap: '2rem' }}>
      <aside style={{ width: 220, flexShrink: 0 }}>
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
      </aside>
      <div style={{ flex: 1 }}><ProductGridSkeleton /></div>
    </div>
  );
}
