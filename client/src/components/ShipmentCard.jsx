import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '—';
  }
}

export default function ShipmentCard({ shipment }) {
  const id = shipment._id || shipment.id;
  return (
    <Link
      to={`/shipments/${id}`}
      className="block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 shadow-sm hover:shadow-md hover:border-brand-300 dark:hover:border-brand-700 transition-all"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display font-semibold text-slate-900 dark:text-white">
            {shipment.trackingNumber}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
            {shipment.origin?.address || `${shipment.origin?.lat?.toFixed(4)}, ${shipment.origin?.lng?.toFixed(4)}`}{' '}
            →{' '}
            {shipment.destination?.address ||
              `${shipment.destination?.lat?.toFixed(4)}, ${shipment.destination?.lng?.toFixed(4)}`}
          </p>
        </div>
        <StatusBadge status={shipment.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
        <span>
          ETA: <strong className="text-slate-700 dark:text-slate-200">{formatDate(shipment.estimatedDeliveryAt)}</strong>
        </span>
        {shipment.vehicle && (
          <span>
            Vehicle: <strong className="text-slate-700 dark:text-slate-200">{shipment.vehicle}</strong>
          </span>
        )}
      </div>
    </Link>
  );
}
