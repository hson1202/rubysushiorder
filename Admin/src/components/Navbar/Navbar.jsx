import React, { useState } from 'react'
import './Navbar.css'
import { assets } from '../../assets/assets'
import LanguageSwitcher from '../LanguageSwitcher/LanguageSwitcher'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useRestaurantBranding from '../../hooks/useRestaurantBranding'
import '../../i18n'

const Navbar = ({ setIsAuthenticated, onMenuToggle, isSidebarOpen }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { restaurantName, logoUrl } = useRestaurantBranding();
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminUser');
    setIsAuthenticated(false);
    navigate('/admin/login');
  };

  return (
    <div className="navbar-container">
      <div className="navbar-start">
        <button
          className="menu-button"
          onClick={onMenuToggle}
          aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
        {(logoUrl || restaurantName) && (
          <div className="navbar-brand">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={restaurantName || 'Restaurant'}
                className="navbar-brand-logo"
              />
            )}
            {restaurantName && (
              <span className="navbar-brand-name">{restaurantName}</span>
            )}
          </div>
        )}
      </div>

      <div className="navbar-end">
        <div className="navbar-item">
          <LanguageSwitcher />
        </div>

        <div className="navbar-item user-profile">
          <div
            className="profile-trigger"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <img className='profile-avatar' src={assets.profile_image} alt="User" />
            <span className="profile-name">Admin</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          {showProfileMenu && (
            <>
              <div
                className="profile-menu-overlay"
                onClick={() => setShowProfileMenu(false)}
              />
              <div className="profile-dropdown">
                <button onClick={handleLogout} className="dropdown-item danger">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  {t('nav.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Navbar