import type { CodegenConfig } from '@graphql-codegen/cli';

// codegen.ts — GraphQL Code Generator configuration for the Apollo storefront.
// Run with: pnpm codegen
// Output lands in src/gql/ and should be committed to version control so the app
// typechecks even when the backend is offline.
const config: CodegenConfig = {
  // Introspect the Vendure Shop API schema. Falls back to localhost when the env
  // var is not set (e.g. in CI without a running backend).
  schema: process.env.VITE_VENDURE_SHOP_API_URL ?? 'http://localhost:3000/shop-api',

  // Scan all TypeScript source files for gql`` tagged template literals and
  // graphql() calls — codegen picks up every operation and fragment automatically.
  documents: ['src/**/*.{ts,tsx}'],

  generates: {
    'src/gql/': {
      // The 'client' preset generates per-operation TypeScript types plus a
      // typed graphql() helper that ties document nodes to their result/variable types.
      preset: 'client',
      presetConfig: {
        // Fragment masking forces components to declare exactly what data they need.
        // This matches Relay discipline and makes the Relay replica straightforward to build.
        fragmentMasking: { unmaskFunctionName: 'getFragmentData' },
      },
      config: {
        // Use DocumentNode not string so Apollo can use it directly
        documentMode: 'documentNode',
        // Omit JSDoc blocks from generated files — reduces noise in the output.
        addDocBlocks: false,
        // Map Vendure's custom scalars to TypeScript primitives.
        scalars: {
          DateTime: 'string',                    // ISO-8601 date string from the API
          JSON: 'Record<string, unknown>',       // Arbitrary JSON blob
          Money: 'number',                       // Integer cents (Vendure stores money as ints)
          Upload: 'File',                        // Browser File object for asset uploads
        },
      },
    },
  },

  // Don't error when no documents are found — useful before any queries are written.
  ignoreNoDocuments: true,
};

export default config;
