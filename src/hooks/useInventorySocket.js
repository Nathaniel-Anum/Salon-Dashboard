import { useEffect, useRef } from "react";
import { notification } from "antd";

const WS_URL = "wss://api.cbkbeauty.expertech.dev/ws/portal/inventory/";

// Maximum reconnect delay: 30 seconds
const MAX_BACKOFF_MS = 30_000;
// Stop retrying after this many failed attempts
const MAX_ATTEMPTS = 5;

function handleMessage(data) {
  if (data.event === "inventory.low_stock") {
    notification.warning({
      message: "Low Stock Alert",
      description: data.message,
      placement: "topRight",
      duration: 8,
      style: {
        borderRadius: 14,
        border: "1px solid rgba(230,168,23,0.35)",
        background: "#fffbf0",
        fontFamily: "'Poppins', sans-serif",
      },
    });
  }
}

/**
 * Connects to the inventory low-stock WebSocket for the entire portal session.
 * Shows an Ant Design warning notification whenever the backend fires an
 * `inventory.low_stock` event.
 *
 * Reconnects automatically with exponential backoff on unexpected disconnects.
 * The socket is cleanly closed when the component that calls this hook unmounts.
 */
export function useInventorySocket() {
  const socketRef = useRef(null);
  const reconnectTimer = useRef(null);
  const attemptRef = useRef(0);
  // Track whether the hook is still mounted so we don't reconnect after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      const token = localStorage.getItem("access");
      if (!token) {
        console.warn(
          "[InventoryWS] no access token found — skipping connection",
        );
        return;
      }
      console.log("[InventoryWS] connecting…");

      const socket = new WebSocket(`${WS_URL}?token=${token}`);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("[InventoryWS] connected ✓");
        attemptRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[InventoryWS] message received:", data);
          handleMessage(data);
        } catch {
          console.log("[InventoryWS] raw (non-JSON) frame:", event.data);
        }
      };

      socket.onerror = (error) => {
        console.error("[InventoryWS] error:", error);
      };

      socket.onclose = (event) => {
        console.warn(
          "[InventoryWS] closed — code:",
          event.code,
          "reason:",
          event.reason,
        );
        if (!mountedRef.current || event.code === 1000) return;

        if (attemptRef.current >= MAX_ATTEMPTS) {
          console.warn(
            "[InventoryWS] max reconnect attempts reached — giving up.",
          );
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s … capped at MAX_BACKOFF_MS
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
