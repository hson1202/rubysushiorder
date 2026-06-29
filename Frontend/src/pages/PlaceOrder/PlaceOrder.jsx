import { useState, useEffect, useContext } from 'react'
import './PlaceOrder.css'
import { StoreContext } from '../../Context/StoreContext'
import { useAuth } from '../../Context/AuthContext'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SuccessPopup from '../../components/SuccessPopup/SuccessPopup'
import DeliveryAddressInput from '../../components/DeliveryAddressInput/DeliveryAddressInput'
import DeliveryZoneDisplay from '../../components/DeliveryZoneDisplay/DeliveryZoneDisplay'
import '../../i18n'
import { formatHuf } from '../../utils/currency'
import { generateOrderTimeSlots, normalizeWeeklyHours } from '../../utils/restaurantHours'

const PlaceOrder = () => {
  const { t, i18n } = useTranslation();
  const { getTotalCartAmount, food_list, cartItems, cartItemsData, url, setCartItems, boxFee, restaurantInfo, restaurantOpenStatus } = useContext(StoreContext);
  const { token, isAuthenticated, user } = useAuth();
  const [data, setData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    note: "",
    preferredDeliveryTime: ""
  })
  const [orderType, setOrderType] = useState(isAuthenticated ? 'registered' : 'guest');
  const [fulfillmentType, setFulfillmentType] = useState('delivery');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [orderSuccessData, setOrderSuccessData] = useState({});
  
  // Delivery state
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [restaurantLocation, setRestaurantLocation] = useState(null);
  const [deliveryAddress, setDeliveryAddress] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  
  // User addresses state (for authenticated users)
  const [userAddresses, setUserAddresses] = useState([]);
  const [defaultAddressId, setDefaultAddressId] = useState(null);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [useManualAddress, setUseManualAddress] = useState(false); // Track if user wants to enter address manually

  const isDelivery = fulfillmentType === 'delivery';

  const formatPrice = (price) => formatHuf(price);

  // Helper function to check if box fee is disabled for an item
  const isBoxFeeDisabled = (item) => {
    return item.disableBoxFee === true || 
           item.disableBoxFee === "true" || 
           item.disableBoxFee === 1 || 
           item.disableBoxFee === "1" ||
           (typeof item.disableBoxFee === 'string' && item.disableBoxFee.toLowerCase() === 'true');
  }

  // Get cart items to check for box fee
  const getCartItemsForCheck = () => {
    const items = [];
    Object.entries(cartItems).forEach(([cartKey, quantity]) => {
      if (quantity > 0) {
        const actualProductId = cartKey.split('_')[0];
        const baseProduct = food_list.find(p => p._id === actualProductId);
        if (baseProduct) {
          const itemData = cartItemsData[cartKey] || {};
          items.push({
            ...baseProduct,
            ...itemData
          });
        }
      }
    });
    return items;
  }

  // Check if any item in cart requires box fee
  const hasItemsWithBoxFee = () => {
    const items = getCartItemsForCheck();
    return items.some(item => !isBoxFeeDisabled(item));
  }

  const onChangeHandler = (event) => {
    const name = event.target.name;
    const value = event.target.value;
    setData(data => ({ ...data, [name]: value }))
  }

  // Generate time slots within restaurant opening hours
  const generateTimeSlots = () => {
    const weeklyHours = normalizeWeeklyHours(restaurantInfo?.weeklyHours)
    return generateOrderTimeSlots(weeklyHours)
  }

  // Initialize time slots on mount and when restaurant hours change
  useEffect(() => {
    const slots = generateTimeSlots();
    setTimeSlots(slots);
    if (slots.length > 0) {
      setData(prev => ({ ...prev, preferredDeliveryTime: slots[0] }));
    } else {
      setData(prev => ({ ...prev, preferredDeliveryTime: '' }));
    }
  }, [restaurantInfo]);

  // Pre-fill user data if authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Split name into first and last name if available
      const nameParts = user.name ? user.name.split(' ') : [];
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setData(prev => ({
        ...prev,
        firstName: prev.firstName || firstName,
        lastName: prev.lastName || lastName,
        email: prev.email || user.email || '',
        phone: prev.phone || user.phone || ''
      }));
    }
  }, [isAuthenticated, user]);

  // Fetch user addresses if authenticated
  useEffect(() => {
    const fetchUserAddresses = async () => {
      if (isAuthenticated && token) {
        try {
          const response = await axios.get(url + '/api/user/addresses', {
            headers: { token }
          });
          
          if (response.data.success) {
            const addresses = response.data.data || [];
            setUserAddresses(addresses);
            setDefaultAddressId(response.data.defaultAddressId || null);
            
            // If user has addresses, set selected address to default
            if (addresses.length > 0) {
              const defaultAddr = addresses.find(addr => 
                addr._id === response.data.defaultAddressId || addr.isDefault
              ) || addresses[0];
              
              if (defaultAddr) {
                setSelectedAddressId(defaultAddr._id);
                // Set delivery address from default address for order submission
                setDeliveryAddress({
                  address: defaultAddr.street || '',
                  houseNumber: defaultAddr.houseNumber || '',
                  city: defaultAddr.city || '',
                  state: defaultAddr.state || '',
                  zipcode: defaultAddr.zipcode || '',
                  country: defaultAddr.country || '',
                  coordinates: defaultAddr.coordinates || null
                });
                
                // Pre-fill contact info from default address
                if (defaultAddr.fullName) {
                  const nameParts = defaultAddr.fullName.split(' ');
                  setData(prev => ({
                    ...prev,
                    firstName: prev.firstName || nameParts[0] || '',
                    lastName: prev.lastName || nameParts.slice(1).join(' ') || '',
                    phone: prev.phone || defaultAddr.phone || ''
                  }));
                }
                
                // Auto-calculate delivery fee for default address using full address string
                try {
                  const fullAddress = defaultAddr.street; // street is stored as full address
                  const calcResponse = await axios.post(url + '/api/delivery/calculate', {
                    address: fullAddress
                  });
                  
                  if (calcResponse.data.success) {
                    handleDeliveryCalculated(calcResponse.data.data);
                  } else {
                    setDeliveryInfo(null);
                  }
                } catch (error) {
                  console.error('Error calculating delivery for default address:', error);
                  setDeliveryInfo(null);
                }
                /* OLD IMPLEMENTATION – required coordinates, so it never ran for address-book addresses (no coords)
                if (defaultAddr.coordinates && restaurantLocation) {
                  try {
                    // Dùng đúng 1 dòng địa chỉ đã lưu (street đang đóng vai trò full address)
                    const fullAddress = defaultAddr.street;
                    const calcResponse = await axios.post(url + '/api/delivery/calculate', {
                      address: fullAddress,
                      latitude: defaultAddr.coordinates.lat || defaultAddr.coordinates.latitude,
                      longitude: defaultAddr.coordinates.lng || defaultAddr.coordinates.longitude
                    });
                    
                    if (calcResponse.data.success) {
                      handleDeliveryCalculated(calcResponse.data.data);
                    } else {
                      setDeliveryInfo(null);
                    }
                  } catch (error) {
                    console.error('Error calculating delivery for default address:', error);
                    setDeliveryInfo(null);
                  }
                }
                */
              }
            }
          }
        } catch (error) {
          console.error('Error fetching user addresses:', error);
          // Don't show error to user, just log it
          // User can still proceed with manual address entry
        }
      }
    };
    
    fetchUserAddresses();
  }, [isAuthenticated, token, url, restaurantLocation]);

  // Helper function to check if address has house number
  const hasHouseNumber = (address) => {
    if (!address) return false;
    // Regex để tìm số nhà: số đứng đầu hoặc sau ký tự đặc biệt
    const patterns = [
      /^\d+/,                    // Số ở đầu: "123 Main St"
      /\s\d+\s/,                 // Số giữa: "Street 123 Name"
      /\s\d+$/,                  // Số ở cuối: "Main Street 123"
      /\d+[a-zA-Z]?\s/,          // Số có thể kèm chữ: "123A Main St"
    ];
    return patterns.some(pattern => pattern.test(address));
  };

  const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Pick a clean street line for storing in order.address.street (avoid long geocoded strings / duplicates)
  const getStreetLineForOrder = () => {
    const streetFromComponents = (deliveryAddress?.street || '').trim();
    if (streetFromComponents) return streetFromComponents;

    const raw = (deliveryAddress?.address || '').trim();
    if (!raw) return '';

    // Try to strip noisy region fragments if present (e.g. "Region of Nitra")
    let s = raw.replace(/,\s*region of[^,]+/gi, '').replace(/\s+region of[^,]+/gi, '');

    // If we already store city/zip separately, remove them from the street line to avoid duplication in admin/email
    const city = (deliveryAddress?.city || '').trim();
    const zip = (deliveryAddress?.zipcode || deliveryAddress?.postalCode || '').toString().trim();
    if (city) {
      s = s.replace(new RegExp(`,\\s*${escapeRegExp(city)}\\b`, 'gi'), '');
      s = s.replace(new RegExp(`\\b${escapeRegExp(city)}\\b`, 'gi'), '');
    }
    if (zip) {
      s = s.replace(new RegExp(`,\\s*${escapeRegExp(zip)}\\b`, 'g'), '');
      s = s.replace(new RegExp(`\\b${escapeRegExp(zip)}\\b`, 'g'), '');
    }

    // Cleanup punctuation
    s = s.replace(/\s*,\s*/g, ', ').replace(/,{2,}/g, ',').replace(/^,|,$/g, '').trim();

    // If stripping made it empty, fall back to the raw string
    return s || raw;
  };

  // Simple retry helper for transient errors (e.g., 502/503/network)
  const postWithRetry = async (endpoint, data, options, retries = 2, delayMs = 800) => {
    try {
      return await axios.post(endpoint, data, options)
    } catch (err) {
      const status = err.response?.status
      const isTransient = !status || (status >= 500 && status < 600)
      if (retries > 0 && isTransient) {
        await new Promise(r => setTimeout(r, delayMs))
        return postWithRetry(endpoint, data, options, retries - 1, delayMs * 1.5)
      }
      throw err
    }
  }

  const placeOrder = async (event) => {
    event.preventDefault();
    
    if (isSubmitting) return;

    if (restaurantOpenStatus && !restaurantOpenStatus.isOpen) {
      alert(restaurantOpenStatus.message || t('restaurant.closedNow'));
      return;
    }

    setIsSubmitting(true);
    
    if (isDelivery) {
      // Validate delivery address first (most important)
      if (!deliveryAddress || !deliveryAddress.address) {
        alert(t('placeOrder.errors.invalidAddress'));
        setIsSubmitting(false);
        return;
      }

      // Validate delivery zone - không cho phép đặt hàng nếu địa chỉ ngoài vùng giao hàng
      if (!deliveryInfo || !deliveryInfo.zone) {
        alert(t('placeOrder.errors.deliveryZoneNotAvailable'));
        setIsSubmitting(false);
        return;
      }
    }

    // ============================================
    // ✨ THÊM MỚI: Kiểm tra số nhà
    // ============================================
    if (isDelivery) {
      const addressHasNumber = hasHouseNumber(deliveryAddress.address);
      const hasManualHouseNumber = deliveryAddress.houseNumber && deliveryAddress.houseNumber.trim().length > 0;
      
      if (!addressHasNumber && !hasManualHouseNumber) {
        // Scroll đến ô số nhà và highlight
        const houseNumberInput = document.querySelector('.house-number-field input');
        if (houseNumberInput) {
          houseNumberInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          houseNumberInput.focus();
          houseNumberInput.classList.add('input-error-flash');
          setTimeout(() => {
            houseNumberInput.classList.remove('input-error-flash');
          }, 2000);
        }
        
        alert(t('placeOrder.errors.missingHouseNumber'));
        setIsSubmitting(false);
        return;
      }
    }

    // Validate required fields
    if (!data.firstName || !data.lastName || !data.phone) {
      alert(t('placeOrder.errors.requiredFields'));
      setIsSubmitting(false);
      return;
    }

    // Validate minimum order if delivery info is available
    if (isDelivery && deliveryInfo && deliveryInfo.zone) {
      const subtotal = getTotalCartAmount();
      const minOrder = deliveryInfo.zone.minOrder;
      
      if (subtotal < minOrder) {
        alert(t('placeOrder.errors.minOrderNotMet', {
          minOrder: formatPrice(minOrder),
          subtotal: formatPrice(subtotal),
          needed: formatPrice(minOrder - subtotal)
        }));
        setIsSubmitting(false);
        return;
      }
    }

    // Phone: chỉ cần có giá trị, chấp nhận ký tự + và các ký tự phổ biến
    
    // Build order items from cart, supporting option-suffixed IDs
    const orderItems = [];
    Object.entries(cartItems).forEach(([cartKey, quantity]) => {
      if (quantity > 0) {
        const actualProductId = cartKey.split('_')[0];
        const baseProduct = food_list.find(p => p._id === actualProductId);
        if (baseProduct) {
          const itemData = cartItemsData[cartKey] || {};
          const itemInfo = {
            ...baseProduct,
            ...itemData,
            quantity
          };
          orderItems.push(itemInfo);
        }
      }
    });

    // Check if cart is empty
    if (orderItems.length === 0) {
      alert(t('placeOrder.errors.emptyCart'));
      setIsSubmitting(false);
      return;
    }

    // Tạo thông tin khách hàng
    const customerInfo = {
      name: `${data.firstName} ${data.lastName}`,
      phone: data.phone,
      email: data.email || undefined
    };

    const deliveryFee = getDeliveryFee();
    
    let orderData = {
      address: isDelivery ? {
        // Store short street line (for admin/driver), keep full geocoded string separately for reference
        street: getStreetLineForOrder(),
        fullAddress: deliveryAddress.address,
        houseNumber: deliveryAddress.houseNumber || '',
        city: deliveryAddress.city || '',
        state: deliveryAddress.state || '',
        zipcode: deliveryAddress.zipcode || '',
        country: deliveryAddress.country || '',
        coordinates: deliveryAddress.coordinates
      } : null,
      items: orderItems,
      amount: getTotalCartAmount() + deliveryFee,
      customerInfo: customerInfo,
      orderType: isAuthenticated ? 'registered' : 'guest',
      fulfillmentType: fulfillmentType,
      language: i18n.language || 'hu',
      note: data.note || '',
      preferredDeliveryTime: data.preferredDeliveryTime || '',
      deliveryInfo: isDelivery && deliveryInfo ? {
        zone: deliveryInfo.zone.name,
        distance: deliveryInfo.distance,
        deliveryFee: deliveryInfo.zone.deliveryFee,
        estimatedTime: deliveryInfo.zone.estimatedTime
      } : null
    };

    // KHÔNG gán userId vào orderData - backend sẽ tự động lấy từ token nếu có

    try {
      console.log('Sending order data:', orderData);
      console.log('Token available:', !!token);
      
      let response = await postWithRetry(
        url + "/api/order/place",
        orderData,
        { headers: token ? { token } : {} },
        2,
        700
      )

      console.log('Response:', response.data);

      if (response.data.success) {
        const { trackingCode } = response.data;
        
        // Lưu mã tracking vào localStorage để hiển thị sau khi đặt hàng
        if (trackingCode) {
          localStorage.setItem('lastTrackingCode', trackingCode);
          localStorage.setItem('lastPhone', data.phone);
        }
        // Lưu snapshot items để khách xem lại ngay sau khi đặt
        try {
          localStorage.setItem('lastOrderItems', JSON.stringify(orderItems));
        } catch (error) {
          console.error('Error saving last order items:', error);
        }
        
        // Tính toán số tiền trước khi xóa cart
        const finalAmount = getTotalCartAmount() + getDeliveryFee();
        
        // Hiển thị popup thành công
        setOrderSuccessData({
          trackingCode: trackingCode,
          phone: data.phone,
          orderAmount: finalAmount,
          items: orderItems
        });
        
        setShowSuccessPopup(true);
        
        // Không xóa cart ngay lập tức, để popup hiển thị trước
        // Cart sẽ được xóa khi user đóng popup
      } else {
        // Avoid showing backend English messages directly; show translated, user-friendly errors.
        alert(t('placeOrder.errors.general'));
      }
    } catch (error) {
      console.error('Error placing order:', error);
      
      // Nếu lỗi 401 (Unauthorized) và có token, có thể token đã hết hạn
      // Thử lại như guest order
      if (error.response?.status === 401 && token) {
        console.log('⚠️ Token invalid or expired, retrying as guest order...');
        try {
          // Thử lại như guest order
          const guestOrderData = {
            ...orderData,
            orderType: 'guest'
          };
          
          const retryResponse = await postWithRetry(
            url + "/api/order/place",
            guestOrderData,
            { headers: {} },
            2,
            700
          )
          
          if (retryResponse.data.success) {
            const { trackingCode } = retryResponse.data;
            
            if (trackingCode) {
              localStorage.setItem('lastTrackingCode', trackingCode);
              localStorage.setItem('lastPhone', data.phone);
            }
            try {
              localStorage.setItem('lastOrderItems', JSON.stringify(orderItems));
            } catch (error) {
              console.error('Error saving last order items:', error);
            }
            
            const finalAmount = getTotalCartAmount() + getDeliveryFee();
            
            setOrderSuccessData({
              trackingCode: trackingCode,
              phone: data.phone,
              orderAmount: finalAmount,
              items: orderItems
            });
            
            setShowSuccessPopup(true);
            setIsSubmitting(false);
            return;
          }
        } catch (retryError) {
          console.error('Error retrying as guest:', retryError);
          // Fall through to show error message
        }
      }
      
      let errorMessage = t('placeOrder.errors.general');
      
      if (error.response) {
        // Server responded with error
        console.log('Error response:', error.response.data);
        const status = error.response.status;
        // Avoid showing backend English messages directly; show translated, user-friendly errors.
        errorMessage = status >= 500
          ? t('placeOrder.errors.serverError', { status })
          : t('placeOrder.errors.general');
      } else if (error.request) {
        // Network error
        errorMessage = t('placeOrder.errors.networkError');
      } else {
        // Other error
        errorMessage = error.message || t('placeOrder.errors.unknownError');
      }
      
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  const navigate = useNavigate();

  // Fetch restaurant location
  useEffect(() => {
    const fetchRestaurantLocation = async () => {
      try {
        const response = await axios.get(`${url}/api/delivery/restaurant-location`);
        if (response.data.success && response.data.data) {
          setRestaurantLocation(response.data.data);
        }
      } catch (error) {
        console.error('Error fetching restaurant location:', error);
      }
    };
    fetchRestaurantLocation();
  }, [url]);

  // Calculate delivery fee
  const getDeliveryFee = () => {
    if (getTotalCartAmount() === 0) return 0;
    if (!isDelivery) return 0;
    if (deliveryInfo && deliveryInfo.zone) {
      return deliveryInfo.zone.deliveryFee;
    }
    return 0;
  };

  // Handle delivery calculation
  const handleDeliveryCalculated = (info) => {
    setDeliveryInfo(info);
  };

  // Handle delivery address change
  const handleDeliveryAddressChange = (addressData) => {
    setDeliveryAddress((prev) => ({
      ...(prev || {}),
      ...addressData
    }));
  };

  const handleHouseNumberChange = (e) => {
    const value = e.target.value;
    setDeliveryAddress((prev) => ({
      ...(prev || {}),
      houseNumber: value
    }));
  };

  // Handle address selection from modal
  const handleSelectAddress = async (address) => {
    setSelectedAddressId(address._id);
    const newDeliveryAddress = {
      address: address.street || '',
      houseNumber: address.houseNumber || '',
      city: address.city || '',
      state: address.state || '',
      zipcode: address.zipcode || '',
      country: address.country || '',
      coordinates: address.coordinates || null
    };
    setDeliveryAddress(newDeliveryAddress);
    
    // Update contact info from selected address
    if (address.fullName) {
      const nameParts = address.fullName.split(' ');
      setData(prev => ({
        ...prev,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        phone: address.phone || prev.phone
      }));
    }
    
    // Manually trigger delivery calculation using full address string
    try {
      const fullAddress = address.street; // street is stored as full address
      const response = await axios.post(url + '/api/delivery/calculate', {
        address: fullAddress
      });
      
      if (response.data.success) {
        handleDeliveryCalculated(response.data.data);
      } else {
        setDeliveryInfo(null);
      }
    } catch (error) {
      console.error('Error calculating delivery for selected address:', error);
      setDeliveryInfo(null);
    }

    /* OLD IMPLEMENTATION – required coordinates so it never ran for normal saved addresses
    if (address.coordinates && restaurantLocation) {
      try {
        // Dùng đúng 1 dòng địa chỉ đã lưu (street đang đóng vai trò full address)
        const fullAddress = address.street;
        const response = await axios.post(url + '/api/delivery/calculate', {
          address: fullAddress,
          latitude: address.coordinates.lat || address.coordinates.latitude,
          longitude: address.coordinates.lng || address.coordinates.longitude
        });
        
        if (response.data.success) {
          handleDeliveryCalculated(response.data.data);
        } else {
          setDeliveryInfo(null);
        }
      } catch (error) {
        console.error('Error calculating delivery for selected address:', error);
        setDeliveryInfo(null);
      }
    } else {
      // Reset delivery info if no coordinates
      setDeliveryInfo(null);
    }
    */
    
    setShowAddressModal(false);
  };

  // Determine if we should show full form or address card
  const shouldShowAddressCard = isDelivery && isAuthenticated && userAddresses.length > 0 && !useManualAddress;
  
  // Get currently selected address for display
  const selectedAddress = shouldShowAddressCard 
    ? userAddresses.find(addr => addr._id === selectedAddressId) || userAddresses[0]
    : null;
  
  // Helper to check if any address has been selected (for warning condition)
  const hasAnyAddressSelected = isDelivery && (!!deliveryAddress?.address || !!selectedAddressId);

  useEffect(() => {
    if (getTotalCartAmount() === 0 && !showSuccessPopup) {
      navigate('/')
    }
  }, [getTotalCartAmount, navigate, showSuccessPopup])

  // Auto-focus first input on mobile
  useEffect(() => {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const firstInput = document.querySelector('.place-order input');
      if (firstInput) {
        firstInput.focus();
      }
    }
  }, []);



  
  const isRestaurantClosed = restaurantOpenStatus && !restaurantOpenStatus.isOpen;

  return (
    <>
      <form onSubmit={placeOrder} className="place-order">
        {isRestaurantClosed && (
          <div className="restaurant-closed-order-notice" role="alert">
            {restaurantOpenStatus.message || t('restaurant.closedNow')}
          </div>
        )}
        <div className="place-order-left">
          <p className="title">{t('placeOrder.title')}</p>
          
          {/* Order Type Selection - Chỉ hiển thị khi chưa login */}
          {!isAuthenticated && (
            <div className="order-type-section">
              <h3>{t('placeOrder.orderType.title')}</h3>
              <div className="order-type-options">
                <label className="order-type-option">
                  <input
                    type="radio"
                    name="orderType"
                    value="guest"
                    checked={orderType === 'guest'}
                    onChange={(e) => setOrderType(e.target.value)}
                  />
                  <span>{t('placeOrder.orderType.guest')}</span>
                </label>
              </div>
            </div>
          )}

          {/* Fulfillment Type Selection */}
          <div className="fulfillment-type-section">
            <h3>{t('placeOrder.fulfillment.title')}</h3>
            <div className="fulfillment-type-options">
              {[
                { value: 'pickup', title: t('placeOrder.fulfillment.pickupTitle'), desc: t('placeOrder.fulfillment.pickupDesc') },
                { value: 'dinein', title: t('placeOrder.fulfillment.dineInTitle'), desc: t('placeOrder.fulfillment.dineInDesc') },
                { value: 'delivery', title: t('placeOrder.fulfillment.deliveryTitle'), desc: t('placeOrder.fulfillment.deliveryDesc') },
              ].map((option) => (
                <label key={option.value} className={`fulfillment-card ${fulfillmentType === option.value ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="fulfillmentType"
                    value={option.value}
                    checked={fulfillmentType === option.value}
                    onChange={(e) => {
                      const next = e.target.value;
                      setFulfillmentType(next);
                      if (next !== 'delivery') {
                        setDeliveryInfo(null);
                        setDeliveryAddress(null);
                        setSelectedAddressId(null);
                        setUseManualAddress(false);
                      } else if (isAuthenticated && userAddresses.length > 0) {
                        const defaultAddr = userAddresses.find(addr =>
                          addr._id === defaultAddressId || addr.isDefault
                        ) || userAddresses[0];
                        if (defaultAddr) {
                          handleSelectAddress(defaultAddr);
                        }
                      }
                    }}
                  />
                  <div className="fulfillment-text">
                    <span className="fulfillment-title">{option.title}</span>
                    <span className="fulfillment-desc">{option.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Delivery Address with Mapbox - Đặt lên đầu vì quan trọng nhất */}
          {/* Delivery Address Section */}
          {isDelivery && shouldShowAddressCard && selectedAddress ? (
            /* Show address card for authenticated users with saved addresses */
            <div className="delivery-address-section">
              <label className="delivery-label">{t('placeOrder.form.addressLabel')}</label>
              <div className="saved-address-card">
                <div className="address-card-header">
                  <div className="address-card-info">
                    <h4>{selectedAddress.label}</h4>
                    {selectedAddress.isDefault && (
                      <span className="default-badge">{t('placeOrder.address.default')}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="change-address-btn"
                    onClick={() => setShowAddressModal(true)}
                  >
                    {t('placeOrder.address.change')}
                  </button>
                </div>
                <div className="address-card-content">
                  <p className="address-name">{selectedAddress.fullName}</p>
                  <p className="address-phone">{selectedAddress.phone}</p>
                  <p className="address-full">
                    {selectedAddress.street}
                  </p>
                </div>
              </div>
            </div>
          ) : isDelivery ? (
            /* Show full address form for guests OR authenticated users with zero addresses OR manual entry */
            <div className="delivery-address-section">
              <label className="delivery-label">{t('placeOrder.form.addressLabel')}</label>
              {isAuthenticated && userAddresses.length > 0 && useManualAddress && (
                <div className="manual-address-header">
                  <button
                    type="button"
                    className="use-saved-address-btn"
                    onClick={() => {
                      setUseManualAddress(false);
                      // Reset to default address
                      const defaultAddr = userAddresses.find(addr => 
                        addr._id === defaultAddressId || addr.isDefault
                      ) || userAddresses[0];
                      if (defaultAddr) {
                        setSelectedAddressId(defaultAddr._id);
                        setDeliveryAddress({
                          address: defaultAddr.street || '',
                          houseNumber: defaultAddr.houseNumber || '',
                          city: defaultAddr.city || '',
                          state: defaultAddr.state || '',
                          zipcode: defaultAddr.zipcode || '',
                          country: defaultAddr.country || '',
                          coordinates: defaultAddr.coordinates || null
                        });
                      }
                    }}
                  >
                    ← {t('placeOrder.address.useSaved')}
                  </button>
                </div>
              )}
              <DeliveryAddressInput
                value={deliveryAddress?.address || ''}
                onChange={handleDeliveryAddressChange}
                onDeliveryCalculated={handleDeliveryCalculated}
                url={url}
                restaurantLocation={restaurantLocation}
              />
              <div className="house-number-field">
                <label>
                  {t('placeOrder.form.houseNumberLabel')}
                  <span className="required-indicator" style={{color: 'red', marginLeft: '4px'}}>*</span>
                </label>
                <input
                  type="text"
                  placeholder={t('placeOrder.form.houseNumberPlaceholder')}
                  value={deliveryAddress?.houseNumber || ''}
                  onChange={handleHouseNumberChange}
                  className={
                    !deliveryAddress?.houseNumber && 
                    deliveryAddress?.address && 
                    !hasHouseNumber(deliveryAddress.address)
                      ? 'house-number-input-warning'
                      : ''
                  }
                />
                <p className="house-helper">{t('placeOrder.form.houseNumberHint')}</p>
                
                {/* ✨ CẢNH BÁO RÕ RÀNG HƠN */}
                {!deliveryAddress?.houseNumber && 
                 deliveryAddress?.address && 
                 !hasHouseNumber(deliveryAddress.address) && (
                  <div className="house-warning-enhanced">
                    <div className="warning-icon">⚠️</div>
                    <div className="warning-content">
                      <strong>{t('placeOrder.form.houseNumberWarningTitle')}</strong>
                      <p>{t('placeOrder.form.houseNumberWarningBody')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Contact Information Section */}
          <div className="contact-info-section">
            <h3 className="section-title">{t('placeOrder.form.contactInfo')}</h3>
            <div className="multi-fields">
              <input 
                required 
                name='firstName' 
                onChange={onChangeHandler} 
                value={data.firstName} 
                type="text" 
                placeholder={t('placeOrder.form.firstName')}
                autoComplete="given-name"
              />
              <input 
                required 
                name='lastName' 
                onChange={onChangeHandler} 
                value={data.lastName} 
                type="text" 
                placeholder={t('placeOrder.form.lastName')}
                autoComplete="family-name"
              />
            </div>
            <input 
              name='email' 
              onChange={onChangeHandler} 
              value={data.email} 
              type="email" 
              placeholder={t('placeOrder.form.email')}
              autoComplete="email"
            />
            <input 
              required 
              name='phone' 
              onChange={onChangeHandler} 
              value={data.phone} 
              type="tel" 
              placeholder={t('placeOrder.form.phone')}
              title={t('placeOrder.form.phone')}
              autoComplete="tel"
              maxLength="25"
            />
          </div>

          {/* Delivery Time Slot */}
          <div className="delivery-time-section">
            <label className="delivery-label">
              {isDelivery ? t('placeOrder.form.deliveryTimeLabel') : t('placeOrder.form.pickupTimeLabel')}
            </label>
            <select
              name='preferredDeliveryTime'
              onChange={onChangeHandler}
              value={data.preferredDeliveryTime}
              className="time-slot-select"
            >
              {timeSlots.map((slot, index) => (
                <option key={index} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>

          {/* Customer Note */}
          <div className="note-section">
            <label className="delivery-label">{t('placeOrder.form.noteLabel')}</label>
            <textarea
              name='note'
              onChange={onChangeHandler}
              value={data.note}
              placeholder={t('placeOrder.form.notePlaceholder')}
              className="note-textarea"
              rows="3"
            />
          </div>
          
          {/* Thông báo về dò đơn hàng */}
          <div className="tracking-notice">
            <p><strong>{t('placeOrder.notice.title')}:</strong> {t('placeOrder.notice.message')}</p>
          </div>
        </div>
        
        <div className="place-order-right">
          <div className="cart-total">
            <h2>{t('placeOrder.cart.title')}</h2>
            <div>
              <div className='cart-total-details'>
                <p>{t('placeOrder.cart.subtotal')}</p>
                <p>{formatPrice(getTotalCartAmount())}</p>
              </div>
              {hasItemsWithBoxFee() && (
                <div className='cart-total-details box-fee-note'>
                  <p className="box-fee-text">{t('placeOrder.cart.boxFeeNote', { boxFee: formatPrice(boxFee) })}</p>
                </div>
              )}
              <hr />
              <div className='cart-total-details'>
                <p>{t('placeOrder.cart.deliveryFee')}</p>
                <p>
              {isDelivery
                ? (deliveryInfo && deliveryInfo.zone ? formatPrice(getDeliveryFee()) : '--')
                : '0 Ft'}
                </p>
              </div>
          {isDelivery && !deliveryInfo && !hasAnyAddressSelected && (
                <div className="min-order-warning">
                  {t('placeOrder.cart.deliveryFeePrompt')}
                </div>
              )}
          {isDelivery && deliveryInfo && deliveryInfo.zone && (
                <>
                  <div className='cart-total-details delivery-zone-info'>
                    <span className="zone-badge">
                      {deliveryInfo.zone.name} • {deliveryInfo.distance}km • {deliveryInfo.zone.estimatedTime}min
                    </span>
                  </div>
                  {getTotalCartAmount() < deliveryInfo.zone.minOrder && (
                    <div className="min-order-warning">
                      {t('placeOrder.cart.minOrderWarning', {
                        minOrder: formatPrice(deliveryInfo.zone.minOrder),
                        needed: formatPrice(deliveryInfo.zone.minOrder - getTotalCartAmount())
                      })}
                    </div>
                  )}
                </>
              )}
              <hr />
              <div className='cart-total-details'>
                <b>{t('placeOrder.cart.total')}</b>
                <b>{formatPrice(getTotalCartAmount() === 0 ? 0 : getTotalCartAmount() + getDeliveryFee())}</b>
              </div>
            </div>
            <button type='submit' disabled={isSubmitting || isRestaurantClosed} className="desktop-submit-btn">
              {isRestaurantClosed
                ? (restaurantOpenStatus.message || t('restaurant.closedNow'))
                : (isSubmitting ? t('placeOrder.cart.submitting') : t('placeOrder.cart.proceedButton'))}
            </button>
          </div>
          
          {/* Mobile-friendly submit button - ở cuối sau cart */}
          <div className="mobile-submit-section">
            <button 
              type='submit' 
              className="mobile-submit-btn"
              disabled={isSubmitting || isRestaurantClosed}
            >
              {isRestaurantClosed
                ? (restaurantOpenStatus.message || t('restaurant.closedNow'))
                : (isSubmitting ? t('placeOrder.cart.submitting') : t('placeOrder.cart.proceedButton'))}
            </button>
          </div>
        </div>
      </form>
      
      {/* Delivery Zones Info - Đặt cuối cùng */}
      {isDelivery && (
        <div className="delivery-zones-display-wrapper">
          <DeliveryZoneDisplay url={url} />
        </div>
      )}
      
      {/* Address Selection Modal */}
      {showAddressModal && (
        <div className="address-modal-overlay" onClick={() => setShowAddressModal(false)}>
          <div className="address-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="address-modal-header">
              <h3>{t('placeOrder.address.selectTitle')}</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowAddressModal(false)}
              >
                ×
              </button>
            </div>
            <div className="address-modal-body">
              {userAddresses.map((address) => (
                <div
                  key={address._id}
                  className={`address-option-card ${selectedAddressId === address._id ? 'selected' : ''}`}
                  onClick={() => handleSelectAddress(address)}
                >
                  <div className="address-option-header">
                    <h4>{address.label}</h4>
                    {address.isDefault && <span className="default-badge">{t('placeOrder.address.default')}</span>}
                  </div>
                  <div className="address-option-content">
                    <p className="address-name">{address.fullName}</p>
                    <p className="address-phone">{address.phone}</p>
                    <p className="address-full">
                      {address.street}
                    </p>
                  </div>
                  {selectedAddressId === address._id && (
                    <div className="selected-indicator">{t('placeOrder.address.selected')}</div>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="add-new-address-btn"
                onClick={() => {
                  setShowAddressModal(false);
                  setUseManualAddress(true);
                  // Clear selected address to allow new entry
                  setSelectedAddressId(null);
                  setDeliveryAddress(null);
                  setDeliveryInfo(null);
                }}
              >
                + {t('placeOrder.address.addNew')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Popup */}
      <SuccessPopup
        isOpen={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        trackingCode={orderSuccessData.trackingCode}
        phone={orderSuccessData.phone}
        orderAmount={orderSuccessData.orderAmount}
        items={orderSuccessData.items}
        setCartItems={setCartItems}
      />
    </>
  );
};

export default PlaceOrder;