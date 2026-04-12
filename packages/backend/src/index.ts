import 'dotenv/config';
import { bootstrap, bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config';

async function main() {
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
