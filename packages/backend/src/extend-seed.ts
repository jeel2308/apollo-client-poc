/**
 * extend-seed.ts
 *
 * Adds ~800 more products (3 variants each) to an already-seeded database,
 * bringing the total to ~1 000 products / ~2 500 variants.
 *
 * Key benchmark goals:
 *  - More normalized Product + ProductVariant cache entries
 *  - Every product has 3 price-tiered variants → priceWithTax resolves to
 *    PriceRange (non-normalized inline object) for every search result card
 *  - More pages available to load → larger in-memory pagination arrays
 *
 * Run: pnpm --filter backend extend-seed
 * (backend server must be running on localhost:3000)
 *
 * Idempotent: uses slug prefix "x-" so it never conflicts with the original
 * seed slugs and can be re-run safely (Vendure will 409 on duplicate slugs
 * and the script skips them).
 */

import 'dotenv/config';

const ADMIN_API = process.env.VENDURE_ADMIN_API_URL ?? 'http://localhost:3000/admin-api';
const CONCURRENCY = 15;

// ── Data tables ───────────────────────────────────────────────────────────────

const BRANDS = ['TechPro', 'StyleCo', 'ReadWorld', 'HomeEssentials', 'SportElite', 'PrimeBrand', 'AlphaTech', 'BetaWear'];
const COLORS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Grey', 'Pink'];
const MATERIALS = ['Cotton', 'Polyester', 'Leather', 'Aluminum', 'Steel', 'Wood', 'Plastic', 'Glass'];

const TEMPLATES = [
  // Electronics
  { prefix: 'Laptop',     collection: 'laptops',        priceRange: [80000,  300000] },
  { prefix: 'Smartphone', collection: 'smartphones',    priceRange: [30000,  150000] },
  { prefix: 'Headphones', collection: 'audio',          priceRange: [5000,   50000]  },
  { prefix: 'Camera',     collection: 'cameras',        priceRange: [40000,  200000] },
  { prefix: 'Monitor',    collection: 'laptops',        priceRange: [20000,  120000] },
  { prefix: 'Tablet',     collection: 'smartphones',    priceRange: [25000,  100000] },
  { prefix: 'Speaker',    collection: 'audio',          priceRange: [3000,   40000]  },
  { prefix: 'Keyboard',   collection: 'laptops',        priceRange: [2000,   20000]  },
  // Clothing
  { prefix: 'T-Shirt',    collection: 'mens-clothing',  priceRange: [1500,   8000]   },
  { prefix: 'Dress',      collection: 'womens-clothing',priceRange: [3000,   20000]  },
  { prefix: 'Jacket',     collection: 'mens-clothing',  priceRange: [8000,   40000]  },
  { prefix: 'Hoodie',     collection: 'mens-clothing',  priceRange: [4000,   18000]  },
  { prefix: 'Shorts',     collection: 'mens-clothing',  priceRange: [1500,   7000]   },
  { prefix: 'Scarf',      collection: 'womens-clothing',priceRange: [1000,   6000]   },
  // Books
  { prefix: 'Novel',      collection: 'fiction',        priceRange: [800,    3000]   },
  { prefix: 'Guide',      collection: 'technical-books',priceRange: [2000,   8000]   },
  { prefix: 'Biography',  collection: 'non-fiction',    priceRange: [900,    3500]   },
  { prefix: 'Textbook',   collection: 'technical-books',priceRange: [3000,   12000]  },
  // Home
  { prefix: 'Chair',      collection: 'furniture',      priceRange: [10000,  80000]  },
  { prefix: 'Cookware Set',collection: 'kitchen',       priceRange: [5000,   30000]  },
  { prefix: 'Coffee Maker',collection: 'kitchen',       priceRange: [4000,   25000]  },
  { prefix: 'Desk Lamp',  collection: 'furniture',      priceRange: [2000,   12000]  },
  { prefix: 'Blender',    collection: 'kitchen',        priceRange: [3000,   18000]  },
  // Sports
  { prefix: 'Running Shoes', collection: 'running',     priceRange: [5000,   25000]  },
  { prefix: 'Bicycle',    collection: 'cycling',        priceRange: [30000,  200000] },
  { prefix: 'Yoga Mat',   collection: 'running',        priceRange: [1500,   8000]   },
  { prefix: 'Backpack',   collection: 'camping',        priceRange: [4000,   20000]  },
  { prefix: 'Tent',       collection: 'camping',        priceRange: [8000,   60000]  },
];

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function gql(token: string, query: string, variables?: Record<string, unknown>): Promise<any> {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json() as any;
  if (json.errors) throw new Error(json.errors[0]?.message ?? JSON.stringify(json.errors));
  return json.data;
}

async function getAuthToken(): Promise<string> {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation { login(username: "superadmin", password: "superadmin123") {
        ... on CurrentUser { id }
        ... on InvalidCredentialsError { message }
      }}`,
    }),
  });
  const token = res.headers.get('vendure-auth-token') ?? '';
  if (!token) throw new Error('Login failed — is the server running?');
  return token;
}

// ── Lookup helpers ─────────────────────────────────────────────────────────────

async function loadFacetValueMap(token: string): Promise<Record<string, Record<string, string>>> {
  // Returns { brand: { TechPro: '1', ... }, color: { Black: '2', ... }, ... }
  const data = await gql(token, `query {
    facets(options: { take: 100 }) {
      items {
        code
        values { id name }
      }
    }
  }`);
  const map: Record<string, Record<string, string>> = {};
  for (const facet of data.facets.items) {
    map[facet.code] = {};
    for (const fv of facet.values) {
      map[facet.code][fv.name] = String(fv.id);
    }
  }
  return map;
}

async function loadCollectionIdMap(token: string): Promise<Record<string, string>> {
  const data = await gql(token, `query {
    collections(options: { take: 200 }) {
      items { id slug }
    }
  }`);
  const map: Record<string, string> = {};
  for (const col of data.collections.items) {
    map[col.slug] = String(col.id);
  }
  return map;
}

async function loadTaxCategoryId(token: string): Promise<string> {
  const data = await gql(token, `query { taxCategories(options: { take: 1 }) { items { id } } }`);
  const id = data.taxCategories.items[0]?.id;
  if (!id) throw new Error('No tax category found — did you run the original seed?');
  return String(id);
}

// ── Option group setup ────────────────────────────────────────────────────────

interface EditionOptions {
  groupId: string;
  standardId: string;
  proId: string;
  premiumId: string;
}

async function setupEditionOptionGroup(token: string): Promise<EditionOptions> {
  // Check if it already exists (idempotent re-runs)
  const existing = await gql(token, `query {
    productOptionGroups { items { id code options { id code } } }
  }`);
  const found = existing.productOptionGroups?.items?.find((g: any) => g.code === 'edition');
  if (found) {
    const opt = (code: string) => String(found.options.find((o: any) => o.code === code)?.id ?? '');
    return { groupId: String(found.id), standardId: opt('standard'), proId: opt('pro'), premiumId: opt('premium') };
  }

  const data = await gql(token, `
    mutation CreateOptionGroup($input: CreateProductOptionGroupInput!) {
      createProductOptionGroup(input: $input) {
        id
        options { id code }
      }
    }`, {
    input: {
      code: 'edition',
      translations: [{ languageCode: 'en', name: 'Edition' }],
      options: [
        { code: 'standard', translations: [{ languageCode: 'en', name: 'Standard' }] },
        { code: 'pro',      translations: [{ languageCode: 'en', name: 'Pro' }] },
        { code: 'premium',  translations: [{ languageCode: 'en', name: 'Premium' }] },
      ],
    },
  });
  const g = data.createProductOptionGroup;
  const opt = (code: string) => String(g.options.find((o: any) => o.code === code)?.id ?? '');
  return { groupId: String(g.id), standardId: opt('standard'), proId: opt('pro'), premiumId: opt('premium') };
}

// ── Product creation ───────────────────────────────────────────────────────────

interface ProductJob {
  name: string;
  slug: string;
  description: string;
  collectionSlug: string;
  facetValueIds: string[];
  variants: { name: string; sku: string; price: number; optionId: string }[];
}

async function createProduct(
  token: string,
  taxCategoryId: string,
  job: ProductJob,
  editions: EditionOptions,
): Promise<string | null> {
  // 1. Create product
  let productId: string;
  try {
    const data = await gql(token, `
      mutation CreateProduct($input: CreateProductInput!) {
        createProduct(input: $input) { id }
      }`, {
      input: {
        enabled: true,
        facetValueIds: job.facetValueIds,
        translations: [{ languageCode: 'en', name: job.name, slug: job.slug, description: job.description }],
      },
    });
    productId = String(data.createProduct.id);
  } catch (err: any) {
    if (err.message?.includes('slug')) return null; // duplicate slug — skip
    throw err;
  }

  // 2. Assign the shared "Edition" option group so variants can have distinct options
  await gql(token, `
    mutation AddGroup($productId: ID!, $optionGroupId: ID!) {
      addOptionGroupToProduct(productId: $productId, optionGroupId: $optionGroupId) { id }
    }`, { productId, optionGroupId: editions.groupId });

  // 3. Create 3 price-tiered variants — different optionIds → Vendure accepts them,
  //    different prices → priceWithTax resolves to PriceRange in every search card.
  await gql(token, `
    mutation CreateVariants($input: [CreateProductVariantInput!]!) {
      createProductVariants(input: $input) { ... on ProductVariant { id } }
    }`, {
    input: job.variants.map(v => ({
      productId,
      optionIds: [v.optionId],
      sku: v.sku,
      price: v.price,
      taxCategoryId,
      facetValueIds: job.facetValueIds,
      stockOnHand: 100,
      trackInventory: 'FALSE',
      translations: [{ languageCode: 'en', name: v.name }],
    })),
  });

  return productId;
}

async function assignCollectionFilter(token: string, collectionId: string, productIds: string[]): Promise<void> {
  try {
    await gql(token, `
      mutation UpdateCollection($id: ID!, $productIds: String!) {
        updateCollection(input: {
          id: $id
          filters: [{ code: "product-id-filter", arguments: [
            { name: "productIds", value: $productIds },
            { name: "combineWithAnd", value: "false" }
          ]}]
        }) { id }
      }`, { id: collectionId, productIds: JSON.stringify(productIds) });
  } catch (err: any) {
    console.warn(`\n  Warning assigning collection ${collectionId}:`, err.message);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function run() {
  console.log('Authenticating...');
  const token = await getAuthToken();

  console.log('Loading existing facets / collections / tax categories...');
  const [facetMap, collectionIdMap, taxCategoryId, editions] = await Promise.all([
    loadFacetValueMap(token),
    loadCollectionIdMap(token),
    loadTaxCategoryId(token),
    setupEditionOptionGroup(token),
  ]);
  console.log(`Edition option group: ${editions.groupId} (standard=${editions.standardId}, pro=${editions.proId}, premium=${editions.premiumId})`);

  // Build job list
  // 28 templates × 30 products = 840 new products, 3 variants each = 2 520 new variants
  const PRODUCTS_PER_TEMPLATE = 30;
  const jobs: ProductJob[] = [];
  let idx = 0;

  for (const tmpl of TEMPLATES) {
    for (let i = 1; i <= PRODUCTS_PER_TEMPLATE; i++) {
      const brand = BRANDS[idx % BRANDS.length];
      const color = COLORS[idx % COLORS.length];
      const material = MATERIALS[idx % MATERIALS.length];
      // "x-" prefix guarantees no slug collision with the original seed
      const slug = `x-${tmpl.prefix.toLowerCase().replace(/\s+/g, '-')}-${brand.toLowerCase()}-${i}`;
      const basePrice = tmpl.priceRange[0] + Math.floor(
        Math.random() * (tmpl.priceRange[1] - tmpl.priceRange[0])
      );

      const facetValueIds = [
        facetMap['brand']?.[brand],
        facetMap['color']?.[color],
        facetMap['material']?.[material],
      ].filter(Boolean) as string[];

      // Three price-tiered variants → priceWithTax resolves to PriceRange in
      // every search result, exercising the inline (non-normalized) cache path.
      jobs.push({
        name: `${brand} ${tmpl.prefix} X${i}`,
        slug,
        description: `Premium ${tmpl.prefix.toLowerCase()} by ${brand}. Crafted from ${material}, available in ${color}. Built for performance and style.`,
        collectionSlug: tmpl.collection,
        facetValueIds,
        variants: [
          { name: 'Standard', sku: `${slug.toUpperCase()}-STD`, price: basePrice,                        optionId: editions.standardId },
          { name: 'Pro',      sku: `${slug.toUpperCase()}-PRO`, price: Math.round(basePrice * 1.4),     optionId: editions.proId      },
          { name: 'Premium',  sku: `${slug.toUpperCase()}-PRM`, price: Math.round(basePrice * 2.0),     optionId: editions.premiumId  },
        ],
      });
      idx++;
    }
  }

  console.log(`Creating ${jobs.length} products (3 variants each = ${jobs.length * 3} variants)...`);

  // Track per-collection product IDs for filter assignment
  const collectionProducts: Record<string, string[]> = {};
  let created = 0;
  let skipped = 0;

  // Process in parallel batches
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async job => {
      const productId = await createProduct(token, taxCategoryId, job, editions);
      if (productId) {
        created++;
        const colId = collectionIdMap[job.collectionSlug];
        if (colId) {
          if (!collectionProducts[colId]) collectionProducts[colId] = [];
          collectionProducts[colId].push(productId);
        }
      } else {
        skipped++;
      }
      const done = created + skipped;
      process.stdout.write(`\r  ${done}/${jobs.length} (${created} created, ${skipped} skipped)`);
    }));
  }

  console.log(`\n\nAssigning ${Object.keys(collectionProducts).length} collections...`);

  // For each collection: fetch existing products first, then append new ones
  // so we don't drop the originals from the filter.
  for (const [colId, newIds] of Object.entries(collectionProducts)) {
    // Fetch existing product IDs from the search index (original seed products),
    // then merge with the new IDs so we don't drop originals from the filter.
    const searchData = await gql(token, `query Search($colId: ID!) {
      search(input: { collectionId: $colId, take: 0, groupByProduct: true }) {
        totalItems
      }
    }`, { colId });

    // We need ALL productIds (original + new) for the filter.
    // The simplest way: get them from the search index (which has original products).
    const totalExisting = searchData.search.totalItems as number;
    const existingIds: string[] = [];
    if (totalExisting > 0) {
      let skip = 0;
      const PAGE = 100;
      while (existingIds.length < totalExisting) {
        const page = await gql(token, `query SearchPage($colId: ID!, $skip: Int!) {
          search(input: { collectionId: $colId, take: ${PAGE}, skip: $skip, groupByProduct: true }) {
            items { productId }
          }
        }`, { colId, skip });
        const ids = page.search.items.map((x: any) => String(x.productId));
        existingIds.push(...ids);
        skip += PAGE;
        if (ids.length < PAGE) break;
      }
    }

    const allIds = [...new Set([...existingIds, ...newIds])];
    await assignCollectionFilter(token, colId, allIds);
    process.stdout.write('.');
  }

  console.log(`\n\nDone!`);
  console.log(`  Created: ${created} products × 3 variants = ${created * 3} new variants`);
  console.log(`  Skipped: ${skipped} (duplicate slugs)`);
  console.log(`\nRestart the backend (or trigger a reindex in Admin UI) so the search`);
  console.log(`index picks up the new products.`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
