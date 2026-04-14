import { Environment, Network, RecordSource, Store, FetchFunction } from 'relay-runtime';

const SHOP_API_URL = import.meta.env.VITE_VENDURE_SHOP_API_URL ?? 'http://localhost:3000/shop-api';

const fetchFn: FetchFunction = async (request, variables) => {
  const res = await fetch(SHOP_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // credentials: 'include' is required for Vendure's cookie-based session auth.
    // Without it, the browser won't send the session cookie and every request
    // will be treated as a new anonymous session.
    credentials: 'include',
    body: JSON.stringify({ query: request.text, variables }),
  });

  return res.json();
};

export const relayEnvironment = new Environment({
  network: Network.create(fetchFn),
  store: new Store(new RecordSource()),
});
