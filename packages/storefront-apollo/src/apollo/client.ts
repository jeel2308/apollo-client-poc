import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

/**
 * Apollo Client v4 setup.
 *
 * Cache policy decisions for the memory benchmark:
 *
 * - No reactive variables, no local-only fields, no @client directives.
 *   Everything in the cache comes from the server.
 *
 * - typePolicies deliberately includes types WITHOUT an `id` field
 *   (PriceRange, SinglePrice, TaxLine, OrderAddress, ShippingLine, Adjustment,
 *   ProductVariantPrice) so we can observe how Apollo stores them inline
 *   (non-normalized) vs. normalized types that have `id`.
 *
 * - keyFields: false on id-less types tells Apollo explicitly not to attempt
 *   normalization — they will be stored as embedded objects, duplicated per
 *   parent. This is the default Apollo behavior but made explicit here for
 *   documentation and to ensure consistent benchmark conditions.
 */

const httpLink = new HttpLink({
  uri: import.meta.env.VITE_VENDURE_SHOP_API_URL ?? 'http://localhost:3000/shop-api',
  credentials: 'include',
});

export const apolloClient = new ApolloClient({
  link: httpLink,
  cache: new InMemoryCache({
    typePolicies: {
      // ── Types WITH id fields (normalized) ──────────────────────────────────
      Query: {},
      Product: { keyFields: ['id'] },
      ProductVariant: { keyFields: ['id'] },
      Collection: { keyFields: ['id'] },
      Facet: { keyFields: ['id'] },
      FacetValue: { keyFields: ['id'] },
      Order: { keyFields: ['id'] },
      OrderLine: { keyFields: ['id'] },
      Customer: { keyFields: ['id'] },
      Address: { keyFields: ['id'] },
      ShippingMethod: { keyFields: ['id'] },
      Asset: { keyFields: ['id'] },
      TaxCategory: { keyFields: ['id'] },
      TaxRate: { keyFields: ['id'] },
      ProductOption: { keyFields: ['id'] },
      ProductOptionGroup: { keyFields: ['id'] },

      // ── Types WITHOUT id fields (inline / non-normalized) ──────────────────
      // These will be duplicated in the cache for each parent that references
      // them — the key target for Apollo memory analysis.
      PriceRange: { keyFields: false },
      SinglePrice: { keyFields: false },
      TaxLine: { keyFields: false },
      OrderAddress: { keyFields: false },
      ShippingLine: { keyFields: false },
      Adjustment: { keyFields: false },
      ProductVariantPrice: { keyFields: false },
      ConfigArg: { keyFields: false },
      ConfigArgDefinition: { keyFields: false },
      HistoryEntryData: { keyFields: false },

      // ── Pagination: offset-based (Vendure uses skip/take) ─────────────────
      //
      // The merge function MUST live on the field that receives the skip/take
      // args, not on a nested type's items field (where args would be empty).
      //
      // keyArgs excludes skip/take so all pages of the same logical query
      // share one cache entry. The merge function places incoming items at
      // the correct offset using the args available at this level.
      Query: {
        fields: {
          // search(input: { collectionSlug, term, facetValueFilters, skip, take })
          search: {
            keyArgs: ['input', ['collectionSlug', 'term', 'groupByProduct', 'facetValueFilters']],
            merge(existing: any, incoming: any, { args }) {
              const skip = (args as any)?.input?.skip ?? 0;
              const existingItems: unknown[] = existing?.items ?? [];
              const merged = existingItems.slice(0);
              (incoming.items ?? []).forEach((item: unknown, i: number) => {
                merged[skip + i] = item;
              });
              return { ...incoming, items: merged };
            },
          },
        },
      },
      SearchResponse: { keyFields: false },

      // products(options: { skip, take }) — used on product listing pages
      ProductList: {
        keyFields: false,
        fields: {
          items: {
            merge(existing: unknown[] = [], incoming: unknown[], { args }) {
              const skip = (args as any)?.options?.skip ?? 0;
              const merged = existing.slice(0);
              incoming.forEach((item, i) => { merged[skip + i] = item; });
              return merged;
            },
          },
        },
      },
      // orders(options: { skip, take })
      OrderList: {
        keyFields: false,
        fields: {
          items: {
            merge(existing: unknown[] = [], incoming: unknown[], { args }) {
              const skip = (args as any)?.options?.skip ?? 0;
              const merged = existing.slice(0);
              incoming.forEach((item, i) => { merged[skip + i] = item; });
              return merged;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      // cache-and-network: serves cached data immediately, then updates from network.
      // This exercises both cache reads and cache writes on each query.
      fetchPolicy: 'cache-and-network',
      nextFetchPolicy: 'cache-first',
    },
  },
});
