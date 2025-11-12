"use client";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    { href: "/Dashboard", icon: "ri-dashboard-line", label: "Dashboard" },
    { href: "/Events", icon: "ri-calendar-event-line", label: "Events" },
    { href: "/ImportMembers", icon: "ri-user-add-line", label: "Import Members" },
    { href: "/UsersInfo", icon: "ri-user-settings-line", label: "Users Info" },
    { href: "/Meetings", icon: "ri-video-chat-line", label: "Meetings" },
    { href: "/Notifications", icon: "ri-notification-3-line", label: "Notification Settings" },
];

  const [openMenus, setOpenMenus] = useState({});

  useEffect(() => {
    // On pathname change, open the submenu that matches the current path
    const newOpenMenus = {};
    menuItems.forEach(item => {
      if (item.submenu) {
        const isOpen = item.submenu.some(sub => pathname.startsWith(sub.href));
        newOpenMenus[item.label] = isOpen;
      }
    });
    setOpenMenus(newOpenMenus);
  }, [pathname]);

  const toggleMenu = (label) => {
    setOpenMenus(prev => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  return (
    <aside
      id="layout-menu"
      className="layout-menu menu-vertical menu bg-menu-theme"
    >
      <div className="app-brand demo">
        {/* <Link href="/" className="app-brand-link">
          <span className="app-brand-logo demo mt-2 mb-4">
            <img
              src="/flowlogo.svg"
              alt="Flow Logo"
              width="70"
              height="50"
            />
          </span>
          <span className="app-brand-logo demo mb-3 ">
             <img
              src="/flowname.svg"
              alt="Flow Logo"
              width="90"
              height="80"
            />
          </span>
        </Link> */}
        <a href="#" className="layout-menu-toggle menu-link text-large ms-auto" onClick={(e) => e.preventDefault()}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* SVG paths... */}
          </svg>
        </a>
      </div>

      <div className="menu-inner-shadow"></div>

      <ul className="menu-inner py-1 mt-1">
        {menuItems.map((item) => {
          if (item.submenu) {
            return (
              <li
                key={item.label}
                className={`menu-item ${openMenus[item.label] ? "active open" : ""}`}
              >
                <a href="#" className="menu-link menu-toggle" onClick={(e) => { e.preventDefault(); toggleMenu(item.label); }}>
                  <i className={`menu-icon tf-icons ${item.icon}`}></i>
                  <div>{item.label}</div>
                </a>
                <ul className="menu-sub">
                  {item.submenu.map((sub) => (
                    <li
                      key={sub.href}
                      className={`menu-item${pathname === sub.href ? " active" : ""}`}
                    >
                      <a className="menu-link" onClick={() => router.push(sub.href)}>
                        <div>{sub.label}</div>
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            );
          }

          return (
            <li
              key={item.href}
              className={`menu-item${pathname.startsWith(item.href) ? " active" : ""}`}
            >
              <Link href={item.href} className="menu-link">
                <i className={`menu-icon tf-icons ${item.icon}`}></i>
                <div>{item.label}</div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
