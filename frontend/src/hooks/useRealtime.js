import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { getAccessToken, refreshSession } from '../api/client';

const EVENTS = ['appointment:created', 'appointment:updated', 'appointment:cancelled'];

/**
 * Subscribes to live appointment events. Events only carry ids and slot info,
 * so on every event we invalidate the affected queries and React Query
 * refetches through the normal, authorized REST endpoints.
 */
export default function useRealtime(enabled) {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const socket = io(import.meta.env.VITE_SOCKET_URL || undefined, {
      withCredentials: true,
      // Function form: every (re)connect uses the CURRENT access token.
      auth: (cb) => cb({ token: getAccessToken() }),
    });

    const onEvent = () => {
      ['appointments', 'slots', 'dashboard'].forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      setLastUpdate(new Date());
    };

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      setConnected(false);
      // Expired token: renew the session once, then reconnect.
      if (/token/i.test(err.message)) refreshSession().then(() => socket.connect()).catch(() => {});
    });
    EVENTS.forEach((e) => socket.on(e, onEvent));

    return () => {
      EVENTS.forEach((e) => socket.off(e, onEvent));
      socket.disconnect();
    };
  }, [enabled, queryClient]);

  return { connected, lastUpdate };
}
