/**
 * Price Calculator Utility
 * 
 * Tính giá chính xác từ database để validate đơn hàng
 * Ngăn chặn price manipulation từ client
 */

import foodModel from "../models/foodModel.js";
import restaurantLocationModel from "../models/restaurantLocationModel.js";

/**
 * Fetch box fee từ database (admin settings)
 * @returns {Promise<number>} Box fee (HUF)
 */
export const getBoxFeeFromDB = async () => {
  try {
    const restaurant = await restaurantLocationModel.findOne({ 
      isActive: true, 
      isPrimary: true 
    });
    
    if (!restaurant || restaurant.boxFee === undefined || restaurant.boxFee === null) {
      console.warn('⚠️ Box fee not configured in restaurant settings, using 0');
      return 0;
    }
    
    return Number(restaurant.boxFee);
  } catch (error) {
    console.error('❌ Error fetching box fee:', error.message);
    return 0; // Fallback to 0 on error
  }
};

/**
 * Tính giá của 1 item (bao gồm options và box fee)
 * @param {Object} item - Item từ order (có quantity, selectedOptions, etc.)
 * @param {Object} product - Product từ database (có price, options, etc.)
 * @param {number} boxFee - Box fee từ admin settings
 * @returns {number} Tổng giá cho item này (basePrice + boxFee) * quantity
 */
export const calculateItemPrice = (item, product, boxFee) => {
  if (!product) {
    console.error('❌ Product not found for item:', item._id || item.sku);
    return 0;
  }

  // 1. Tính base price (chưa bao gồm box fee)
  let basePrice = 0;

  // Kiểm tra promotion trước
  if (product.isPromotion && product.promotionPrice !== undefined && product.promotionPrice !== null) {
    basePrice = Number(product.promotionPrice);
  } else {
    basePrice = Number(product.price) || 0;
  }

  // 2. Áp dụng options pricing (nếu có)
  if (product.options && Array.isArray(product.options) && product.options.length > 0) {
    if (item.selectedOptions && typeof item.selectedOptions === 'object') {
      // Duyệt qua từng option
      for (const option of product.options) {
        const selectedCode = item.selectedOptions[option.name];
        
        if (selectedCode) {
          const choice = option.choices?.find(c => c.code === selectedCode);
          
          if (choice) {
            if (option.pricingMode === 'override') {
              // Override: thay thế base price hoàn toàn
              basePrice = Number(choice.price) || 0;
            } else if (option.pricingMode === 'add') {
              // Add: cộng thêm vào base price
              basePrice += Number(choice.price) || 0;
            }
          }
        }
      }
    }
  }

  // 3. Kiểm tra box fee (có tắt không?)
  const isBoxFeeDisabled = 
    product.disableBoxFee === true || 
    product.disableBoxFee === "true" || 
    product.disableBoxFee === 1 || 
    product.disableBoxFee === "1" ||
    (typeof product.disableBoxFee === 'string' && product.disableBoxFee.toLowerCase() === 'true');

  const itemBoxFee = isBoxFeeDisabled ? 0 : boxFee;

  // 4. Tổng giá cho 1 đơn vị
  const unitPrice = basePrice + itemBoxFee;

  // 5. Nhân với số lượng
  const quantity = Number(item.quantity) || 1;
  const totalPrice = unitPrice * quantity;

  return totalPrice;
};

/**
 * Tính tổng giá cho toàn bộ đơn hàng
 * @param {Array} items - Danh sách items trong đơn hàng
 * @param {number} deliveryFee - Phí giao hàng
 * @returns {Promise<Object>} { total, itemsTotal, boxFeeTotal, deliveryFee, breakdown }
 */
export const calculateOrderTotal = async (items, deliveryFee = 0) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      total: 0,
      itemsTotal: 0,
      boxFeeTotal: 0,
      deliveryFee: 0,
      breakdown: []
    };
  }

  // Fetch box fee từ database
  const boxFee = await getBoxFeeFromDB();

  let itemsTotal = 0;
  let boxFeeTotal = 0;
  const breakdown = [];

  // Fetch tất cả products cùng lúc (parallel)
  const productIds = items.map(item => item._id || item.id).filter(Boolean);
  const products = await foodModel.find({ _id: { $in: productIds } });

  // Tạo map để lookup nhanh
  const productMap = {};
  products.forEach(p => {
    productMap[p._id.toString()] = p;
  });

  // Tính giá cho từng item
  for (const item of items) {
    const productId = (item._id || item.id)?.toString();
    const product = productMap[productId];

    if (!product) {
      console.error(`❌ Product not found: ${productId || item.sku || 'unknown'}`);
      continue;
    }

    // Tính giá item
    const itemTotal = calculateItemPrice(item, product, boxFee);
    
    // Tách riêng box fee để tracking
    const isBoxFeeDisabled = 
      product.disableBoxFee === true || 
      product.disableBoxFee === "true" || 
      product.disableBoxFee === 1 || 
      product.disableBoxFee === "1" ||
      (typeof product.disableBoxFee === 'string' && product.disableBoxFee.toLowerCase() === 'true');
    
    const itemBoxFee = isBoxFeeDisabled ? 0 : boxFee * (Number(item.quantity) || 1);

    itemsTotal += itemTotal;
    boxFeeTotal += itemBoxFee;

    breakdown.push({
      productId: product._id,
      sku: product.sku,
      name: product.name,
      quantity: item.quantity,
      unitPrice: itemTotal / (Number(item.quantity) || 1),
      itemTotal: itemTotal,
      boxFee: itemBoxFee
    });
  }

  const total = itemsTotal + Number(deliveryFee);

  return {
    total,
    itemsTotal,
    boxFeeTotal,
    deliveryFee: Number(deliveryFee),
    breakdown
  };
};

/**
 * Validate giá từ client với giá tính toán từ server
 * @param {number} clientAmount - Giá client gửi lên
 * @param {number} serverAmount - Giá server tính được
 * @param {number} tolerance - Sai lệch cho phép (HUF)
 * @returns {Object} { isValid, difference, clientAmount, serverAmount }
 */
export const validatePrice = (clientAmount, serverAmount, tolerance = 50) => {
  const client = Number(clientAmount);
  const server = Number(serverAmount);
  const diff = Math.abs(client - server);

  return {
    isValid: diff <= tolerance,
    difference: diff,
    clientAmount: client,
    serverAmount: server,
    tolerance
  };
};
