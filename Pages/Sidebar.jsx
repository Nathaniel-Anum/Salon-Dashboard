import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome, FiCalendar, FiUsers, FiScissors, FiBarChart2, FiSettings,
  FiLogOut, FiChevronLeft, FiChevronRight, FiX, FiMenu, FiSlash,
  FiList, FiTarget, FiLifeBuoy, FiClipboard, FiShoppingCart,
  FiPackage, FiGrid, FiBox,
} from "react-icons/fi";
import { FaClock, FaUserAlt } from "react-icons/fa";
import { MdManageAccounts } from "react-icons/md";
import { useMutation } from "@tanstack/react-query";
import { LoadingOutlined } from "@ant-design/icons";
import { ConfigProvider, Drawer, Grid, Menu, Spin, Tooltip } from "antd";
import _axios from "../src/api/_axios";
import { clearPortalSession } from "../src/auth/permissions";
import "./Sidebar.css";

const menuItems = [
  { name: "Dashboard", icon: <FiHome />, path: "/" },
  { name: "Calendar", icon: <FiCalendar />, path: "/calendar" },
  { name: "Appointments", icon: <FiClipboard />, path: "/appointments" },
  { name: "Services", icon: <FiScissors />, path: "/services" },
  {
    name: "Commerce", icon: <FiShoppingCart />,
    children: [
      { name: "Categories", icon: <FiGrid />, path: "/commerce/categories" },
      { name: "Products", icon: <FiPackage />, path: "/commerce/products" },
      { name: "Orders", icon: <FiShoppingCart />, path: "/commerce/orders" },
      { name: "Inventory", icon: <FiBox />, path: "/commerce/inventory" },
    ],
  },
  {
    name: "User Management", icon: <FiUsers />,
    children: [
      { name: "Staff", icon: <FaUserAlt />, path: "/staff" },
      { name: "Role Management", icon: <MdManageAccounts />, path: "/role-management" },
      { name: "Clients", icon: <FiUsers />, path: "/clients" },
    ],
  },
  { name: "Waitlist", icon: <FiList />, path: "/waitlist" },
  { name: "Schedules", icon: <FaClock />, path: "/schedules" },
  { name: "Analytics", icon: <FiBarChart2 />, path: "/analytics" },
  { name: "Blocked Days", icon: <FiSlash />, path: "/blocked-days" },
  {
    name: "Settings", icon: <FiSettings />,
    children: [
      { name: "Deposit Rules", icon: <FiSettings />, path: "/settings" },
      { name: "Campaigns", icon: <FiTarget />, path: "/settings/campaigns" },
      { name: "Support", icon: <FiLifeBuoy />, path: "/settings/support" },
    ],
  },
];

const sidebarTheme = {
  token: { fontFamily: "'Poppins', sans-serif", colorPrimary: "#BBA14F" },
  components: {
    Menu: {
      collapsedWidth: 64,
      dropdownWidth: 224,
      collapsedIconSize: 18,
      iconSize: 17,
      itemHeight: 44,
      itemMarginInline: 10,
      itemMarginBlock: 4,
      itemBorderRadius: 10,
      darkItemBg: "transparent",
      darkSubMenuItemBg: "transparent",
      darkPopupBg: "#27241e",
      darkItemColor: "rgba(255,255,255,0.78)",
      darkItemHoverColor: "#fff",
      darkItemHoverBg: "rgba(187,161,79,0.12)",
      darkItemSelectedBg: "#BBA14F",
      darkItemSelectedColor: "#272727",
      darkGroupTitleColor: "#c9ae5e",
    },
  },
};

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [touchNavigation, setTouchNavigation] = useState(false);
  const screens = Grid.useBreakpoint();
  const railCollapsed = !screens.xl || collapsed;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentPath = pathname === "/settings/campaign" ? "/settings/campaigns" : pathname;
  const selectedItem = menuItems.flatMap((item) => item.children || [item])
    .find((item) => currentPath === item.path || (item.path !== "/" && item.path !== "/settings" && currentPath.startsWith(`${item.path}/`)));
  const activeGroup = menuItems.find((item) => item.children?.includes(selectedItem));

  const endSession = () => {
    localStorage.removeItem("isAuthenticated");
    localStorage.removeItem("refresh");
    localStorage.removeItem("access");
    clearPortalSession();
    navigate("/login");
  };
  const logoutMutation = useMutation({
    mutationFn: (refresh) => _axios.post("/api/portal/v1/accounts/logout/", { refresh }),
    onSuccess: endSession,
    onError: endSession,
  });

  const renderSidebarContent = (isMobile = false) => {
    const isRail = railCollapsed && !isMobile;
    const makeLink = (item) => ({
      key: item.path,
      icon: item.icon,
      title: item.name,
      "aria-label": item.name,
      label: <NavLink to={item.path} end={item.path === "/settings"}>{item.name}</NavLink>,
    });
    const items = menuItems.map((item) => {
      if (!item.children) return makeLink(item);
      const children = item.children.map(makeLink);
      return {
        key: item.name,
        icon: item.icon,
        label: item.name,
        children: isRail ? [{ type: "group", label: item.name, children }] : children,
      };
    });

    return (
      <div className="flex flex-col h-full min-h-0">
        <div className={`sidebar-brand flex items-center shrink-0 ${isRail ? "justify-center" : "gap-3 px-5"}`}>
          {isRail ? (
            <span className="sidebar-monogram" aria-label="CBK Beauty">C</span>
          ) : (
            <div>
              <h1 className="text-base font-semibold leading-none text-white" style={{ fontFamily: "'Playfair Display',serif" }}>CBK Beauty</h1>
              <p className="text-[10px] mt-1 tracking-[0.28em] uppercase text-[#BBA14F]">Dashboard</p>
            </div>
          )}
          {isMobile && (
            <button aria-label="Close navigation" className="sidebar-control ml-auto flex items-center justify-center w-11 h-11 shrink-0" onClick={() => setMobileOpen(false)}>
              <FiX size={18} />
            </button>
          )}
        </div>

        <nav
          aria-label="Main navigation"
          className="sidebar-scroll flex-1 min-h-0 overflow-y-auto py-3"
          onPointerEnter={(event) => setTouchNavigation(event.pointerType !== "mouse")}
          onPointerDown={(event) => setTouchNavigation(event.pointerType !== "mouse")}
        >
          <Menu
            id={isMobile ? "mobile-sidebar-menu" : "desktop-sidebar-menu"}
            key={isRail ? "rail" : "expanded"}
            className="sidebar-menu"
            classNames={{ popup: { root: "sidebar-flyout" } }}
            mode="inline"
            theme="dark"
            inlineCollapsed={isRail}
            inlineIndent={18}
            selectedKeys={selectedItem ? [selectedItem.path] : []}
            defaultOpenKeys={!isRail && activeGroup ? [activeGroup.name] : []}
            subMenuOpenDelay={0.1}
            subMenuCloseDelay={0.25}
            triggerSubMenuAction={touchNavigation ? "click" : "hover"}
            tooltip={{ placement: "right", trigger: ["hover", "focus"], color: "#27241e" }}
            items={items}
            onClick={({ key, domEvent }) => {
              // Links retain native modifier-click behavior; the rest of the row also navigates.
              if (!domEvent.target.closest("a")) navigate(key);
              if (isMobile) setMobileOpen(false);
            }}
          />
        </nav>

        <div className={`sidebar-footer shrink-0 py-4 ${isRail ? "px-2.5" : "px-3"}`}>
          <Tooltip title={isRail ? "Logout" : ""} placement="right" trigger={["hover", "focus"]} color="#27241e">
            <button
              aria-label="Logout"
              disabled={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate(localStorage.getItem("refresh"))}
              className={`sidebar-control flex items-center w-full h-11 rounded-xl hover:bg-white/10 ${isRail ? "justify-center" : "px-4 gap-3"}`}
            >
              {logoutMutation.isPending ? (
                <Spin indicator={<LoadingOutlined spin style={{ color: "#BBA14F" }} />} size="small" />
              ) : <FiLogOut size={18} />}
              {!isRail && <span className="text-sm">Logout</span>}
            </button>
          </Tooltip>
        </div>
      </div>
    );
  };

  return (
    <ConfigProvider theme={sidebarTheme}>
      {!screens.md && <button
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        aria-controls="mobile-navigation"
        className="sidebar-mobile-toggle fixed z-40 flex items-center justify-center w-11 h-11 rounded-full shadow-lg cursor-pointer"
        onClick={() => setMobileOpen(true)}
      >
        <FiMenu size={16} />
      </button>}
      <Drawer
        id="mobile-navigation"
        aria-label="Navigation"
        placement="left"
        size="min(320px, calc(100vw - 24px))"
        open={mobileOpen && !screens.xl}
        onClose={() => setMobileOpen(false)}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          // Wrap at the portal boundaries before Tab can move into browser chrome.
          const controls = [...event.currentTarget.querySelectorAll("button, a[href], [tabindex]")]
            .filter((element) => element.tabIndex >= 0 && !element.disabled && element.getClientRects().length);
          const first = controls[0];
          const last = controls.at(-1);
          if ((event.shiftKey && event.target === first) || (!event.shiftKey && event.target === last)) {
            event.preventDefault();
            (event.shiftKey ? last : first)?.focus();
          }
        }}
        afterOpenChange={(open) => { if (!open) setMobileOpen(false); }}
        closeIcon={false}
        destroyOnHidden
        classNames={{ root: "sidebar-drawer" }}
        styles={{ body: { padding: 0, overflow: "hidden" } }}
      >
        <div className="salon-sidebar h-full">{renderSidebarContent(true)}</div>
      </Drawer>
      {screens.md && <aside
        aria-label="Sidebar"
        className="salon-sidebar flex flex-col sticky top-0 h-dvh shrink-0 z-40 transition-[width] duration-200 motion-reduce:transition-none"
        style={{ width: railCollapsed ? 64 : 260 }}
      >
        {renderSidebarContent()}
        <button
          aria-label={screens.xl ? (collapsed ? "Expand sidebar" : "Collapse sidebar") : "Open navigation"}
          aria-expanded={screens.xl ? !collapsed : mobileOpen}
          aria-controls={screens.xl ? "desktop-sidebar-menu" : "mobile-navigation"}
          onClick={() => screens.xl ? setCollapsed((value) => !value) : setMobileOpen(true)}
          className="sidebar-toggle absolute -right-3.5 top-[66px] w-7 h-7 cursor-pointer rounded-full flex items-center justify-center shadow-lg z-50"
        >
          {railCollapsed ? <FiChevronRight size={13} /> : <FiChevronLeft size={13} />}
        </button>
      </aside>}
    </ConfigProvider>
  );
};

export default Sidebar;
