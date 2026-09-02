import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
const queryClient = new QueryClient();
import App from './App.jsx'
import { App as AntdApp, ConfigProvider } from "antd";
import PortalMessageBridge from '../Components/PortalMessageBridge.jsx';

const portalTheme = {
  token: {
    colorPrimary: "#BBA14F",
    colorInfo: "#BBA14F",
    colorText: "#272727",
    colorTextSecondary: "#987554",
    colorBgContainer: "#FDFAF5",
    colorBgElevated: "#FFFCF7",
    colorBorder: "#D9CDBB",
    colorBorderSecondary: "#E9DFD0",
    borderRadius: 10,
    borderRadiusLG: 14,
    controlHeight: 40,
    controlOutline: "rgba(187, 161, 79, 0.2)",
    fontFamily: "'Poppins', 'Inter', sans-serif",
  },
  components: {
    Select: {
      activeBorderColor: "#BBA14F",
      activeOutlineColor: "rgba(187, 161, 79, 0.18)",
      hoverBorderColor: "#BBA14F",
      optionActiveBg: "#F5EFE6",
      optionSelectedBg: "#EFE5CB",
      optionSelectedColor: "#5E5125",
      selectorBg: "#FDFAF5",
      multipleItemBg: "#F1E8D7",
    },
    Dropdown: {
      colorBgElevated: "#FFFCF7",
      controlItemBgHover: "#F5EFE6",
      controlItemBgActive: "#EFE5CB",
      controlItemBgActiveHover: "#E8D9B7",
    },
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider theme={portalTheme}>
      <AntdApp>
        <PortalMessageBridge />
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </StrictMode>,
)
