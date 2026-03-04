
import './App.css'

import Loader from '../Pages/Loader'
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import DashboardLayout from '../Pages/DashboardLayout'

import DashboardPage from '../Pages/DashboardPage'
import SalonLogin from '../Pages/Login';

function App() {

const [loading, setLoading] = useState(true);
 const [isAuthenticated, setIsAuthenticated] = useState(false);


  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1400);// seconds loading

    return () => clearTimeout(timer);
  }, []);

  
    
    if (loading) return <Loader />;

      return (
   <BrowserRouter>
  <Routes>

    {/* Login */}
    <Route
      path="/login"
      element={
        !isAuthenticated ? (
          <SalonLogin setIsAuthenticated={setIsAuthenticated} />
        ) : (
          <Navigate to="/" />
        )
      }
    />

    {/* Protected Layout */}
    <Route
      path="/"
      element={
        isAuthenticated ? (
          <DashboardLayout />
        ) : (
          <Navigate to="/login" />
        )
      }
    >
      {/* Nested Routes */}
      <Route index element={<DashboardPage />} />
      {/* Future routes */}
      {/* <Route path="appointments" element={<Appointments />} /> */}
      {/* <Route path="clients" element={<Clients />} /> */}
    </Route>

  </Routes>
</BrowserRouter>
  );
    

}

export default App
