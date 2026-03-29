import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext.jsx';

let notifyExternal = null;

export function pushNotification(payload) {
  notifyExternal?.(payload);
}

export default function NotificationHost() {
  const { socket } = useSocket();
  const [items, setItems] = useState([]);

  const push = useCallback((n) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, ...n }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 6000);
  }, []);

  useEffect(() => {
    notifyExternal = push;
    return () => {
      notifyExternal = null;
    };
  }, [push]);

  useEffect(() => {
    if (!socket) return;
    const onNotify = (data) => push({ type: data.type || 'info', message: data.message || '' });
    socket.on('notification', onNotify);
    return () => socket.off('notification', onNotify);
  }, [socket, push]);

  return (
    <div className="fixed top-4 right-4 z-[1000] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {items.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto rounded-xl shadow-lg border px-4 py-3 text-sm transition-all ${
            n.type === 'delivered'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100'
              : n.type === 'status'
                ? 'bg-brand-50 border-brand-200 text-brand-900 dark:bg-brand-950 dark:border-brand-800 dark:text-brand-100'
                : 'bg-white border-slate-200 text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100'
          }`}
        >
          <p className="font-semibold font-display">{n.type === 'delivered' ? 'Delivered' : 'Update'}</p>
          <p className="mt-1 opacity-90">{n.message}</p>
        </div>
      ))}
    </div>
  );
}
