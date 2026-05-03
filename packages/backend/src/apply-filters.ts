/**
 * apply-filters.ts — re-triggers apply-collection-filters for all sub-collections.
 *
 * Use when products were created with SKIP_WORKER=true and the collection-product
 * join table is stale. This fetches each collection's current filters and re-saves
 * them, causing Vendure to queue apply-collection-filters jobs.
 *
 *   pnpm apply-filters
 */
import 'dotenv/config';

const ADMIN_API = process.env.VENDURE_ADMIN_API_URL ?? 'http://localhost:3000/admin-api';

async function gql(token: string, query: string, variables?: Record<string, unknown>): Promise<any> {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      }}`,
    }),
  });
  const token = res.headers.get('vendure-auth-token') ?? '';
  if (!token) throw new Error('Login failed');
  return token;
}

async function run() {
  console.log('Authenticating...');
  const token = await getAuthToken();

  // Fetch all non-root collections with their current filters
  const data = await gql(token, `{
    collections(options: { take: 100 }) {
      items {
        id slug
        filters { code args { name value } }
      }
    }
  }`);

  const collections = data.collections.items.filter((c: any) =>
    !['electronics', 'clothing', 'books', 'home-garden'].includes(c.slug)
  );

  console.log(`Re-applying filters for ${collections.length} sub-collections...`);

  for (const col of collections) {
    process.stdout.write(`  ${col.slug}...`);
    await gql(token, `
      mutation UpdateCollection($id: ID!, $filters: [ConfigurableOperationInput!]!) {
        updateCollection(input: { id: $id, filters: $filters }) { id }
      }`, {
      id: col.id,
      filters: col.filters.map((f: any) => ({
        code: f.code,
        arguments: f.args.map((a: any) => ({ name: a.name, value: a.value })),
      })),
    });
    console.log(' queued');
  }

  console.log(`\nDone! ${collections.length} apply-collection-filters jobs queued.`);
  console.log('Watch the backend worker logs — it will process them in the background.');
}

run().catch(err => { console.error(err); process.exit(1); });
