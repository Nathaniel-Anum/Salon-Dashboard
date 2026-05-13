import { createContext, useContext, useState, useCallback } from "react";

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
  const [alerts, setAlerts] = useState([]);

  const addAlert = useCallback((alert) => {
    setAlerts((prev) => [
      { id: Date.now() + Math.random(), timestamp: new Date(), ...alert },
      ...prev,
    ]);
  }, []);

  const removeAlert = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAll = useCallback(() => setAlerts([]), []);

  return (
    <NotificationsContext.Provider value={{ alerts, addAlert, removeAlert, clearAll }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationsProvider");
  return ctx;
};
