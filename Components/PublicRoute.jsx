// PublicRoute.jsx
import { Navigate } from "react-router-dom";

const PublicRoute = ({ children }) => {
  const token = localStorage.getItem("access");

  return !token ? children : <Navigate to="/" replace />;
};

export default PublicRoute;