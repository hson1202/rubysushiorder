import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import 'flag-icons/css/flag-icons.min.css';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    setIsOpen(false);
  };

  const getCurrentLanguageDisplay = () => {
    switch (i18n.language) {
      case 'vi': return { flag: 'fi fi-vn', code: 'VI', name: t('language.vietnamese') };
      case 'en': return { flag: 'fi fi-us', code: 'EN', name: t('language.english') };
      case 'hu': return { flag: 'fi fi-hu', code: 'HU', name: t('language.hungarian') };
      default: return { flag: 'fi fi-hu', code: 'HU', name: t('language.hungarian') };
    }
  };

  const currentLang = getCurrentLanguageDisplay();

  return (
    <div className="language-switcher">
      <button 
        className="language-button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      >
        <span className={currentLang.flag}></span>
        <span className="language-code">{currentLang.code}</span>
      </button>
      
      {isOpen && (
        <div className="language-dropdown">
          <div className="language-dropdown-inner">
            <div className="language-dropdown-header">
              <span className="language-dropdown-title">Language</span>
              <span className="language-dropdown-subtitle">Choose display language</span>
            </div>

            <div className="language-dropdown-divider" />

            <div className="language-options-list">
              <button
                className={`language-option ${i18n.language === 'hu' ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  changeLanguage('hu');
                }}
              >
                <span className="fi fi-hu"></span>
                <span className="language-option-text">
                  <span className="language-name">{t('language.hungarian')}</span>
                  <span className="language-meta">Magyar</span>
                </span>
                {i18n.language === 'hu' && <span className="language-current-dot" />}
              </button>

              <button
                className={`language-option ${i18n.language === 'en' ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  changeLanguage('en');
                }}
              >
                <span className="fi fi-us"></span>
                <span className="language-option-text">
                  <span className="language-name">{t('language.english')}</span>
                  <span className="language-meta">English</span>
                </span>
                {i18n.language === 'en' && <span className="language-current-dot" />}
              </button>

              <button
                className={`language-option ${i18n.language === 'vi' ? 'active' : ''}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  changeLanguage('vi');
                }}
              >
                <span className="fi fi-vn"></span>
                <span className="language-option-text">
                  <span className="language-name">{t('language.vietnamese')}</span>
                  <span className="language-meta">Tiếng Việt</span>
                </span>
                {i18n.language === 'vi' && <span className="language-current-dot" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LanguageSwitcher;