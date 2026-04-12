/**
 * assign-images.ts
 *
 * Assigns a deterministic placeholder image to every product that has no
 * featuredAsset. Uses picsum.photos with the product slug as the random seed
 * so each product gets a consistent, unique image without requiring a DB reset.
 *
 * Run: pnpm --filter backend assign-images
 * (backend server must be running on localhost:3000)
 */

import 'dotenv/config';

const ADMIN_API = process.env.VITE_VENDURE_ADMIN_API_URL ?? 'http://localhost:3000/admin-api';
const IMAGE_SIZE = 600;
const PAGE_SIZE = 50;

async function getAuthToken(): Promise<string> {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation { login(username: "superadmin", password: "superadmin123") { ... on CurrentUser { id } ... on InvalidCredentialsError { message } } }`,
    }),
  });
  const token = res.headers.get('vendure-auth-token') ?? '';
  if (!token) throw new Error('Login failed — is the server running?');
  return token;
}

async function getAllProducts(token: string): Promise<{ id: string; slug: string; name: string; featuredAsset: { id: string } | null }[]> {
  const all: { id: string; slug: string; name: string; featuredAsset: { id: string } | null }[] = [];
  let skip = 0;
  while (true) {
    const res = await fetch(ADMIN_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        query: `query Products($skip: Int!) {
          products(options: { skip: $skip, take: ${PAGE_SIZE} }) {
            items { id slug name featuredAsset { id } }
            totalItems
          }
        }`,
        variables: { skip },
      }),
    });
    const json = (await res.json()) as any;
    const page = json.data?.products;
    if (!page) throw new Error(`Unexpected response: ${JSON.stringify(json)}`);
    all.push(...page.items);
    skip += PAGE_SIZE;
    if (all.length >= page.totalItems) break;
  }
  return all;
}

async function uploadImageForSlug(token: string, slug: string): Promise<string | null> {
  // Download placeholder image — deterministic per slug so the same product
  // always gets the same image across re-runs.
  const imageUrl = `https://picsum.photos/seed/${encodeURIComponent(slug)}/${IMAGE_SIZE}/${IMAGE_SIZE}`;
  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) {
    console.warn(`  Could not download image for ${slug}: HTTP ${imageRes.status}`);
    return null;
  }
  const imageBlob = await imageRes.blob();

  // GraphQL multipart upload spec (https://github.com/jaydenseric/graphql-multipart-request-spec)
  const operations = JSON.stringify({
    query: `mutation CreateAssets($input: [CreateAssetInput!]!) {
      createAssets(input: $input) {
        ... on Asset { id }
        ... on MimeTypeError { message }
      }
    }`,
    variables: { input: [{ file: null }] },
  });

  const form = new FormData();
  form.append('operations', operations);
  form.append('map', JSON.stringify({ '0': ['variables.input.0.file'] }));
  form.append('0', imageBlob, `${slug}.jpg`);

  const uploadRes = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const uploadJson = (await uploadRes.json()) as any;
  const created = uploadJson.data?.createAssets?.[0];
  if (created?.id) return String(created.id);
  console.warn(`  Asset upload failed for ${slug}:`, created?.message ?? uploadJson.errors);
  return null;
}

async function assignFeaturedAsset(token: string, productId: string, assetId: string): Promise<void> {
  await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      query: `mutation AssignAsset($id: ID!, $assetId: ID!) {
        updateProduct(input: { id: $id, featuredAssetId: $assetId }) { id }
      }`,
      variables: { id: productId, assetId },
    }),
  });
}

async function run() {
  console.log('Authenticating...');
  const token = await getAuthToken();

  console.log('Fetching products...');
  const products = await getAllProducts(token);
  const withoutImage = products.filter(p => !p.featuredAsset);
  console.log(`${products.length} products total, ${withoutImage.length} without images`);

  if (withoutImage.length === 0) {
    console.log('All products already have images.');
    return;
  }

  let success = 0;
  let done = 0;
  const CONCURRENCY = 10;

  async function processOne(p: (typeof withoutImage)[number]) {
    const assetId = await uploadImageForSlug(token, p.slug);
    if (assetId) {
      await assignFeaturedAsset(token, p.id, assetId);
      success++;
    }
    done++;
    process.stdout.write(`\r[${done}/${withoutImage.length}] ${p.name.padEnd(40)}`);
  }

  // Process in batches of CONCURRENCY to avoid overwhelming the server.
  for (let i = 0; i < withoutImage.length; i += CONCURRENCY) {
    await Promise.all(withoutImage.slice(i, i + CONCURRENCY).map(processOne));
  }

  console.log(`\n\nDone — assigned images to ${success}/${withoutImage.length} products.`);
  console.log('You may need to re-index search: trigger a reindex in the Vendure admin or restart the server.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
