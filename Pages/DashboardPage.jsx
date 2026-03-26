import React from "react";
import DashboardLayout from "./DashboardLayout";
import WelcomeBack from "./WelcomeBack";
import { GlassCard } from "./GlassCard";
import { FaCalendarAlt, FaDollarSign, FaUsers } from "react-icons/fa";
import { useQuery } from "@tanstack/react-query";
import _axios from "../src/api/_axios";
import axios from "axios";


const DashboardPage = () => {





  return (
    <>
      <WelcomeBack />

      

      {/* Example Cards */}
      {/* <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#E5D3B3] p-6 rounded-2xl shadow-md">
          <h3 className="text-[#987554]">Appointments Today</h3>
          <p className="text-3xl font-bold text-[#272727] mt-2">30</p>
        </div>

      </div> */}
      

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <GlassCard title="Today's Clients" value="24" icon={<FaUsers />} />
  <GlassCard title="Appointments" value="18" icon={<FaCalendarAlt />} />
  <GlassCard title="Revenue" value="$1,280" icon={<FaDollarSign />} />
  <GlassCard title="Revenue" value="$1,280" icon={<FaDollarSign />} />
  
</div>
    </>
  );
};

export default DashboardPage;