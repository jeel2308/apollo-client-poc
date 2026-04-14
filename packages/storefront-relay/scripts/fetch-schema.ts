/**
 * fetch-schema.ts — Downloads the Vendure Shop API GraphQL schema as an
 * introspection JSON file that relay-compiler can read directly.
 *
 * Run once before `pnpm relay`, or whenever the backend schema changes:
 *   pnpm fetch-schema
 *
 * The backend must be running at VITE_VENDURE_SHOP_API_URL (or localhost:3000).
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOP_API_URL = process.env.VITE_VENDURE_SHOP_API_URL ?? 'http://localhost:3000/shop-api';

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types { ...FullType }
      directives {
        name description locations
        args { ...InputValue }
      }
    }
  }
  fragment FullType on __Type {
    kind name description
    fields(includeDeprecated: true) {
      name description
      args { ...InputValue }
      type { ...TypeRef }
      isDeprecated deprecationReason
    }
    inputFields { ...InputValue }
    interfaces { ...TypeRef }
    enumValues(includeDeprecated: true) { name description isDeprecated deprecationReason }
    possibleTypes { ...TypeRef }
  }
  fragment InputValue on __InputValue {
    name description
    type { ...TypeRef }
    defaultValue
  }
  fragment TypeRef on __Type {
    kind name
    ofType { kind name ofType { kind name ofType { kind name
      ofType { kind name ofType { kind name ofType { kind name
        ofType { kind name } } } } } } }
  }
`;

async function main() {
  console.log(`Fetching schema from ${SHOP_API_URL} ...`);

  const res = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: introspectionQuery }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const body = await res.json() as { data: unknown; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);

  // relay-compiler accepts the raw introspection result wrapped in { data: ... }
  const outPath = resolve(__dirname, '..', 'schema.graphql.json');
  writeFileSync(outPath, JSON.stringify(body, null, 2));
  console.log(`Schema written to ${outPath}`);
  console.log('Run `pnpm relay` to compile fragments.');
}

main().catch(err => { console.error(err); process.exit(1); });
