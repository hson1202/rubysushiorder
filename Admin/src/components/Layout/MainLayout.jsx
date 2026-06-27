import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar/Navbar';
import Sidebar from '../Sidebar/Sidebar';
import './MainLayout.css';

const TABLET_BREAKPOINT = '(max-width: 1024px)';

const isTabletOrMobile = () => window.matchMedia(TABLET_BREAKPOINT).matches;

const MainLayout = ({ children, setIsAuthenticated }) => {
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !isTabletOrMobile();
  });

  useEffect(() => {
    const savedSidebarState = localStorage.getItem('sidebarOpen');
    if (isTabletOrMobile()) {
      setSidebarOpen(false);
    } else if (savedSidebarState !== null) {
      setSidebarOpen(savedSidebarState === 'true');
    }
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(TABLET_BREAKPOINT);
    const handleBreakpointChange = (event) => {
      if (event.matches) {
        setSidebarOpen(false);
      }
    };

    mediaQuery.addEventListener('change', handleBreakpointChange);
    return () => mediaQuery.removeEventListener('change', handleBreakpointChange);
  }, []);

  useEffect(() => {
    const handleKeyboard = (event) => {
      if (event.key === 'Escape' && sidebarOpen) {
        setSidebarOpen(false);
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'b') {
        event.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyboard);
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [sidebarOpen]);

  useEffect(() => {
    const updateBodyScrollLock = () => {
      const shouldLock = sidebarOpen && isTabletOrMobile();
      document.body.classList.toggle('sidebar-locked', shouldLock);
    };

    updateBodyScrollLock();
    window.addEventListener('resize', updateBodyScrollLock);

    return () => {
      document.body.classList.remove('sidebar-locked');
      window.removeEventListener('resize', updateBodyScrollLock);
    };
  }, [sidebarOpen]);

  const handleMenuToggle = () => {
    const newState = !sidebarOpen;
    setSidebarOpen(newState);
    if (!isTabletOrMobile()) {
      localStorage.setItem('sidebarOpen', newState.toString());
    }
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  return (
    <div className={`admin-layout ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <aside className="layout-sidebar">
        <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} />
      </aside>

      <div className="layout-content">
        <header className="layout-header">
          <Navbar
            setIsAuthenticated={setIsAuthenticated}
            onMenuToggle={handleMenuToggle}
            isSidebarOpen={sidebarOpen}
          />
        </header>

        <main className="layout-main">
          <div className="main-container">
            {children}
          </div>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="layout-overlay"
          onClick={handleSidebarClose}
          aria-hidden="true"
        />
      )}
    </div>
  );
};

export default MainLayout;
