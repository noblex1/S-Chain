import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import PasswordInput from '../components/PasswordInput.jsx';

export default function BootstrapAdminPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/bootstrap-admin', { name, email, password });
      localStorage.setItem('s-chain-auth', JSON.stringify({ token: data.token, user: data.user }));
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-950 text-white">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8">
        <h1 className="font-display text-2xl font-bold">Bootstrap admin</h1>
        <p className="text-sm text-slate-400 mt-2">
          Use once when the database has no admin user. After that this endpoint returns 403.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && <div className="rounded-lg bg-red-950 text-red-200 text-sm px-3 py-2">{error}</div>}
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <PasswordInput
            wrapperClassName=""
            className="!border-slate-700 !bg-slate-950 text-white placeholder:text-slate-500"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-500 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create admin'}
          </button>
        </form>
        <Link to="/login" className="mt-6 block text-center text-sm text-brand-300 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
