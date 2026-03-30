import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import ShipmentCard from '../components/ShipmentCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const emptyStats = { total: 0, pending: 0, in_transit: 0, delivered: 0 };

export default function DashboardPage() {
  const { user, isAdmin, isLogistics, isCustomer } = useAuth();
  const [stats, setStats] = useState(emptyStats);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [statsRes, listRes] = await Promise.all([
          api.get('/shipments/stats'),
          api.get('/shipments', { params: { page: 1, limit: 5 } }),
        ]);
        if (!cancelled) {
          setStats(statsRes.data);
          setRecent(listRes.data.items || []);
        }
      } catch {
        if (!cancelled) {
          setStats(emptyStats);
          setRecent([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="surface p-6">
        <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Hello, {user?.name}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {isAdmin && 'Organization-wide shipment intelligence and controls.'}
          {isLogistics && 'Manage lanes, assignments, and live positions.'}
          {isCustomer && 'Track your orders in real time on the map.'}
        </p>
      </div>

      {(isAdmin || isLogistics) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total shipments" value={stats.total} accent="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900" />
          <StatCard label="Pending" value={stats.pending} accent="bg-amber-500 text-white" />
          <StatCard label="Active deliveries" value={stats.in_transit} accent="bg-sky-600 text-white" />
          <StatCard label="Completed" value={stats.delivered} accent="bg-emerald-600 text-white" />
        </div>
      )}

      {isCustomer && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="My shipments" value={stats.total} accent="bg-brand-600 text-white" />
          <StatCard label="On the road" value={stats.in_transit} accent="bg-sky-600 text-white" />
          <StatCard label="Delivered" value={stats.delivered} accent="bg-emerald-600 text-white" />
        </div>
      )}

      <div className="surface p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h3 className="font-display font-semibold text-slate-900 dark:text-white">
            {isCustomer ? 'Your recent shipments' : 'Recent activity'}
          </h3>
          <Link
            to="/shipments"
            className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No shipments yet. Create one from the Shipments page.</p>
        ) : (
          <ul className="space-y-3">
            {recent.map((s) => (
              <li
                key={s._id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <Link to={`/shipments/${s._id}`} className="font-medium text-slate-900 dark:text-white hover:text-brand-600">
                  {s.trackingNumber}
                </Link>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {recent.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          {recent.slice(0, 2).map((s) => (
            <ShipmentCard key={s._id} shipment={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="surface overflow-hidden">
      <div className={`px-4 py-3 ${accent} rounded-t-2xl`}>
        <p className="text-[11px] font-medium uppercase tracking-wider opacity-90">{label}</p>
        <p className="text-3xl font-display font-bold mt-1">{value}</p>
      </div>
    </div>
  );
}
