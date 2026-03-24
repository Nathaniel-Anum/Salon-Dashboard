import './App.css'

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import DashboardLayout from '../Pages/DashboardLayout';
import DashboardPage from '../Pages/DashboardPage';
import SalonLogin from '../Pages/Login';
import Loader from '../Pages/Loader';

export default function App() {
  const [loading, setLoading] = useState(() => {
    return sessionStorage.getItem("hasLoaded") !== "true";
  });

  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setLoading(false);
        sessionStorage.setItem("hasLoaded", "true");
      }, 1400);

      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading) return <Loader />;

  return (
    <BrowserRouter>
      <Routes>

        {/* Login page */}
        <Route path="/login" element={<SalonLogin />} />

        {/* Dashboard with layout */}
        <Route element={<DashboardLayout />}>
          <Route index element={<DashboardPage />} />
        </Route>

      </Routes>
    </BrowserRouter>
  );
}