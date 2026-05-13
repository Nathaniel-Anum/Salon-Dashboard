import { useEffect, useRef } from "react";
import { notification } from "antd";
import { useNotifications } from "../context/NotificationsContext";

const WS_URL = "wss://api.cbkbeauty.expertech.dev/ws/portal/inventory/";

const MAX_BACKOFF_MS = 30_000;
const MAX_ATTEMPTS = 5;

export function useInventorySocket() {
  const { addAlert } = useNotifications();
  const socketRef = useRef(null);
  const reconnectTimer = useRef(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  // Keep addAlert stable in the closure without re-triggering the effect
  const addAlertRef = useRef(addAlert);
  useEffect(() => {
    addAlertRef.current = addAlert;
  }, [addAlert]);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      const token = localStorage.getItem("access");
      if (!token) return;

      const socket = new WebSocket(`${WS_URL}?token=${token}`);
      socketRef.current = socket;

      socket.onopen = () => {
        attemptRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === "inventory.low_stock") {
            // 1. Persist in bell for later reference
            addAlertRef.current({
              type: "low_stock",
              title: "Low Stock Alert",
              message: data.message,
            });
            // 2. Immediate pop-in toast so it's hard to miss
            notification.warning({
              message: "Low Stock Alert",
              description: data.message,
              placement: "topRight",
              duration: 6,
              style: {
                borderRadius: 14,
                border: "1px solid rgba(230,168,23,0.35)",
                background: "#fffbf0",
                fontFamily: "'Poppins', sans-serif",
              },
            });
          }
        } catch {
          // non-JSON frame — ignore
        }
      };

      socket.onerror = () => {};

      socket.onclose = (event) => {
        if (!mountedRef.current || event.code === 1000) return;

        if (attemptRef.current >= MAX_ATTEMPTS) return;

        const delay = Math.min(1_000 * 2 ** attemptRef.current, MAX_BACKOFF_MS);
        attemptRef.current += 1;

        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (socketRef.current) {
        socketRef.current.close(1000, "unmount");
      }
    };
  }, []);
}
