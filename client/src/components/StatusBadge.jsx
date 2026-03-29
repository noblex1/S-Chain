const styles = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  in_transit: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

const labels = {
  pending: 'Pending',
  in_transit: 'In transit',
  delivered: 'Delivered',
};

export default function StatusBadge({ status }) {
  const s = status || 'pending';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[s] || styles.pending}`}
    >
      {labels[s] || s}
    </span>
  );
}
