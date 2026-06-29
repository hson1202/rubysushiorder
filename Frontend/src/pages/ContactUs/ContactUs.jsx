import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import config from '../../config/config'
import useRestaurantInfo from '../../hooks/useRestaurantInfo'
import { formatWeeklyHoursDisplay, normalizeWeeklyHours } from '../../utils/restaurantHours'
import './ContactUs.css'
// Load all hero images at once using Vite glob import
// You can place hero images in `src/assets/` and select by file name
const HERO_IMAGES = import.meta.glob('../../assets/*.{jpg,jpeg,png,webp}', { eager: true, as: 'url' })

const ContactUs = () => {
  const { t, i18n } = useTranslation()
  const { restaurantInfo, loading: infoLoading } = useRestaurantInfo()
  // Removed reservation tab - now separate page
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })

  // Contact form states
  const [contactLoading, setContactLoading] = useState(false)
  const [contactErrors, setContactErrors] = useState({})
  const [contactSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({
      ...formData,
      [name]: value
    })
    
    // Clear error when user starts typing
    if (contactErrors[name]) {
      setContactErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }



  // Client-side validation for contact form
  const validateContactForm = () => {
    const errors = {}
    
    if (!formData.name.trim()) {
      errors.name = t('contact.form.validation.nameRequired')
    } else if (formData.name.trim().length < 2) {
      errors.name = t('contact.form.validation.nameMinLength')
    }
    
    if (!formData.email.trim()) {
      errors.email = t('contact.form.validation.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = t('contact.form.validation.emailInvalid')
    }
    
    if (!formData.subject) {
      errors.subject = t('contact.form.validation.subjectRequired')
    }
    
    if (!formData.message.trim()) {
      errors.message = t('contact.form.validation.messageRequired')
    } else if (formData.message.trim().length < 10) {
      errors.message = t('contact.form.validation.messageMinLength')
    }
    
    return errors
  }



  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validate form
    const errors = validateContactForm()
    if (Object.keys(errors).length > 0) {
      setContactErrors(errors)
      return
    }

    try {
      setContactLoading(true)
      setContactErrors({})
      
      const response = await fetch(`${config.BACKEND_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to send message')
      }

      const result = await response.json()
      
      if (result.success) {
        setContactSuccess(true)
        // Reset form
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        })
        
        // Reset success message after 5 seconds
        setTimeout(() => {
          setContactSuccess(false)
        }, 5000)
      }
    } catch (error) {
      console.error('Error sending message:', error)
      setContactErrors({ general: error.message })
    } finally {
      setContactLoading(false)
    }
  }







  return (
    <div className="contact-page">
      {/* Hero Section */}
      <div className="contact-hero">
        <div className="hero-background">
          <img 
            src={
              HERO_IMAGES['../../assets/back8.jpg'] 
              ?? HERO_IMAGES['../../assets/header_img.png'] 
              ?? Object.values(HERO_IMAGES)[0]
            }
            alt="Menu background"
            className="hero-bg-image"
          />
        </div>
        <div className="hero-content">
          <h1>{t('contact.hero.title')}</h1>
          <p>{t('contact.hero.subtitle')}</p>
        </div>
      </div>



      {/* Contact Content */}
      <div className="contact-content">
        <div className="container">

            <div className="contact-grid">
              {/* Contact Information */}
              <div className="contact-info">
                <h2>{t('contact.getInTouch.title')}</h2>
                <p>{t('contact.getInTouch.subtitle')}</p>
                
                <div className="info-items">
                  <div className="info-item">
                    <div className="info-icon">📍</div>
                    <div className="info-content">
                      <h3>{t('contact.address.title')}</h3>
                      <p>
                        {infoLoading 
                          ? '...' 
                          : restaurantInfo?.address || t('contact.address.content')
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-icon">📞</div>
                    <div className="info-content">
                      <h3>{t('contact.phone.title')}</h3>
                      <p>
                        {infoLoading 
                          ? '...' 
                          : restaurantInfo?.phone || t('contact.phone.content')
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-icon">✉️</div>
                    <div className="info-content">
                      <h3>{t('contact.email.title')}</h3>
                      <p>
                        {infoLoading 
                          ? '...' 
                          : restaurantInfo?.email || t('contact.email.content')
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="info-item">
                    <div className="info-icon">🕒</div>
                    <div className="info-content">
                      <h3>{t('contact.openingHours')}</h3>
                      <p>
                        {infoLoading ? '...' : (
                          restaurantInfo?.weeklyHours?.length === 7
                            ? formatWeeklyHoursDisplay(
                                normalizeWeeklyHours(restaurantInfo.weeklyHours),
                                (i18n.language || 'vi').split('-')[0]
                              )
                            : (
                              <>
                                {restaurantInfo?.openingHours?.weekdays || t('contact.weekdays')}
                                <br />
                                {restaurantInfo?.openingHours?.sunday || t('contact.sunday')}
                              </>
                            )
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Form */}
              <div className="contact-form">
                <h2>{t('contact.form.title')}</h2>
                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="name">{t('contact.form.fullName')}</label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder={t('contact.form.fullNamePlaceholder')}
                      className={contactErrors.name ? 'error' : ''}
                    />
                    {contactErrors.name && (
                      <span className="error-text">{contactErrors.name}</span>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="email">{t('contact.form.emailAddress')}</label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder={t('contact.form.emailPlaceholder')}
                      className={contactErrors.email ? 'error' : ''}
                    />
                    {contactErrors.email && (
                      <span className="error-text">{contactErrors.email}</span>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="subject">{t('contact.form.subject')}</label>
                    <select
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                      className={contactErrors.subject ? 'error' : ''}
                    >
                      <option value="">{t('contact.form.selectSubject')}</option>
                      <option value="general">{t('contact.form.generalInquiry')}</option>
                      <option value="reservation">{t('contact.form.reservation')}</option>
                      <option value="feedback">{t('contact.form.feedback')}</option>
                      <option value="complaint">{t('contact.form.complaint')}</option>
                      <option value="partnership">{t('contact.form.partnership')}</option>
                      <option value="other">{t('contact.form.other')}</option>
                    </select>
                    {contactErrors.subject && (
                      <span className="error-text">{contactErrors.subject}</span>
                    )}
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="message">{t('contact.form.message')}</label>
                    <textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows="5"
                      placeholder={t('contact.form.messagePlaceholder')}
                      className={contactErrors.message ? 'error' : ''}
                    ></textarea>
                    {contactErrors.message && (
                      <span className="error-text">{contactErrors.message}</span>
                    )}
                  </div>
                  
                  <button type="submit" className="submit-btn" disabled={contactLoading}>
                    {contactLoading ? t('contact.form.sendingMessage') : t('contact.form.sendMessage')}
                  </button>

                  {/* Success Message */}
                  {contactSuccess && (
                    <div className="success-message">
                      <div className="success-icon">✅</div>
                      <div className="success-content">
                        <h3>{t('contact.form.success.title')}</h3>
                        <p>{t('contact.form.success.message')}</p>
                        <p className="email-note">
                          <small>📧 Note: Email confirmation is temporarily unavailable. We'll respond to your message soon.</small>
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {contactErrors.general && (
                    <div className="error-message">
                      <div className="error-icon">❌</div>
                      <div className="error-content">
                        <p>{contactErrors.general}</p>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            </div>

        </div>
      </div>

      {/* Map Section */}
      <div className="map-section">
        <div className="container">
          <h2>{t('contact.map.title')}</h2>
          <div className="map-container">
            {infoLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading map...</div>
            ) : restaurantInfo?.googleMapsUrl ? (
              <iframe
                src={restaurantInfo.googleMapsUrl}
                width="100%"
                height="450"
                style={{border:0}}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`${restaurantInfo.restaurantName || 'Restaurant'} Location`}
              ></iframe>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                {t('contact.map.notConfigured', 'Map not configured yet.')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="faq-section">
        <div className="container">
          <h2>{t('contact.faq.title')}</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3>{t('contact.faq.delivery.question')}</h3>
              <p>{t('contact.faq.delivery.answer')}</p>
            </div>
            
            <div className="faq-item">
              <h3>{t('contact.faq.reservation.question')}</h3>
              <p>{t('contact.faq.reservation.answer')}</p>
            </div>
            
            <div className="faq-item">
              <h3>{t('contact.faq.dietary.question')}</h3>
              <p>{t('contact.faq.dietary.answer')}</p>
            </div>
            
            <div className="faq-item">
              <h3>{t('contact.faq.covid.question')}</h3>
              <p>{t('contact.faq.covid.answer')}</p>
            </div>
            
            <div className="faq-item">
              <h3>{t('contact.faq.catering.question')}</h3>
              <p>{t('contact.faq.catering.answer')}</p>
            </div>
            
            <div className="faq-item">
              <h3>{t('contact.faq.payment.question')}</h3>
              <p>{t('contact.faq.payment.answer')}</p>
            </div>
          </div>
        </div>
      </div>
      {/* Floating Cart Button is now handled globally in App.jsx */}
    </div>
  )
}

export default ContactUs 