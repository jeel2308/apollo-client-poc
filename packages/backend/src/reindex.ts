/**
 * reindex.ts — triggers a full Vendure search index rebuild.
 *
 * Run after bulk seeding with SKIP_WORKER=true to rebuild the search index.
 * The backend must be running normally (with worker) before running this.
 *
 *   pnpm reindex
 */
import 'dotenv/config';

const ADMIN_API = process.env.VENDURE_ADMIN_API_URL ?? 'http://localhost:3000/admin-api';

async function gql(token: string, query: string): Promise<any> {
  const res = await fetch(ADMIN_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
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

async function run() {
  console.log('Authenticating...');
  const token = await getAuthToken();
  console.log('Triggering full search reindex...');
  const data = await gql(token, `mutation { reindex { id state progress } }`);
  console.log(`Reindex job queued (id: ${data.reindex.id}) — the worker will rebuild the index.`);
  console.log('Watch the backend logs for progress. Search will work once the job completes.');
}

run().catch(err => { console.error(err); process.exit(1); });
