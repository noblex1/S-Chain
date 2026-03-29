import { useEffect, useState } from 'react';
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

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/shipments');
      setShipments(data);
    } catch {
      setShipments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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

  const exportCsv = () => {
    const rows = [
      ['trackingNumber', 'status', 'origin', 'destination', 'vehicle', 'customerEmail', 'eta'].join(','),
      ...shipments.map((s) =>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Shipments</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isCustomer ? 'Orders linked to your account' : 'Monitor and manage network flows'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canExport && (
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Export CSV
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="rounded-lg bg-brand-600 text-white px-4 py-2 text-sm font-semibold hover:bg-brand-700"
            >
              New shipment
            </button>
          )}
        </div>
      </div>

      {shipments.length === 0 ? (
        <p className="text-slate-500">No shipments found.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {shipments.map((s) => (
            <ShipmentCard key={s._id} shipment={s} />
          ))}
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
