import { useEffect, useRef, useCallback } from 'react';

export function useWS(token, onMessage) {
  const ws = useRef(null);
  const reconnTimer = useRef(null);

  const connect = useCallback(() => {
    if (!token) return;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws.current = new WebSocket(`${proto}://${location.host}`);

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({ type: 'auth', token }));
    };
    ws.current.onmessage = e => {
      try { onMessage(JSON.parse(e.data)); } catch {}
    };
    ws.current.onclose = () => {
      reconnTimer.current = setTimeout(connect, 2500);
    };
  }, [token, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const send = useCallback(data => {
    if (ws.current?.readyState === 1) ws.current.send(JSON.stringify(data));
  }, []);

  return { send };
}
