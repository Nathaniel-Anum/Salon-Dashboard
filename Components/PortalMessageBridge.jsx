import { useEffect } from "react";
import { App as AntdApp } from "antd";
import { PORTAL_SUCCESS_EVENT } from "../src/api/portalContract";

export default function PortalMessageBridge() {
  const { message } = AntdApp.useApp();

  useEffect(() => {
    const showPortalSuccess = (event) => {
      if (event.detail?.message) message.success(event.detail.message);
    };

    window.addEventListener(PORTAL_SUCCESS_EVENT, showPortalSuccess);
    return () => window.removeEventListener(PORTAL_SUCCESS_EVENT, showPortalSuccess);
  }, [message]);

  return null;
}

