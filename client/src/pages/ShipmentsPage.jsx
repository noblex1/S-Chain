import { useEffect, useState, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import ShipmentCard from '../components/ShipmentCard.jsx';
import { pushNotification } from '../components/NotificationHost.jsx';

const defaultOrigin = { lat: 40.7128, lng: -74.006, address: 'New York, NY' };
const defaultDest = { lat: 34.0522, lng: -118.2437, address: 'Los Angeles, CA' };

export default function ShipmentsPage() {
  const { isAdmin, isLogistics, isCustomer } = useAuth();
  const [shipments, setShipments] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [trackingQuery, setTrackingQuery] = useState('');
  const [meta, setMeta] = useState({ total: 0, totalPages: 0, limit: 20 });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    customerId: '',
    vehicle: '',
    description: '',
    originAddress: defaultOrigin.address,
    destAddress: defaultDest.address,
    originLat: defaultOrigin.lat,
    originLng: defaultOrigin.lng,
    destLat: defaultDest.lat,
    destLng: defaultDest.lng,
  });

  const canCreate = isAdmin || isLogistics || isCustomer;
  const canExport = isAdmin || isLogistics;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (statusFilter) params.status = statusFilter;
      if (trackingQuery) params.q = trackingQuery;
      const { data } = await api.get('/shipments', { params });
      setShipments(data.items || []);
      setMeta({
        total: data.total ?? 0,
        totalPages: data.totalPages ?? 0,
        limit: data.limit ?? 12,
      });
    } catch {
      setShipments([]);
      setMeta({ total: 0, totalPages: 0, limit: 12 });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, trackingQuery]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setTimeout(() => setTrackingQuery(searchDraft.trim()), 350);
    return () => clearTimeout(t);
  }, [searchDraft]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, trackingQuery]);

  useEffect(() => {
    (async () => {
      if (!isAdmin && !isLogistics) return;
      try {
        const { data } = await api.get('/users?role=customer');
        setCustomers(data);
        setForm((f) => (!f.customerId && data[0]?._id ? { ...f, customerId: data[0]._id } : f));
      } catch {
        setCustomers([]);
      }
    })();
  }, [isAdmin, isLogistics]);

  const createShipment = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        origin: {
          lat: Number(form.originLat),
          lng: Number(form.originLng),
          address: form.originAddress,
        },
        destination: {
          lat: Number(form.destLat),
          lng: Number(form.destLng),
          address: form.destAddress,
        },
        packageDetails: { description: form.description },
        vehicle: form.vehicle,
        status: 'pending',
        currentLocation: {
          lat: Number(form.originLat),
          lng: Number(form.originLng),
          address: '',
        },
      };
      if (isAdmin || isLogistics) {
        payload.customer = form.customerId;
      }
      await api.post('/shipments', payload);
      pushNotification({ type: 'status', message: 'Shipment created successfully' });
      setOpen(false);
      load();
    } catch (err) {
      pushNotification({
        type: 'info',
        message: err.response?.data?.message || 'Could not create shipment',
      });
    }
  };

  const exportCsv = async () => {
    const limit = 100;
    const maxPages = 100;
    const all = [];
    try {
      let p = 1;
      while (p <= maxPages) {
        const params = { page: p, limit };
        if (statusFilter) params.status = statusFilter;
        if (trackingQuery) params.q = trackingQuery;
        const { data } = await api.get('/shipments', { params });
        const chunk = data.items || [];
        all.push(...chunk);
        if (chunk.length < limit || p >= (data.totalPages || 0)) break;
        p += 1;
      }
    } catch {
      pushNotification({ type: 'info', message: 'Export failed' });
      return;
    }
    const rows = [
      ['trackingNumber', 'status', 'origin', 'destination', 'vehicle', 'customerEmail', 'eta'].join(','),
      ...all.map((s) =>
        [
          s.trackingNumber,
          s.status,
          `${s.origin?.lat}|${s.origin?.lng}`,
          `${s.destination?.lat}|${s.destination?.lng}`,
          s.vehicle || '',
          s.customer?.email || '',
          s.estimatedDeliveryAt || '',
        ].join(',')
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipments-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushNotification({ type: 'status', message: `Exported ${all.length} row(s)` });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="surface p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Shipments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isCustomer ? 'Orders linked to your account' : 'Monitor and manage network flows'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div>
            <label className="sr-only">Filter by status</label>
            <select
              className="field-input mt-0"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="in_transit">In transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          {canExport && (
            <button
              type="button"
              onClick={exportCsv}
              className="btn-secondary"
            >
              Export CSV
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="btn-primary"
            >
              New shipment
            </button>
          )}
        </div>
      </div>

      <div className="surface p-4 max-w-xl">
        <label htmlFor="tracking-search" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Search by tracking number
        </label>
        <input
          id="tracking-search"
          type="search"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          placeholder="e.g. SC- or partial match"
          autoComplete="off"
          className="field-input mt-0"
        />
      </div>

      {shipments.length === 0 ? (
        <div className="surface p-8 text-center text-slate-500">No shipments found.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {shipments.map((s) => (
            <ShipmentCard key={s._id} shipment={s} />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-sm text-slate-600 dark:text-slate-400">
          <span>
            Page {page} of {meta.totalPages} ({meta.total} total)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">New shipment</h3>
            <form onSubmit={createShipment} className="mt-4 space-y-3 text-sm">
              {(isAdmin || isLogistics) && (
                <div>
                  <label className="text-xs font-medium text-slate-500">Customer</label>
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                    value={form.customerId}
                    onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}
                    required
                  >
                    <option value="">Select customer…</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.email})
                      </option>
                    ))}
                  </select>
                  {customers.length === 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Register at least one customer user first, then refresh — or paste a user ID (API).
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Origin lat</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                    value={form.originLat}
                    onChange={(e) => setForm((f) => ({ ...f, originLat: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Origin lng</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                    value={form.originLng}
                    onChange={(e) => setForm((f) => ({ ...f, originLng: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Origin address</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  value={form.originAddress}
                  onChange={(e) => setForm((f) => ({ ...f, originAddress: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-slate-500">Destination lat</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                    value={form.destLat}
                    onChange={(e) => setForm((f) => ({ ...f, destLat: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500">Destination lng</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                    value={form.destLng}
                    onChange={(e) => setForm((f) => ({ ...f, destLng: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Destination address</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  value={form.destAddress}
                  onChange={(e) => setForm((f) => ({ ...f, destAddress: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Vehicle</label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  value={form.vehicle}
                  onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value }))}
                  placeholder="e.g. TRK-1042"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Package notes</label>
                <textarea
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
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
    </div>
  );
}
