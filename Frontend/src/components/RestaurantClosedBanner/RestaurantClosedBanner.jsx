import React, { useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { StoreContext } from '../../Context/StoreContext'
import './RestaurantClosedBanner.css'

const RestaurantClosedBanner = () => {
  const { restaurantOpenStatus, restaurantInfoLoading } = useContext(StoreContext)
  const { t } = useTranslation()

  if (restaurantInfoLoading || !restaurantOpenStatus || restaurantOpenStatus.isOpen) {
    return null
  }

  return (
    <div className="restaurant-closed-banner" role="alert">
      <span className="restaurant-closed-icon">🕐</span>
      <span className="restaurant-closed-text">
        {restaurantOpenStatus.message || t('restaurant.closedNow')}
      </span>
    </div>
  )
}

export default RestaurantClosedBanner
