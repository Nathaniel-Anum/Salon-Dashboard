import React from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import {  Outlet } from "react-router-dom";


const DashboardLayout = ({ children }) => {
  return (
    <div className="flex min-h-screen bg-[#ECE6DB]">
      
      {/* Sidebar */}
      <Sidebar />

      {/* Main Section */}
      <div className="flex-1 flex flex-col">
        
        <Navbar />

        {/* Page Content */}
        <div className="p-8">
           <Outlet />
        </div>

      </div>
    </div>
  );
};

export default DashboardLayout;