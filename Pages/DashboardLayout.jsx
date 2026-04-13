import React from "react";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";
import { Header } from "./Header";

const DashboardLayout = () => {
  return (
    <div className="flex min-h-screen" style={{ background: "#F5EFE6", overflow: "hidden" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header />
        <div className="flex-1 p-5 lg:p-8 overflow-auto flex flex-col min-h-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
