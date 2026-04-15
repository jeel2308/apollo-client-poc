import { useState, useEffect, useTransition } from 'react';
import { graphql, useLazyLoadQuery, useMutation } from 'react-relay';
import { Link } from 'react-router-dom';

const ActiveCustomerQuery = graphql`
  query AccountPageQuery {
    activeCustomer {
      id firstName lastName emailAddress phoneNumber
      addresses {
        id fullName streetLine1 streetLine2
        city province postalCode
        country { id name code }
        defaultShippingAddress defaultBillingAddress
      }
    }
  }
`;

const LoginMutation = graphql`
  mutation AccountPageLoginMutation($username: String!, $password: String!, $rememberMe: Boolean) {
    login(username: $username, password: $password, rememberMe: $rememberMe) {
      ... on CurrentUser { id identifier }
      ... on ErrorResult { errorCode message }
    }
  }
`;

const RegisterMutation = graphql`
  mutation AccountPageRegisterMutation($input: RegisterCustomerInput!) {
    registerCustomerAccount(input: $input) {
      ... on Success { success }
      ... on ErrorResult { errorCode message }
    }
  }
`;

const LogoutMutation = graphql`
  mutation AccountPageLogoutMutation {
    logout { success }
  }
`;

// Inner component that runs the query and can be re-fetched via fetchKey.
function AccountInner({ fetchKey }: { fetchKey: number }) {
  const data = useLazyLoadQuery(
    ActiveCustomerQuery,
    {},
    { fetchKey, fetchPolicy: 'network-only' },
  ) as any;

  const [login, loggingIn] = useMutation(LoginMutation);
  const [register, registering] = useMutation(RegisterMutation);
  const [logout] = useMutation(LogoutMutation);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [, startTransition] = useTransition();

  function refetch() {
    // No direct refetch in Relay — parent increments fetchKey which re-renders this component.
    // We use a callback to bubble the refetch trigger up.
    window.dispatchEvent(new Event('account-refresh'));
  }

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    login({
      variables: { username: email, password, rememberMe: true },
      onCompleted(res: any) {
        if (res.login.__typename === 'CurrentUser') {
          refetch();
        } else {
          setError(res.login?.message ?? 'Login failed');
        }
      },
    });
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setSuccess('');
    const form = e.currentTarget;
    const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
    register({
      variables: {
        input: {
          emailAddress: get('email'),
          password: get('password'),
          firstName: get('firstName'),
          lastName: get('lastName'),
        },
      },
      onCompleted(res: any) {
        if (res.registerCustomerAccount.__typename === 'Success') {
          setSuccess('Registration successful! Please check your email to verify your account.');
        } else {
          setError(res.registerCustomerAccount?.message ?? 'Registration failed');
        }
      },
    });
  }

  function handleLogout() {
    logout({ onCompleted: refetch });
  }

  const customer = data?.activeCustomer;

  if (customer) {
    return (
      <div>
        <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>My Account</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Profile</h2>
            <p><strong>{customer.firstName} {customer.lastName}</strong></p>
            <p style={{ color: '#6b7280' }}>{customer.emailAddress}</p>
            {customer.phoneNumber && <p style={{ color: '#6b7280' }}>{customer.phoneNumber}</p>}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <Link to="/account/orders" style={{ color: '#e94560', textDecoration: 'none', fontSize: '0.875rem' }}>View Orders →</Link>
              <button onClick={handleLogout} style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Sign Out</button>
            </div>
          </div>

          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Saved Addresses</h2>
            {customer.addresses.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No saved addresses.</p>
            ) : customer.addresses.map((addr: any) => (
              <div key={addr.id} style={{ marginBottom: '1rem', fontSize: '0.875rem', padding: '0.75rem', background: '#fff', borderRadius: 4, border: '1px solid #e5e7eb' }}>
                <div style={{ fontWeight: 500 }}>{addr.fullName}</div>
                <div style={{ color: '#6b7280' }}>{addr.streetLine1}</div>
                {addr.streetLine2 && <div style={{ color: '#6b7280' }}>{addr.streetLine2}</div>}
                <div style={{ color: '#6b7280' }}>{addr.city}, {addr.province} {addr.postalCode}</div>
                <div style={{ color: '#6b7280' }}>{addr.country.name}</div>
                <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.5rem' }}>
                  {addr.defaultShippingAddress && <span style={{ fontSize: '0.7rem', background: '#dbeafe', color: '#1e40af', padding: '0.1rem 0.3rem', borderRadius: 3 }}>Default Shipping</span>}
                  {addr.defaultBillingAddress && <span style={{ fontSize: '0.7rem', background: '#d1fae5', color: '#065f46', padding: '0.1rem 0.3rem', borderRadius: 3 }}>Default Billing</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <div style={{ display: 'flex', gap: '0', marginBottom: '2rem', border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
        {(['login', 'register'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '0.75rem', border: 'none', cursor: 'pointer', background: mode === m ? '#1a1a2e' : '#fff', color: mode === m ? '#fff' : '#374151', fontWeight: mode === m ? 600 : 400, textTransform: 'capitalize' }}>
            {m === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        ))}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '0.75rem', marginBottom: '1rem', color: '#dc2626', fontSize: '0.875rem' }}>{error}</div>}
      {success && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, padding: '0.75rem', marginBottom: '1rem', color: '#16a34a', fontSize: '0.875rem' }}>{success}</div>}

      {mode === 'login' ? (
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Email</label>
            <input name="email" type="email" required style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>Password</label>
            <input name="password" type="password" required style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={loggingIn} style={{ width: '100%', padding: '0.75rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
            {loggingIn ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRegister}>
          {[
            { name: 'firstName', label: 'First Name', required: true },
            { name: 'lastName', label: 'Last Name', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true },
          ].map(field => (
            <div key={field.name} style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem', fontWeight: 500 }}>{field.label}</label>
              <input name={field.name} type={field.type ?? 'text'} required={field.required} style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box' }} />
            </div>
          ))}
          <button type="submit" disabled={registering} style={{ width: '100%', padding: '0.75rem', background: '#e94560', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, marginTop: '0.5rem' }}>
            {registering ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
      )}
    </div>
  );
}

// Outer shell manages the fetchKey that forces AccountInner to re-query after login/logout.
export function AccountPage() {
  const [fetchKey, setFetchKey] = useState(0);

  // AccountInner fires window event 'account-refresh'; we listen and increment fetchKey
  // which causes AccountInner to re-query (via fetchKey prop → new useLazyLoadQuery call).
  useEffect(() => {
    const handler = () => setFetchKey(k => k + 1);
    window.addEventListener('account-refresh', handler);
    return () => window.removeEventListener('account-refresh', handler);
  }, []);

  return (
    <AccountInner fetchKey={fetchKey} />
  );
}
