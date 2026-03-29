import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { pushNotification } from '../components/NotificationHost.jsx';

const TABS = [
  { role: 'customer', label: 'Customers' },
  { role: 'logistics_manager', label: 'Logistics team' },
  { role: 'admin', label: 'Admins' },
];

const emptyCreate = { name: '', email: '', password: '', role: 'customer' };

export default function AdminUsersPage() {
  const { isAdmin, user: me } = useAuth();
  const [tab, setTab] = useState('customer');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [editUser, setEditUser] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', role: 'customer', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users?role=${tab}`);
      setUsers(data);
    } catch {
      setUsers([]);
      pushNotification({ type: 'info', message: 'Could not load users' });
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (u) => {
    setEditUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      password: '',
    });
  };

  const submitCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', createForm);
      pushNotification({ type: 'status', message: 'User created' });
      setCreateOpen(false);
      setCreateForm({ ...emptyCreate, role: tab === 'logistics_manager' ? 'logistics_manager' : tab });
      load();
    } catch (err) {
      pushNotification({
        type: 'info',
        message: err.response?.data?.message || 'Create failed',
      });
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
      };
      if (editForm.password.trim()) payload.password = editForm.password;
      await api.put(`/users/${editUser._id}`, payload);
      pushNotification({ type: 'status', message: 'User updated' });
      setEditUser(null);
      load();
    } catch (err) {
      pushNotification({
        type: 'info',
        message: err.response?.data?.message || 'Update failed',
      });
    }
  };

  const removeUser = async (u) => {
    if (!window.confirm(`Remove ${u.name} (${u.email})? This cannot be undone.`)) return;
    try {
      await api.delete(`/users/${u._id}`);
      pushNotification({ type: 'status', message: 'User removed' });
      load();
    } catch (err) {
      pushNotification({
        type: 'info',
        message: err.response?.data?.message || 'Delete failed',
      });
    }
  };

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Team & users</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create accounts, assign roles, and manage access for customers, logistics staff, and admins.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateForm({
              ...emptyCreate,
              role: tab === 'admin' ? 'admin' : tab === 'logistics_manager' ? 'logistics_manager' : 'customer',
            });
            setCreateOpen(true);
          }}
          className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
        >
          Add user
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        {TABS.map((t) => (
          <button
            key={t.role}
            type="button"
            onClick={() => setTab(t.role)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.role
                ? 'bg-brand-100 text-brand-900 dark:bg-brand-950 dark:text-brand-200'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium w-40">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No users in this group yet.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                      <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                        {u.role?.replace('_', ' ')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="text-brand-600 dark:text-brand-400 font-medium hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={String(u._id) === String(me?.id)}
                            onClick={() => removeUser(u)}
                            className="text-red-600 dark:text-red-400 font-medium hover:underline disabled:opacity-40 disabled:no-underline"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Add user</h3>
            <form onSubmit={submitCreate} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-500">Name</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Password</label>
                <PasswordInput
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                  minLength={6}
                  autoComplete="new-password"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Role</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="customer">Customer</option>
                  <option value="logistics_manager">Logistics manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg px-4 py-2 border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg px-4 py-2 bg-brand-600 text-white font-medium">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">Edit user</h3>
            <p className="text-xs text-slate-500 mt-1">{editUser.email}</p>
            <form onSubmit={submitEdit} className="mt-4 space-y-3 text-sm">
              <div>
                <label className="text-xs font-medium text-slate-500">Name</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  value={editForm.email}
                  onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Role</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="customer">Customer</option>
                  <option value="logistics_manager">Logistics manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">New password (optional)</label>
                <PasswordInput
                  value={editForm.password}
                  onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="rounded-lg px-4 py-2 border border-slate-200 dark:border-slate-700"
                >
                  Cancel
                </button>
                <button type="submit" className="rounded-lg px-4 py-2 bg-brand-600 text-white font-medium">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
