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
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
