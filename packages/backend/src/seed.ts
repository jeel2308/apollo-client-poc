/**
 * Seed script: populates Vendure with realistic e-commerce data.
 *
 * Run: pnpm --filter backend seed
 *
 * Creates:
 * - 5 top-level collections (Electronics, Clothing, Books, Home, Sports)
 * - 4 facets with values (Brand, Color, Size, Material)
 * - 200+ products with variants, assets, prices
 * - Shipping methods
 * - Tax categories and rates
 *
 * Products are designed to exercise Apollo cache for types WITHOUT id fields:
 *   PriceRange, SinglePrice, TaxLine, OrderAddress, ShippingLine, Adjustment
 */

import 'dotenv/config';
import {
  bootstrap,
  ChannelService,
  CollectionService,
  FacetService,
  FacetValueService,
  ProductService,
  ProductVariantService,
  ShippingMethodService,
  TaxCategoryService,
  TaxRateService,
  ZoneService,
  RequestContextService,
  LanguageCode,
  Permission,
  isGraphQlErrorResult,
  defaultShippingCalculator,
  defaultShippingEligibilityChecker,
} from '@vendure/core';
import { config } from './vendure-config';

const COLLECTIONS = [
  { name: 'Electronics', slug: 'electronics', description: 'Latest gadgets and electronics' },
  { name: 'Clothing', slug: 'clothing', description: 'Fashion for all seasons' },
  { name: 'Books', slug: 'books', description: 'Fiction, non-fiction, and more' },
  { name: 'Home & Garden', slug: 'home-garden', description: 'Everything for your home' },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors', description: 'Gear for the active lifestyle' },
];

const SUB_COLLECTIONS: Record<string, { name: string; slug: string }[]> = {
  electronics: [
    { name: 'Laptops', slug: 'laptops' },
    { name: 'Smartphones', slug: 'smartphones' },
    { name: 'Audio', slug: 'audio' },
    { name: 'Cameras', slug: 'cameras' },
  ],
  clothing: [
    { name: "Men's Clothing", slug: 'mens-clothing' },
    { name: "Women's Clothing", slug: 'womens-clothing' },
    { name: 'Kids', slug: 'kids-clothing' },
  ],
  books: [
    { name: 'Fiction', slug: 'fiction' },
    { name: 'Non-Fiction', slug: 'non-fiction' },
    { name: 'Technical', slug: 'technical-books' },
  ],
  'home-garden': [
    { name: 'Furniture', slug: 'furniture' },
    { name: 'Kitchen', slug: 'kitchen' },
    { name: 'Garden', slug: 'garden' },
  ],
  'sports-outdoors': [
    { name: 'Running', slug: 'running' },
    { name: 'Cycling', slug: 'cycling' },
    { name: 'Camping', slug: 'camping' },
  ],
};

const BRANDS = ['TechPro', 'StyleCo', 'ReadWorld', 'HomeEssentials', 'SportElite', 'PrimeBrand', 'AlphaTech', 'BetaWear'];
const COLORS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange', 'Grey', 'Pink'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '128GB', '256GB', '512GB', '1TB'];
const MATERIALS = ['Cotton', 'Polyester', 'Leather', 'Aluminum', 'Steel', 'Wood', 'Plastic', 'Glass'];

type ProductTemplate = {
  name: string;
  slug: string;
  description: string;
  collectionSlug: string;
  variants: { name: string; sku: string; price: number }[];
  facetValues: { facet: string; value: string }[];
};

function generateProducts(): ProductTemplate[] {
  const products: ProductTemplate[] = [];

  const templates = [
    // Electronics
    { prefix: 'Laptop', collection: 'laptops', priceRange: [80000, 300000] },
    { prefix: 'Smartphone', collection: 'smartphones', priceRange: [30000, 150000] },
    { prefix: 'Headphones', collection: 'audio', priceRange: [5000, 50000] },
    { prefix: 'Camera', collection: 'cameras', priceRange: [40000, 200000] },
    // Clothing
    { prefix: 'T-Shirt', collection: 'mens-clothing', priceRange: [1500, 8000] },
    { prefix: 'Dress', collection: 'womens-clothing', priceRange: [3000, 20000] },
    { prefix: 'Jacket', collection: 'mens-clothing', priceRange: [8000, 40000] },
    // Books
    { prefix: 'Novel', collection: 'fiction', priceRange: [800, 3000] },
    { prefix: 'Guide', collection: 'technical-books', priceRange: [2000, 8000] },
    // Home
    { prefix: 'Chair', collection: 'furniture', priceRange: [10000, 80000] },
    { prefix: 'Cookware Set', collection: 'kitchen', priceRange: [5000, 30000] },
    // Sports
    { prefix: 'Running Shoes', collection: 'running', priceRange: [5000, 25000] },
    { prefix: 'Bicycle', collection: 'cycling', priceRange: [30000, 200000] },
  ];

  let productIndex = 0;
  for (const template of templates) {
    for (let i = 1; i <= 16; i++) {
      const brand = BRANDS[productIndex % BRANDS.length];
      const color = COLORS[productIndex % COLORS.length];
      const material = MATERIALS[productIndex % MATERIALS.length];
      const slug = `${template.prefix.toLowerCase().replace(/\s+/g, '-')}-${brand.toLowerCase()}-${i}`;
      const basePrice = template.priceRange[0] + Math.floor(Math.random() * (template.priceRange[1] - template.priceRange[0]));

      // Single variant per product — option groups aren't set up so multi-variant
      // would trigger a duplicate-options error. The benchmark cares about volume
      // of products/cache entries, not variant depth.
      const variants = [{ name: 'Default', sku: `${slug.toUpperCase()}-DEFAULT`, price: basePrice }];

      products.push({
        name: `${brand} ${template.prefix} ${i}`,
        slug,
        description: `High quality ${template.prefix.toLowerCase()} by ${brand}. Made from ${material}. Available in ${color}. Perfect for everyday use. Features premium construction and long-lasting durability. Backed by a 1-year warranty.`,
        collectionSlug: template.collection,
        variants,
        facetValues: [
          { facet: 'brand', value: brand },
          { facet: 'color', value: color },
          { facet: 'material', value: material },
        ],
      });
      productIndex++;
    }
  }

  return products;
}

async function runSeed() {
  const app = await bootstrap(config);

  const requestContextService = app.get(RequestContextService);
  const ctx = await requestContextService.create({
    apiType: 'admin',
    channelOrToken: 'default-channel',
  });

  const channelService = app.get(ChannelService);
  const channel = await channelService.getDefaultChannel(ctx);

  console.log('Creating zone...');
  const zoneService = app.get(ZoneService);
  const zone = await zoneService.create(ctx, { name: 'Global' });

  // Assign as default tax/shipping zone so product variant prices can be resolved
  await channelService.update(ctx, {
    id: channel.id,
    defaultTaxZoneId: zone.id,
    defaultShippingZoneId: zone.id,
  });

  // Recreate context so it picks up the updated channel (with zone assigned)
  const ctx2 = await requestContextService.create({
    apiType: 'admin',
    channelOrToken: 'default-channel',
  });

  console.log('Creating tax category...');
  const taxCategoryService = app.get(TaxCategoryService);
  const taxCategory = await taxCategoryService.create(ctx2, {
    name: 'Standard Tax',
    isDefault: true,
  });

  const taxRateService = app.get(TaxRateService);
  await taxRateService.create(ctx2, {
    name: 'Standard Tax Rate',
    enabled: true,
    value: 20,
    categoryId: taxCategory.id,
    zoneId: zone.id,
  });

  console.log('Creating facets...');
  const facetService = app.get(FacetService);
  const facetValueService = app.get(FacetValueService);

  const facetMap: Record<string, Record<string, string>> = {};

  const facetDefs = [
    { code: 'brand', name: 'Brand', values: BRANDS },
    { code: 'color', name: 'Color', values: COLORS },
    { code: 'material', name: 'Material', values: MATERIALS },
  ];

  for (const def of facetDefs) {
    const facet = await facetService.create(ctx2, {
      isPrivate: false,
      code: def.code,
      translations: [{ languageCode: LanguageCode.en, name: def.name }],
    });
    facetMap[def.code] = {};
    for (const value of def.values) {
      const fv = await facetValueService.create(ctx2, facet, {
        facetId: facet.id,
        code: value.toLowerCase().replace(/\s+/g, '-'),
        translations: [{ languageCode: LanguageCode.en, name: value }],
      });
      facetMap[def.code][value] = String(fv.id);
    }
  }

  console.log('Creating collections...');
  const collectionService = app.get(CollectionService);
  const collectionIdMap: Record<string, string> = {};

  for (const col of COLLECTIONS) {
    const created = await collectionService.create(ctx2, {
      isPrivate: false,
      translations: [{ languageCode: LanguageCode.en, name: col.name, slug: col.slug, description: col.description }],
      filters: [],
    });
    collectionIdMap[col.slug] = String(created.id);

    const subs = SUB_COLLECTIONS[col.slug] ?? [];
    for (const sub of subs) {
      const subCreated = await collectionService.create(ctx2, {
        parentId: created.id,
        isPrivate: false,
        translations: [{ languageCode: LanguageCode.en, name: sub.name, slug: sub.slug, description: '' }],
        filters: [],
      });
      collectionIdMap[sub.slug] = String(subCreated.id);
    }
  }

  console.log('Creating shipping methods...');
  const shippingMethodService = app.get(ShippingMethodService);
  await shippingMethodService.create(ctx2, {
    code: 'standard-shipping',
    checker: {
      code: defaultShippingEligibilityChecker.code,
      arguments: [{ name: 'orderMinimum', value: '0' }],
    },
    calculator: {
      code: defaultShippingCalculator.code,
      arguments: [
        { name: 'rate', value: '500' },
        { name: 'taxRate', value: '0' },
        { name: 'includesTax', value: 'exclude' },
      ],
    },
    fulfillmentHandler: 'manual-fulfillment',
    translations: [{ languageCode: LanguageCode.en, name: 'Standard Shipping', description: '5-7 business days' }],
  });
  await shippingMethodService.create(ctx2, {
    code: 'express-shipping',
    checker: {
      code: defaultShippingEligibilityChecker.code,
      arguments: [{ name: 'orderMinimum', value: '0' }],
    },
    calculator: {
      code: defaultShippingCalculator.code,
      arguments: [
        { name: 'rate', value: '1500' },
        { name: 'taxRate', value: '0' },
        { name: 'includesTax', value: 'exclude' },
      ],
    },
    fulfillmentHandler: 'manual-fulfillment',
    translations: [{ languageCode: LanguageCode.en, name: 'Express Shipping', description: '1-2 business days' }],
  });

  console.log('Creating products...');
  const productService = app.get(ProductService);
  const productVariantService = app.get(ProductVariantService);
  const products = generateProducts();

  // Track product IDs per collection for filter assignment
  const collectionProductIds: Record<string, string[]> = {};

  for (const p of products) {
    const facetValueIds = p.facetValues
      .map(fv => facetMap[fv.facet]?.[fv.value])
      .filter(Boolean)
      .map(id => id as string);

    const product = await productService.create(ctx2, {
      enabled: true,
      facetValueIds,
      translations: [
        {
          languageCode: LanguageCode.en,
          name: p.name,
          slug: p.slug,
          description: p.description,
        },
      ],
    });

    await productVariantService.create(
      ctx2,
      p.variants.map(v => ({
        productId: product.id,
        sku: v.sku,
        price: v.price,
        taxCategoryId: taxCategory.id,
        facetValueIds,
        stockOnHand: 100,
        trackInventory: false as any,
        translations: [{ languageCode: LanguageCode.en, name: v.name }],
      })),
    );

    const collectionId = collectionIdMap[p.collectionSlug];
    if (collectionId) {
      if (!collectionProductIds[collectionId]) collectionProductIds[collectionId] = [];
      collectionProductIds[collectionId].push(String(product.id));
    }
  }

  // Use the Admin GraphQL API via HTTP to update collection filters.
  // The CollectionService.update() service method triggers a TypeORM
  // closure-table re-insert that loses the position column.
  console.log('Assigning products to collections via Admin API...');
  const ADMIN_TOKEN = Buffer.from('superadmin:superadmin123').toString('base64');

  // Authenticate to get a bearer token
  const authRes = await fetch('http://localhost:3000/admin-api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation { login(username: "superadmin", password: "superadmin123") { ... on CurrentUser { id identifier } ... on InvalidCredentialsError { message } } }`,
    }),
  });
  const authJson = await authRes.json() as any;
  const bearerToken = authRes.headers.get('vendure-auth-token') ?? '';

  for (const [collectionId, productIds] of Object.entries(collectionProductIds)) {
    const res = await fetch('http://localhost:3000/admin-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${bearerToken}`,
      },
      body: JSON.stringify({
        query: `mutation UpdateCollectionFilters($id: ID!, $productIds: String!) {
          updateCollection(input: {
            id: $id
            filters: [{ code: "product-id-filter", arguments: [{ name: "productIds", value: $productIds }, { name: "combineWithAnd", value: "false" }] }]
          }) { id name }
        }`,
        variables: {
          id: collectionId,
          productIds: JSON.stringify(productIds),
        },
      }),
    });
    const json = await res.json() as any;
    if (json.errors) {
      console.warn(`  Warning: collection ${collectionId}:`, json.errors[0]?.message);
    }
  }

  console.log(`Seeded ${products.length} products successfully.`);
  await app.close();
  process.exit(0);
}

runSeed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
