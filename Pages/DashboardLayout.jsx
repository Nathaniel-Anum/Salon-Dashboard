import React from "react";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { useInventorySocket } from "../src/hooks/useInventorySocket";
import { NotificationsProvider } from "../src/context/NotificationsContext";
import BookingV2Provider from "../src/context/BookingV2Provider.jsx";

function LayoutInner() {
  useInventorySocket();

  return (
    <div className="flex h-dvh min-h-0" style={{ background: "#F5EFE6", overflow: "hidden" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        <Header />
        <div className="flex-1 p-3 sm:p-5 lg:p-8 overflow-auto flex flex-col min-h-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const DashboardLayout = () => (
  <NotificationsProvider>
    <BookingV2Provider>
      <LayoutInner />
    </BookingV2Provider>
  </NotificationsProvider>
);

export default DashboardLayout;
