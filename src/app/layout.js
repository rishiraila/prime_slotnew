'use client';
import { usePathname } from 'next/navigation';
import Script from "next/script";
import Sidebar from "./components/sidebar";
import Navbar from "./components/navbar";

// NOTE: metadata object is removed as this is now a client component.
// You can manage titles and metadata on a per-page basis.

export default function RootLayout({ children }) {
  const pathname = usePathname();

  // List of routes where the Sidebar and Navbar should NOT be displayed
  const isAuthPage = [
    "/adminlogin",
    "/signup",
    "/forgot",
    "/privacy",
    "/shipping-delivery",
    "/terms",
    "/contact",
    "/cancellation-refund"
  ].includes(pathname?.toLowerCase() || "");

  return (
    <html lang="en">
      <head>
        {/* Favicon */}
        <link rel="icon" type="image/x-icon" href="/assets/img/favicon/favicon.ico" />
 
        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&ampdisplay=swap"
          rel="stylesheet"
        />
 
        {/* Icons */}
        <link rel="stylesheet" href="/assets/vendor/fonts/remixicon/remixicon.css" />
        <link rel="stylesheet" href="/assets/vendor/fonts/flag-icons.css" />
 
        {/* Core CSS */}
        <link rel="stylesheet" href="/assets/vendor/css/rtl/core.css" className="template-customizer-core-css" />
        <link rel="stylesheet" href="/assets/vendor/css/rtl/theme-default.css" className="template-customizer-theme-css" />
        <link rel="stylesheet" href="/assets/css/demo.css" />
 
        {/* Vendors CSS */}
        <link rel="stylesheet" href="/assets/vendor/libs/perfect-scrollbar/perfect-scrollbar.css" />
        <link rel="stylesheet" href="/assets/vendor/libs/typeahead-js/typeahead.css" />
        <link rel="stylesheet" href="/assets/vendor/libs/node-waves/node-waves.css" />
        <link rel="stylesheet" href="/assets/vendor/libs/@form-validation/form-validation.css" />
 
        {/* Page CSS */}
        <link rel="stylesheet" href="/assets/vendor/css/pages/page-auth.css" />
      </head>
      <body>
        {isAuthPage ? (
          <>{children}</>
        ) : (
          <div className="layout-wrapper layout-content-navbar">
            <div className="layout-container">
              <Sidebar />
              <div className="layout-page">
                <Navbar />
                <div className="content-wrapper">
                  {children}
                </div>
              </div>
            </div>
          </div>
        )}
 
        <Script src="/assets/vendor/js/helpers.js" strategy="beforeInteractive" />
        <Script src="/assets/js/config.js" strategy="beforeInteractive" />
 
        <Script src="/assets/vendor/libs/jquery/jquery.js"></Script>
        <Script src="/assets/vendor/libs/popper/popper.js"></Script>
        <Script src="/assets/vendor/js/bootstrap.js"></Script>
        <Script src="/assets/vendor/libs/perfect-scrollbar/perfect-scrollbar.js"></Script>
        <Script src="/assets/vendor/libs/node-waves/node-waves.js" />
        <Script src="/assets/vendor/libs/typeahead-js/typeahead.js" />
        <Script src="/assets/vendor/js/menu.js"></Script>
        <Script src="/assets/js/main.js"></Script>
      </body>
    </html>
  );
}
