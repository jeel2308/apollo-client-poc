/**
 * fill-to-200.ts
 *
 * Queries every non-root sub-collection's current product count and
 * creates exactly enough new products (slug prefix "z-") to bring
 * each collection up to at least 200 products.
 *
 * Run:  pnpm --filter backend fill-to-200
 * (backend server must be running on localhost:3000)
 *
 * Idempotent: duplicate "z-" slugs are silently skipped.
 */

import 'dotenv/config';

const ADMIN_API = process.env.VENDURE_ADMIN_API_URL ?? 'http://localhost:3000/admin-api';
const TARGET = 1600;
const CONCURRENCY = 1;

// ── Product name templates per collection slug ────────────────────────────────

const TEMPLATES: Record<string, { prefix: string; priceRange: [number, number] }[]> = {
  laptops:        [{ prefix: 'Laptop',      priceRange: [80000,  300000] }, { prefix: 'Monitor',  priceRange: [20000, 120000] }, { prefix: 'Keyboard',  priceRange: [2000,  20000] }],
  smartphones:    [{ prefix: 'Smartphone',  priceRange: [30000,  150000] }, { prefix: 'Tablet',   priceRange: [25000, 100000] }, { prefix: 'Smartwatch',priceRange: [8000,  60000]  }],
  audio:          [{ prefix: 'Headphones',  priceRange: [5000,   50000]  }, { prefix: 'Speaker',  priceRange: [3000,  40000]  }, { prefix: 'Earbuds',   priceRange: [2000,  25000]  }],
  cameras:        [{ prefix: 'Camera',      priceRange: [40000,  200000] }, { prefix: 'Lens',     priceRange: [20000, 150000] }, { prefix: 'Tripod',    priceRange: [3000,  20000]  }],
  'mens-clothing':[{ prefix: 'T-Shirt',     priceRange: [1500,   8000]   }, { prefix: 'Jacket',   priceRange: [8000,  40000]  }, { prefix: 'Shorts',    priceRange: [1500,  7000]   }],
  'womens-clothing':[{ prefix: 'Dress',     priceRange: [3000,   20000]  }, { prefix: 'Scarf',    priceRange: [1000,  6000]   }, { prefix: 'Blouse',    priceRange: [2000,  12000]  }],
  'kids-clothing':[{ prefix: 'Kids T-Shirt',priceRange: [800,    4000]   }, { prefix: 'Kids Pants',priceRange: [1000, 5000]   }, { prefix: 'Kids Jacket',priceRange: [2000, 10000]  }],
  fiction:        [{ prefix: 'Novel',       priceRange: [800,    3000]   }, { prefix: 'Short Stories',priceRange: [600,2500]  }, { prefix: 'Fantasy Book',priceRange: [900, 3500]   }],
  'non-fiction':  [{ prefix: 'Biography',   priceRange: [900,    3500]   }, { prefix: 'History Book',priceRange: [1000,4000]  }, { prefix: 'Self-Help Book',priceRange: [700,2800]  }],
  'technical-books':[{ prefix: 'Textbook',  priceRange: [3000,   12000]  }, { prefix: 'Guide',    priceRange: [2000,  8000]   }, { prefix: 'Manual',    priceRange: [1500,  6000]   }],
  furniture:      [{ prefix: 'Chair',       priceRange: [10000,  80000]  }, { prefix: 'Desk Lamp',priceRange: [2000,  12000]  }, { prefix: 'Shelf',     priceRange: [5000,  30000]  }],
  kitchen:        [{ prefix: 'Cookware Set',priceRange: [5000,   30000]  }, { prefix: 'Coffee Maker',priceRange: [4000,25000] }, { prefix: 'Blender',   priceRange: [3000,  18000]  }],
  running:        [{ prefix: 'Running Shoes',priceRange: [5000,  25000]  }, { prefix: 'Yoga Mat', priceRange: [1500,  8000]   }, { prefix: 'Water Bottle',priceRange: [500,  3000]   }],
  cycling:        [{ prefix: 'Bicycle',     priceRange: [30000,  200000] }, { prefix: 'Helmet',   priceRange: [3000,  15000]  }, { prefix: 'Cycling Gloves',priceRange: [500,4000]   }],
  camping:        [{ prefix: 'Tent',        priceRange: [8000,   60000]  }, { prefix: 'Backpack', priceRange: [4000,  20000]  }, { prefix: 'Sleeping Bag',priceRange: [3000,20000]   }],
  garden:         [{ prefix: 'Garden Tool', priceRange: [1500,   10000]  }, { prefix: 'Planter',  priceRange: [1000,  6000]   }, { prefix: 'Garden Hose',priceRange: [2000, 8000]    }],
};

const BRANDS    = ['TechPro', 'StyleCo', 'ReadWorld', 'HomeEssentials', 'SportElite', 'PrimeBrand', 'AlphaTech', 'BetaWear'];
const COLORS    = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Grey', 'Pink'];
const MATERIALS = ['Cotton', 'Polyester', 'Leather', 'Aluminum', 'Steel', 'Wood', 'Plastic', 'Glass'];

// ── HTTP helpers ───────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function gql(token: string, query: string, variables?: Record<string, unknown>, retries = 5): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(ADMIN_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json() as any;
      if (json.errors) throw new Error(json.errors[0]?.message ?? JSON.stringify(json.errors));
      return json.data;
    } catch (err: any) {
      if (attempt === retries) throw err;
      const wait = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s, 8s, 16s
      console.error(`\n  [retry ${attempt + 1}/${retries}] ${err.message ?? err} — waiting ${wait}ms`);
      await sleep(wait);
    }
  }
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
  const data = await gql(token, `query {
    facets(options: { take: 100 }) {
      items { code values { id name } }
    }
  }`);
  const map: Record<string, Record<string, string>> = {};
  for (const facet of data.facets.items) {
    map[facet.code] = {};
    for (const fv of facet.values) map[facet.code][fv.name] = String(fv.id);
  }
  return map;
}

async function loadCollections(token: string): Promise<{ id: string; slug: string; name: string }[]> {
  const data = await gql(token, `query {
    collections(options: { take: 200 }) {
      items { id slug name }
    }
  }`);
  return data.collections.items.map((c: any) => ({ id: String(c.id), slug: c.slug, name: c.name }));
}

async function loadTaxCategoryId(token: string): Promise<string> {
  const data = await gql(token, `query { taxCategories(options: { take: 1 }) { items { id } } }`);
  const id = data.taxCategories.items[0]?.id;
  if (!id) throw new Error('No tax category found.');
  return String(id);
}

interface EditionOptions { groupId: string; standardId: string; proId: string; premiumId: string }

async function setupEditionOptionGroup(token: string): Promise<EditionOptions> {
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
      createProductOptionGroup(input: $input) { id options { id code } }
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

// ── Collection product count ────────────────────────────────────────────────────

async function getCollectionProductCount(token: string, collectionId: string): Promise<number> {
  const data = await gql(token, `query($id: ID!) {
    search(input: { collectionId: $id, take: 0, groupByProduct: true }) { totalItems }
  }`, { id: collectionId });
  return data.search.totalItems as number;
}

async function getCollectionProductIds(token: string, collectionId: string, total: number): Promise<string[]> {
  const ids: string[] = [];
  let skip = 0;
  const PAGE = 100;
  while (ids.length < total) {
    const data = await gql(token, `query($id: ID!, $skip: Int!) {
      search(input: { collectionId: $id, take: ${PAGE}, skip: $skip, groupByProduct: true }) {
        items { productId }
      }
    }`, { id: collectionId, skip });
    const batch = data.search.items.map((x: any) => String(x.productId));
    ids.push(...batch);
    skip += PAGE;
    if (batch.length < PAGE) break;
  }
  return ids;
}

// ── Product creation ───────────────────────────────────────────────────────────

async function createProduct(
  token: string,
  taxCategoryId: string,
  editions: EditionOptions,
  name: string,
  slug: string,
  description: string,
  facetValueIds: string[],
  basePrice: number,
): Promise<string | null> {
  let productId: string;
  try {
    const data = await gql(token, `
      mutation CreateProduct($input: CreateProductInput!) {
        createProduct(input: $input) { id }
      }`, {
      input: {
        enabled: true,
        facetValueIds,
        translations: [{ languageCode: 'en', name, slug, description }],
      },
    });
    productId = String(data.createProduct.id);
  } catch (err: any) {
    if (err.message?.includes('slug')) return null;
    throw err;
  }

  await gql(token, `
    mutation AddGroup($productId: ID!, $optionGroupId: ID!) {
      addOptionGroupToProduct(productId: $productId, optionGroupId: $optionGroupId) { id }
    }`, { productId, optionGroupId: editions.groupId });

  await gql(token, `
    mutation CreateVariants($input: [CreateProductVariantInput!]!) {
      createProductVariants(input: $input) { ... on ProductVariant { id } }
    }`, {
    input: [
      { productId, optionIds: [editions.standardId], sku: `${slug.toUpperCase()}-STD`, price: basePrice,                    taxCategoryId, facetValueIds, stockOnHand: 100, trackInventory: 'FALSE', translations: [{ languageCode: 'en', name: 'Standard' }] },
      { productId, optionIds: [editions.proId],      sku: `${slug.toUpperCase()}-PRO`, price: Math.round(basePrice * 1.4), taxCategoryId, facetValueIds, stockOnHand: 100, trackInventory: 'FALSE', translations: [{ languageCode: 'en', name: 'Pro' }] },
      { productId, optionIds: [editions.premiumId],  sku: `${slug.toUpperCase()}-PRM`, price: Math.round(basePrice * 2.0), taxCategoryId, facetValueIds, stockOnHand: 100, trackInventory: 'FALSE', translations: [{ languageCode: 'en', name: 'Premium' }] },
    ],
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

  console.log('Loading facets / collections / tax / option group...');
  const [facetMap, collections, taxCategoryId, editions] = await Promise.all([
    loadFacetValueMap(token),
    loadCollections(token),
    loadTaxCategoryId(token),
    setupEditionOptionGroup(token),
  ]);

  // Only process collections that have a template defined
  const targetCollections = collections.filter(c => TEMPLATES[c.slug]);

  console.log(`\nChecking product counts for ${targetCollections.length} collections...\n`);

  // Fetch counts in parallel
  const counts = await Promise.all(
    targetCollections.map(c => getCollectionProductCount(token, c.id).then(n => ({ ...c, count: n })))
  );

  // Report current state
  for (const c of counts) {
    const need = Math.max(0, TARGET - c.count);
    console.log(`  ${c.slug.padEnd(20)} ${String(c.count).padStart(4)} products  →  need ${need}`);
  }
  console.log();

  const toFill = counts.filter(c => c.count < TARGET);
  if (!toFill.length) {
    console.log('All collections already have ≥200 products. Nothing to do.');
    return;
  }

  // For each under-200 collection: build jobs, create products, update filter
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const col of toFill) {
    const need = TARGET - col.count;
    const templates = TEMPLATES[col.slug];
    console.log(`\n→ ${col.name} (${col.slug}): creating ${need} products...`);

    // Fetch existing product IDs once so we can merge them into the filter
    const existingIds = await getCollectionProductIds(token, col.id, col.count);

    const newIds: string[] = [];
    let idx = 0;

    for (let batch = 0; batch < need; batch += CONCURRENCY) {
      const batchSize = Math.min(CONCURRENCY, need - batch);
      const results = await Promise.all(
        Array.from({ length: batchSize }, async (_, bi) => {
          const i = batch + bi;
          const tmpl = templates[i % templates.length];
          const brand    = BRANDS[idx % BRANDS.length];
          const color    = COLORS[idx % COLORS.length];
          const material = MATERIALS[idx % MATERIALS.length];
          idx++;

          const slug = `z-${tmpl.prefix.toLowerCase().replace(/[\s/]+/g, '-')}-${col.slug}-${i + 1}`;
          const basePrice = tmpl.priceRange[0] + Math.floor(Math.random() * (tmpl.priceRange[1] - tmpl.priceRange[0]));

          const facetValueIds = [
            facetMap['brand']?.[brand],
            facetMap['color']?.[color],
            facetMap['material']?.[material],
          ].filter(Boolean) as string[];

          const productId = await createProduct(
            token, taxCategoryId, editions,
            `${brand} ${tmpl.prefix} Z${i + 1}`,
            slug,
            `Premium ${tmpl.prefix.toLowerCase()} by ${brand}. Made from ${material}, available in ${color}.`,
            facetValueIds,
            basePrice,
          );

          return productId;
        })
      );

      for (const id of results) {
        if (id) { newIds.push(id); totalCreated++; }
        else     { totalSkipped++; }
      }
      process.stdout.write(`\r  ${newIds.length + totalSkipped < need ? newIds.length + totalSkipped : need}/${need}`);
      await sleep(200); // let the backend breathe between batches
    }

    // Merge existing + new IDs and assign collection filter
    const allIds = [...new Set([...existingIds, ...newIds])];
    await assignCollectionFilter(token, col.id, allIds);
    console.log(`\r  ✓ ${newIds.length} created, filter updated (${allIds.length} total)`);
  }

  console.log(`\n\nDone!`);
  console.log(`  Total created: ${totalCreated} products × 3 variants`);
  console.log(`  Total skipped: ${totalSkipped} (duplicate slugs)`);

  if (process.env.SKIP_WORKER === 'true') {
    console.log(`\nSKIP_WORKER mode: triggering full search reindex...`);
    console.log(`(This requires the backend to be restarted with SKIP_WORKER unset first)`);
    console.log(`Run: pnpm dev  then  pnpm reindex`);
  } else {
    console.log(`\nTriggering search reindex...`);
    await gql(token, `mutation { reindex { id } }`);
    console.log(`Reindex job queued — search will update as the worker processes it.`);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
