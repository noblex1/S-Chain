import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const PAGE_LIMIT = 100;
const PAGE_GUARD = 100;

function byUpdatedDesc(a, b) {
  return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
}

function upsertShipment(list, shipment) {
  const id = String(shipment?._id || shipment?.id || '');
  if (!id) return list;
  const rest = list.filter((x) => String(x._id || x.id) !== id);
  return [shipment, ...rest].sort(byUpdatedDesc);
}

export default function AdminMonitoringPage() {
  const { isAdmin } = useAuth();
  const { socket } = useSocket();
  const [shipments, setShipments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef(null);

  const loadAllShipments = useCallback(async () => {
    const all = [];
    for (let page = 1; page <= PAGE_GUARD; page += 1) {
      const { data } = await api.get('/shipments', { params: { page, limit: PAGE_LIMIT } });
      const items = data.items || [];
      all.push(...items);
      if (items.length < PAGE_LIMIT || page >= (data.totalPages || 0)) break;
    }
    return all.sort(byUpdatedDesc);
  }, []);

  const loadAnalytics = useCallback(async () => {
    const { data } = await api.get('/analytics/admin-summary');
    setAnalytics(data);
    setActivities(data.recentActivities || []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [allShipments] = await Promise.all([loadAllShipments(), loadAnalytics()]);
      setShipments(allShipments);
    } finally {
      setLoading(false);
    }
  }, [loadAllShipments, loadAnalytics]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const scheduleAnalyticsRefresh = useCallback(() => {
    if (refreshTimer.current) return;
    refreshTimer.current = window.setTimeout(async () => {
      refreshTimer.current = null;
      try {
        await loadAnalytics();
      } catch {
        /* ignore transient failures */
      }
    }, 1500);
  }, [loadAnalytics]);

  useEffect(() => {
    if (!socket) return;

    const onCreated = ({ shipment }) => {
      if (shipment) setShipments((prev) => upsertShipment(prev, shipment));
      scheduleAnalyticsRefresh();
    };
    const onUpdated = ({ shipment }) => {
      if (shipment) setShipments((prev) => upsertShipment(prev, shipment));
      scheduleAnalyticsRefresh();
    };
    const onDeleted = ({ id }) => {
      setShipments((prev) => prev.filter((s) => String(s._id) !== String(id)));
      scheduleAnalyticsRefresh();
    };
    const onLocation = (payload) => {
      setShipments((prev) =>
        prev.map((s) =>
          String(s._id) === String(payload.shipmentId)
            ? {
                ...s,
                currentLocation: payload.location,
                status: payload.status || s.status,
                estimatedDeliveryAt: payload.estimatedDeliveryAt || s.estimatedDeliveryAt,
                updatedAt: new Date().toISOString(),
              }
            : s
        )
      );
    };
    const onAudit = (entry) => {
      setActivities((prev) => [entry, ...prev].slice(0, 25));
      scheduleAnalyticsRefresh();
    };

    socket.on('shipment:created', onCreated);
    socket.on('shipment:updated', onUpdated);
    socket.on('shipment:deleted', onDeleted);
    socket.on('shipment:location', onLocation);
    socket.on('audit:created', onAudit);
    return () => {
      socket.off('shipment:created', onCreated);
      socket.off('shipment:updated', onUpdated);
      socket.off('shipment:deleted', onDeleted);
      socket.off('shipment:location', onLocation);
      socket.off('audit:created', onAudit);
    };
  }, [socket, scheduleAnalyticsRefresh]);

  useEffect(
    () => () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    },
    []
  );

  const statusCounts = useMemo(() => {
    const c = { pending: 0, in_transit: 0, delivered: 0 };
    for (const s of shipments) {
      if (c[s.status] != null) c[s.status] += 1;
    }
    return c;
  }, [shipments]);

  if (!isAdmin) return <Navigate to="/" replace />;

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const total = shipments.length;
  const inTransitPct = total ? Math.round((statusCounts.in_transit / total) * 100) : 0;
  const deliveredPct = total ? Math.round((statusCounts.delivered / total) * 100) : 0;
  const pendingPct = total ? Math.round((statusCounts.pending / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="surface p-5">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Real-time monitoring
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Live shipment operations and activity analytics across the network.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Total shipments" value={total} />
        <KpiCard label="Pending" value={statusCounts.pending} tone="amber" />
        <KpiCard label="In transit" value={statusCounts.in_transit} tone="blue" />
        <KpiCard label="Delivered" value={statusCounts.delivered} tone="emerald" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="surface p-5 lg:col-span-2">
          <h3 className="panel-title">Fleet distribution</h3>
          <p className="text-xs text-slate-500 mt-1">Share of shipments by current status</p>
          <div className="mt-4 space-y-3">
            <Bar label="Pending" value={pendingPct} color="bg-amber-500" />
            <Bar label="In transit" value={inTransitPct} color="bg-sky-500" />
            <Bar label="Delivered" value={deliveredPct} color="bg-emerald-500" />
          </div>
        </div>
        <div className="surface p-5">
          <h3 className="panel-title">Activity (24h)</h3>
          <div className="mt-4 space-y-2 text-sm">
            <Row label="Creates" value={analytics?.activityLast24h?.creates ?? 0} />
            <Row label="Updates" value={analytics?.activityLast24h?.updates ?? 0} />
            <Row label="Deletes" value={analytics?.activityLast24h?.deletes ?? 0} />
            <Row
              label="Tracking pings"
              value={analytics?.activityLast24h?.trackingPings ?? 0}
            />
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-5 gap-4">
        <div className="surface p-4 xl:col-span-3 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="panel-title">All shipments (live)</h3>
            <Link to="/shipments" className="text-sm text-brand-600 hover:underline">
              Manage shipments
            </Link>
          </div>
          <table className="w-full text-sm text-left">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2 pr-3">Tracking #</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Customer</th>
                <th className="py-2 pr-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {shipments.slice(0, 200).map((s) => (
                <tr key={s._id}>
                  <td className="py-2 pr-3 font-medium text-slate-900 dark:text-slate-100">
                    <Link to={`/shipments/${s._id}`} className="hover:text-brand-600">
                      {s.trackingNumber}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="py-2 pr-3 text-slate-600 dark:text-slate-300">
                    {s.customer?.name || '—'}
                  </td>
                  <td className="py-2 pr-3 text-slate-500">
                    {s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="surface p-4 xl:col-span-2">
          <h3 className="panel-title">Recent activities</h3>
          <div className="mt-3 space-y-2 max-h-[420px] overflow-auto pr-1">
            {activities.length === 0 ? (
              <p className="text-sm text-slate-500">No activity available.</p>
            ) : (
              activities.map((a, idx) => (
                <div
                  key={a._id || `${a.createdAt}-${idx}`}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"
                >
                  <p className="text-sm text-slate-800 dark:text-slate-200">{a.summary}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {a.actorName || 'System'} • {a.action} {a.resourceType} •{' '}
                    {a.createdAt ? new Date(a.createdAt).toLocaleString() : '—'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900',
    amber: 'bg-amber-500 text-white',
    blue: 'bg-sky-600 text-white',
    emerald: 'bg-emerald-600 text-white',
  };
  return (
    <div className="surface overflow-hidden">
      <div className={`px-4 py-3 ${tones[tone] || tones.slate}`}>
        <p className="text-[11px] uppercase tracking-wider opacity-90">{label}</p>
        <p className="mt-1 text-3xl font-display font-bold">{value}</p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2">
      <span className="text-slate-600 dark:text-slate-300">{label}</span>
      <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
    </div>
  );
}

function Bar({ label, value, color }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}
