import 'dotenv/config';
import { bootstrap, bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config';

async function main() {
  if (process.env.SKIP_WORKER === 'true') {
    // Start HTTP server only — job queue not processed. Use during bulk seeding
    // to avoid search-index writes slowing down product creation. After seeding,
    // restart normally and run the reindex mutation.
    await bootstrap(config);
    return;
  }
  const [_app, worker] = await Promise.all([
    bootstrap(config),
    bootstrapWorker(config),
  ]);
  // Must call startJobQueue() explicitly — without it jobs stay PENDING forever.
  await worker.startJobQueue();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
