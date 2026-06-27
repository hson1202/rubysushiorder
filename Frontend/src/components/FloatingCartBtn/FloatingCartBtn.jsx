import React, { useContext, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { StoreContext } from '../../Context/StoreContext'
import CartPopup from '../CartPopup/CartPopup'
import { formatHuf } from '../../utils/currency'
import './FloatingCartBtn.css'

const FloatingCartBtn = () => {
  const { cartItems, getTotalCartAmount, isMobileMenuOpen } = useContext(StoreContext)
  const [showCartPopup, setShowCartPopup] = useState(false)
  const location = useLocation()
  
  // Ẩn button khi đang ở trang order
  const isOnOrderPage = location.pathname === '/order'

  const getTotalCartItems = () => {
    let totalItems = 0
    for (const item in cartItems) {
      if (cartItems[item] > 0) {
        totalItems += cartItems[item]
      }
    }
    return totalItems
  }

  const handleCartClick = () => {
    setShowCartPopup(true)
  }

  const closeCartPopup = () => {
    setShowCartPopup(false)
  }

  const formatPrice = (price) => formatHuf(price);

  // Chỉ hiển thị khi có items trong cart, mobile menu không mở, và không ở trang order
  if (getTotalCartItems() === 0 || isOnOrderPage) {
    return null
  }

  return (
    <>
      <button 
        className={`floating-cart-btn ${showCartPopup ? 'cart-popup-open' : ''}`}
        onClick={handleCartClick}
      >
        <div className="cart-icon">
          🛒
        </div>
        <div className="cart-info">
          <span className="cart-count">{getTotalCartItems()}</span>
          <span className="cart-total">{formatPrice(getTotalCartAmount())}</span>
        </div>
      </button>

      {/* Cart Popup */}
      {showCartPopup && (
        <CartPopup 
          onClose={closeCartPopup}
        />
      )}
    </>
  )
}

export default FloatingCartBtn
