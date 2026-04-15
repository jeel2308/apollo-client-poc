/**
 * fetch-schema.ts — Downloads the Vendure Shop API schema and writes it as SDL
 * to schema.graphql, which relay-compiler reads.
 *
 * Run once before `pnpm relay`, or whenever the backend schema changes:
 *   pnpm fetch-schema
 *
 * The backend must be running at VITE_VENDURE_SHOP_API_URL (default: localhost:3000).
 */
import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildClientSchema, printSchema, getIntrospectionQuery } from 'graphql';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOP_API_URL = process.env.VITE_VENDURE_SHOP_API_URL ?? 'http://localhost:3000/shop-api';

async function main() {
  console.log(`Fetching schema from ${SHOP_API_URL} ...`);

  const res = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: getIntrospectionQuery() }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const body = await res.json() as { data: any; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);

  // Convert introspection result to SDL — relay-compiler reads .graphql SDL files.
  const schema = buildClientSchema(body.data);
  const sdl = printSchema(schema);

  const outPath = resolve(__dirname, '..', 'schema.graphql');
  writeFileSync(outPath, sdl);
  console.log(`Schema written to ${outPath} (${sdl.split('\n').length} lines)`);
  console.log('Run `pnpm relay` to compile fragments.');
}

main().catch(err => { console.error(err); process.exit(1); });
