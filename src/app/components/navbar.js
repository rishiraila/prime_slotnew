'use client';
import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = async (e) => {
    e.preventDefault();
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }
    router.replace('/AdminLogin');
  };

  return (
    <nav
      className="layout-navbar container-xxl navbar navbar-expand-xl navbar-detached align-items-center bg-navbar-theme"
      id="layout-navbar"
    >
      <div className="layout-menu-toggle navbar-nav align-items-xl-center me-4 me-xl-0 d-xl-none">
        <a
          className="nav-item nav-link px-0 me-xl-6"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          <i className="ri-menu-fill ri-22px"></i>
        </a>
      </div>

      <div
        className="navbar-nav-right d-flex align-items-center"
        id="navbar-collapse"
      >
        {/* Search */}
        <div className="navbar-nav align-items-center">
          <div className="nav-item navbar-search-wrapper mb-0">
            <a
              className="nav-item nav-link search-toggler fw-normal px-0"
              href="#"
              onClick={(e) => e.preventDefault()}
            >
              <i className="ri-search-line ri-22px scaleX-n1-rtl me-3"></i>
              <span className="d-none d-md-inline-block text-muted">
                Search (Ctrl+/)
              </span>
            </a>
          </div>
        </div>
        {/* /Search */}

        <ul className="navbar-nav flex-row align-items-center ms-auto">
          {/* User Menu */}
          <li className="nav-item dropdown">
            <a
              className="nav-link dropdown-toggle hide-arrow"
              href="#"
              data-bs-toggle="dropdown"
              onClick={(e) => e.preventDefault()}
            >
              <div className="avatar avatar-online">
                <Image
                  src="/assets/img/avatars/1.png"
                  alt="Avatar"
                  className="rounded-circle"
                  width={40}
                  height={40}
                />
              </div>
            </a>
            <ul className="dropdown-menu dropdown-menu-end">
              <li>
                <a className="dropdown-item" href="#">
                  <div className="d-flex">
                    <div className="flex-shrink-0 me-2">
                      <div className="avatar avatar-online">
                        <Image
                          src="/assets/img/avatars/1.png"
                          alt="Avatar"
                          className="rounded-circle"
                          width={40}
                          height={40}
                        />
                      </div>
                    </div>
                    <div className="flex-grow-1">
                      <small className="text-muted">Admin</small>
                    </div>
                  </div>
                </a>
              </li>
              <li>
                <div className="dropdown-divider"></div>
              </li>
              <li>
                <div className="d-grid px-4 pt-2 pb-1">
                  <a className="btn btn-sm btn-danger d-flex" href="#" onClick={handleLogout}>
                    <small className="align-middle">Logout</small>
                  </a>
                </div>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  );
}