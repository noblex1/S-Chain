import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';

const PAGE = 50;

export default function AdminAuditPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE), skip: String(skip) });
      if (filterType) params.set('resourceType', filterType);
      if (filterAction) params.set('action', filterAction);
      const { data } = await api.get(`/audit?${params}`);
      setItems(data.items || []);
      setTotal(data.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [skip, filterType, filterAction]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setSkip(0);
  }, [filterType, filterAction]);

  if (!isAdmin) return <Navigate to="/" replace />;

  const hasMore = skip + items.length < total;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Audit log</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Record of shipment and user changes (who, when, what). GPS pings stay in tracking history only.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Resource</label>
          <select
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All</option>
            <option value="shipment">Shipments</option>
            <option value="user">Users</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Action</label>
          <select
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="">All</option>
            <option value="create">Create</option>
            <option value="update">Update</option>
            <option value="delete">Delete</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
                  <tr>
                    <th className="px-3 py-3 font-medium whitespace-nowrap">When</th>
                    <th className="px-3 py-3 font-medium">Actor</th>
                    <th className="px-3 py-3 font-medium">Action</th>
                    <th className="px-3 py-3 font-medium">Resource</th>
                    <th className="px-3 py-3 font-medium min-w-[200px]">Summary</th>
                    <th className="px-3 py-3 font-medium w-24">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No audit entries match.
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => (
                      <tr key={row._id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 align-top">
                        <td className="px-3 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400 text-xs">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900 dark:text-white">{row.actorName || '—'}</div>
                          <div className="text-xs text-slate-500">{row.actorEmail}</div>
                          <div className="text-xs text-slate-400 capitalize">{row.actorRole?.replace('_', ' ')}</div>
                        </td>
                        <td className="px-3 py-3 capitalize">{row.action}</td>
                        <td className="px-3 py-3">
                          <span className="capitalize">{row.resourceType}</span>
                          <div className="text-xs font-mono text-slate-500 truncate max-w-[120px]" title={row.resourceId}>
                            {row.resourceId}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{row.summary}</td>
                        <td className="px-3 py-3">
                          {row.details && Object.keys(row.details).length > 0 ? (
                            <button
                              type="button"
                              onClick={() => setExpanded((id) => (id === row._id ? null : row._id))}
                              className="text-brand-600 dark:text-brand-400 text-xs font-medium hover:underline"
                            >
                              {expanded === row._id ? 'Hide' : 'JSON'}
                            </button>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {expanded && (
              <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/80">
                <pre className="text-xs overflow-x-auto text-slate-800 dark:text-slate-200 font-mono">
                  {JSON.stringify(items.find((r) => r._id === expanded)?.details, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span>
              Showing {items.length ? skip + 1 : 0}–{skip + items.length} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={skip === 0}
                onClick={() => setSkip((s) => Math.max(0, s - PAGE))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasMore}
                onClick={() => setSkip((s) => s + PAGE)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
