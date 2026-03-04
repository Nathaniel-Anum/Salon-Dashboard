import React from "react";
import DashboardLayout from "./DashboardLayout";
import WelcomeBack from "./WelcomeBack";

const DashboardPage = () => {
  return (
    <DashboardLayout>
      <WelcomeBack />

      {/* Example Cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-[#E5D3B3] p-6 rounded-2xl shadow-md">
          <h3 className="text-[#987554]">Appointments Today</h3>
          <p className="text-3xl font-bold text-[#272727] mt-2">30</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DashboardPage;