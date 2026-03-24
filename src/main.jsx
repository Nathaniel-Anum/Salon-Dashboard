import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
import App from './App.jsx'
import { App as AntdApp } from "antd";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AntdApp>
    <QueryClientProvider client={queryClient}>

    <App />
    </QueryClientProvider>
    </AntdApp>
  </StrictMode>,
)
