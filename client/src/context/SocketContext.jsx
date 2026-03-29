import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, ready } = useAuth();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!ready) return;

    const url =
      import.meta.env.VITE_SOCKET_URL ||
      `${window.location.protocol}//${window.location.hostname}:5000`;

    const s = io(url, {
      autoConnect: !!token,
      transports: ['websocket', 'polling'],
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [ready]);

  useEffect(() => {
    if (!socket) return;
    if (token) {
      if (!socket.connected) socket.connect();
    } else {
      socket.disconnect();
    }
  }, [socket, token]);

  const value = useMemo(() => ({ socket }), [socket]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
