import { VendureConfig } from '@vendure/core';
import { DefaultJobQueuePlugin } from '@vendure/core';
import { DefaultSearchPlugin } from '@vendure/core';
import { AssetServerPlugin } from '@vendure/asset-server-plugin';
import { AdminUiPlugin } from '@vendure/admin-ui-plugin';
import path from 'path';

const IS_DEV = process.env.APP_ENV === 'development';
const DB_TYPE = (process.env.DB_TYPE as any) ?? 'better-sqlite3';

function getDbConfig() {
  if (DB_TYPE === 'postgres') {
    return {
      type: 'postgres' as const,
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432'),
      database: process.env.DB_NAME ?? 'vendure',
      username: process.env.DB_USERNAME ?? 'postgres',
      password: process.env.DB_PASSWORD ?? '',
      synchronize: true,
    };
  }
  return {
    type: 'better-sqlite3' as const,
    database: path.join(__dirname, '../vendure.sqlite'),
    synchronize: true,
  };
}

const SIMULATED_LATENCY_MS = parseInt(process.env.SIMULATED_LATENCY_MS ?? '600');

export const config: VendureConfig = {
  apiOptions: {
    port: parseInt(process.env.PORT ?? '3000'),
    adminApiPath: 'admin-api',
    shopApiPath: 'shop-api',
    cors: {
      origin: true,
      credentials: true,
    },
    ...(IS_DEV ? { adminApiPlayground: true, shopApiPlayground: true } : {}),
    middleware: [
      {
        // Simulate network latency on the shop API only (not admin/assets)
        route: '/shop-api',
        handler: (_req: any, _res: any, next: any) => {
          setTimeout(next, SIMULATED_LATENCY_MS);
        },
      },
    ],
  },
  authOptions: {
    tokenMethod: ['bearer', 'cookie'],
    superadminCredentials: {
      identifier: process.env.SUPERADMIN_USERNAME ?? 'superadmin',
      password: process.env.SUPERADMIN_PASSWORD ?? 'superadmin123',
    },
    cookieOptions: {
      secret: process.env.COOKIE_SECRET ?? 'change-me',
    },
  },
  dbConnectionOptions: {
    ...getDbConfig(),
    logging: false,
    migrations: [],
  },
  paymentOptions: {
    paymentMethodHandlers: [],
  },
  plugins: [
    AssetServerPlugin.init({
      route: 'assets',
      assetUploadDir: path.join(__dirname, '../static/assets'),
    }),
    DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
    DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
    AdminUiPlugin.init({
      route: 'admin',
      port: parseInt(process.env.PORT ?? '3000'),
    }),
  ],
};
