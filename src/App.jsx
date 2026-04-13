import "./App.css";

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardLayout from "../Pages/DashboardLayout";
import DashboardPage from "../Pages/DashboardPage";
import SalonLogin from "../Pages/Login";
import Loader from "../Pages/Loader";
import ProtectedRoute from "../Components/ProtectedRoute";
import PublicRoute from "../Components/PublicRoute";
import RoleManagement from "../Pages/RoleManagement";
import Staff from "../Pages/Staff";
import CalendarPage from "../Pages/CalendarPage";
import ServicesPage from "../Pages/ServicesPage";
import CustomersPage from "../Pages/CustomersPage";
import BlockedDaysPage from "../Pages/BlockedDaysPage";
import ClientProfilePage from "../Pages/ClientProfilePage";

export default function App() {
  const [loading, setLoading] = useState(() => {
    return sessionStorage.getItem("hasLoaded") !== "true";
  });

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
        sessionStorage.setItem("hasLoaded", "true");
      }, 2400);

      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading) return <Loader />;

  return (
    <BrowserRouter>
      <Routes>
        {/* Login but Public Route */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <SalonLogin />
            </PublicRoute>
          }
        />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/role-management" element={<RoleManagement/>}/>
            <Route path="/staff" element={<Staff/>}/>
            <Route path="/calendar" element={<CalendarPage/>}/>
            <Route path="/services" element={<ServicesPage/>}/>
            <Route path="/clients" element={<CustomersPage/>}/>
            <Route path="/clients/:id" element={<ClientProfilePage/>}/>
            <Route path="/blocked-days" element={<BlockedDaysPage/>}/>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
