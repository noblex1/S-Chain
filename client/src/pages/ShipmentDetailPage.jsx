import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import api from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import LiveMap from '../components/LiveMap.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { pushNotification } from '../components/NotificationHost.jsx';

function interpolate(a, b, t) {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
  };
}

export default function ShipmentDetailPage() {
  const { id } = useParams();
  const { user, isAdmin, isLogistics, isCustomer } = useAuth();
  const { socket } = useSocket();
  const [shipment, setShipment] = useState(null);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const simRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/shipments/${id}`);
      setShipment(data);
    } catch {
      setShipment(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin && !isLogistics) return;
    (async () => {
      try {
        const { data } = await api.get('/users?role=logistics_manager');
        setStaff(data);
      } catch {
        setStaff([]);
      }
    })();
  }, [isAdmin, isLogistics]);

  useEffect(() => {
    if (!socket || !id) return;

    const joinRoom = () => {
      socket.emit('join:shipment', id, (res) => {
        if (res && !res.ok) {
          pushNotification({
            type: 'info',
            message: res.message || 'Could not subscribe to live updates',
          });
        }
      });
    };
    joinRoom();
    socket.on('connect', joinRoom);

    const onJoinDenied = (p) => {
      pushNotification({
        type: 'info',
        message: p?.message || 'Live updates unavailable for this shipment',
      });
    };
    socket.on('shipment:join_denied', onJoinDenied);

    const onLoc = (payload) => {
      if (String(payload.shipmentId) !== String(id)) return;
      setShipment((prev) =>
        prev
          ? {
              ...prev,
              currentLocation: payload.location,
              status: payload.status || prev.status,
              estimatedDeliveryAt: payload.estimatedDeliveryAt || prev.estimatedDeliveryAt,
            }
          : prev
      );
    };
    const onUpd = ({ shipment: s }) => {
      if (!s?._id || String(s._id) !== String(id)) return;
      setShipment(s);
    };
    socket.on('shipment:location', onLoc);
    socket.on('shipment:updated', onUpd);
    return () => {
      socket.off('connect', joinRoom);
      socket.off('shipment:join_denied', onJoinDenied);
      socket.emit('leave:shipment', id);
      socket.off('shipment:location', onLoc);
      socket.off('shipment:updated', onUpd);
    };
  }, [socket, id]);

  const updateStatus = async (status) => {
    try {
      await api.put(`/shipments/${id}`, { status });
      pushNotification({ type: 'status', message: `Status updated to ${status.replace('_', ' ')}` });
      load();
    } catch (err) {
      pushNotification({
        type: 'info',
        message: err.response?.data?.message || 'Update failed',
      });
    }
  };

  const assignDriver = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const driverId = fd.get('driverId');
    try {
      await api.put(`/shipments/${id}`, { assignedDriver: driverId || null });
      load();
    } catch (err) {
      pushNotification({
        type: 'info',
        message: err.response?.data?.message || 'Could not assign',
      });
    }
  };

  const startSimulation = () => {
    if (!shipment || simulating) return;
    setSimulating(true);
    let t = 0;
    const origin = shipment.currentLocation || shipment.origin;
    const dest = shipment.destination;
    simRef.current = window.setInterval(async () => {
      t += 0.04;
      if (t >= 1) t = 1;
      const loc = interpolate(origin, dest, t);
      try {
        await api.post('/tracking/update-location', {
          shipmentId: shipment._id,
          lat: loc.lat,
          lng: loc.lng,
        });
      } catch {
        /* ignore single tick errors */
      }
      if (t >= 1 && simRef.current) {
        clearInterval(simRef.current);
        simRef.current = null;
        setSimulating(false);
        load();
      }
    }, 1200);
  };

  const stopSimulation = () => {
    if (simRef.current) clearInterval(simRef.current);
    simRef.current = null;
    setSimulating(false);
  };

  useEffect(() => () => stopSimulation(), []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-10 w-10 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!shipment) {
    return (
      <p className="text-slate-500">
        Shipment not found. <Link to="/shipments" className="text-brand-600">Back</Link>
      </p>
    );
  }

  const trackUrl = `${window.location.origin}/shipments/${shipment._id}`;
  const canSimulate = isAdmin || isLogistics;
  const canOps = isAdmin || isLogistics;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/shipments" className="text-sm text-brand-600 hover:underline">
            ← All shipments
          </Link>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-2">
            {shipment.trackingNumber}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={shipment.status} />
            {shipment.estimatedDeliveryAt && (
              <span className="text-xs text-slate-500">
                ETA: {new Date(shipment.estimatedDeliveryAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col items-center">
          <p className="text-xs font-medium text-slate-500 mb-2">Scan to open tracking</p>
          <QRCodeSVG value={trackUrl} size={112} className="rounded-lg" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <LiveMap
            origin={shipment.origin}
            destination={shipment.destination}
            current={shipment.currentLocation || shipment.origin}
            height={440}
          />
          {canSimulate && shipment.status !== 'delivered' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={startSimulation}
                disabled={simulating}
                className="rounded-lg bg-teal-600 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {simulating ? 'Simulating GPS…' : 'Simulate live GPS along route'}
              </button>
              {simulating && (
                <button
                  type="button"
                  onClick={stopSimulation}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm"
                >
                  Stop
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-sm space-y-3">
            <h3 className="font-display font-semibold text-slate-900 dark:text-white">Route</h3>
            <p>
              <span className="text-slate-500">Origin</span>
              <br />
              {shipment.origin?.address || `${shipment.origin?.lat}, ${shipment.origin?.lng}`}
            </p>
            <p>
              <span className="text-slate-500">Destination</span>
              <br />
              {shipment.destination?.address ||
                `${shipment.destination?.lat}, ${shipment.destination?.lng}`}
            </p>
            {shipment.vehicle && (
              <p>
                <span className="text-slate-500">Vehicle</span>
                <br />
                {shipment.vehicle}
              </p>
            )}
            {shipment.customer && (
              <p>
                <span className="text-slate-500">Customer</span>
                <br />
                {shipment.customer.name} ({shipment.customer.email})
              </p>
            )}
          </div>

          {canOps && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-sm space-y-4">
              <h3 className="font-display font-semibold text-slate-900 dark:text-white">Operations</h3>
              <div>
                <label className="text-xs text-slate-500">Status</label>
                <select
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  value={shipment.status}
                  onChange={(e) => updateStatus(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="in_transit">In transit</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>
              <form onSubmit={assignDriver}>
                <label className="text-xs text-slate-500">Assigned driver (logistics manager)</label>
                <select
                  name="driverId"
                  defaultValue={shipment.assignedDriver?._id || ''}
                  className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                >
                  <option value="">Unassigned</option>
                  {staff.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  className="mt-2 w-full rounded-lg bg-slate-900 dark:bg-brand-600 text-white py-2 text-xs font-semibold"
                >
                  Save assignment
                </button>
              </form>
            </div>
          )}

          {isCustomer && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-sm text-slate-600 dark:text-slate-300">
              You are viewing this shipment as <strong className="text-slate-900 dark:text-white">{user?.name}</strong>.
              Live updates appear automatically via WebSockets.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
