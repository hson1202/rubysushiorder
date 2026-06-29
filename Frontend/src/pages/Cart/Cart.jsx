import React, { useContext } from 'react'
import './Cart.css'
import {StoreContext} from '../../Context/StoreContext'
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatHuf } from '../../utils/currency';
import { formatProductDisplayName } from '../../utils/productDisplay';



const Cart = () => {


  const {cartItems,food_list,removeFromCart,getTotalCartAmount,url,boxFee}=useContext(StoreContext);
  const navigate= useNavigate();
  const { t } = useTranslation();

  const formatPrice = (price) => formatHuf(price);

  // Helper function to check if box fee is disabled for an item
  const isBoxFeeDisabled = (item) => {
    return item.disableBoxFee === true || 
           item.disableBoxFee === "true" || 
           item.disableBoxFee === 1 || 
           item.disableBoxFee === "1" ||
           (typeof item.disableBoxFee === 'string' && item.disableBoxFee.toLowerCase() === 'true');
  }

  // Check if any item in cart requires box fee
  const hasItemsWithBoxFee = () => {
    return food_list.some(item => {
      if (cartItems[item._id] > 0) {
        return !isBoxFeeDisabled(item);
      }
      return false;
    });
  }

  return (
    <div className='cart'>
      <div className="cart-items">
        <div className="cart-items-title">
          <p>Items</p>
          <p>Title</p>
          <p>Price</p>
          <p>Quantity</p>
          <p>Total</p>
          <p>Remove</p>
        </div>
        <br></br>
        <hr></hr>
        {food_list.map((item,index)=>{
          if(cartItems[item._id]>0)
            {
              return(
                <div>

                  <div className="cart-items-title  cart-items-item">
                  <div className="cart-item-thumb food-image-container">
                    <img src={(item.image && item.image.startsWith('http')) ? item.image : (url+"/images/"+item.image)} alt=''/>
                  </div>
                  <p>{formatProductDisplayName(item)}</p>
                  <p>{formatPrice(item.isPromotion && item.promotionPrice ? item.promotionPrice : item.price)}</p>
                  <p>{cartItems[item._id]}</p>
                  <p>{formatPrice((item.isPromotion && item.promotionPrice ? item.promotionPrice : item.price)*cartItems[item._id])}</p>
                  <p onClick={()=>removeFromCart(item._id)} className='cross'>x</p>
                </div>
                <hr/>
                </div>
              )
            }
        })}
      </div>
      <div className="cart-bottom">
        <div className="cart-total">
          <h2>Cart Totals</h2>
          <div>
            <div className='cart-total-details'>
              <p>Subtotal</p>
              <p>{formatPrice(getTotalCartAmount())}</p>
            </div>
            {hasItemsWithBoxFee() && (
              <div className='cart-total-details box-fee-note'>
                <p className="box-fee-text">{t('cart.boxFeeNote', { boxFee: formatPrice(boxFee) })}</p>
              </div>
            )}
            <hr/>
            <div className='cart-total-details'>
              <p>Delivery Fee</p>
              <p>{formatPrice(getTotalCartAmount()===0?0:2)}</p>
            </div>
            <hr/>
            <div className='cart-total-details'>
              <b>Total</b>
              <b>{formatPrice(getTotalCartAmount()===0?0: getTotalCartAmount()+2)}</b>
            </div>
          </div>
            <button onClick={()=>navigate('/order')}>PROCEED TO CHECKOUT</button>
        </div>
        <div className='cart-promocode'>
          <div>
            <p>If you have a promo code,Enter it here</p>
            <div className='cart-promocode-input'>
              <input type='text' placeholder='Promo-code'/>
              <button>Submit</button>
            </div>
          </div>
        </div>
      </div>
      {/* Floating Cart Button is now handled globally in App.jsx */}
    </div>
  )
}

export default Cart;