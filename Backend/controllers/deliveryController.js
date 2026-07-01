import deliveryZoneModel from "../models/deliveryZoneModel.js";
import restaurantLocationModel from "../models/restaurantLocationModel.js";
import { extractAddressComponents, formatShortAddress, cleanDisplayName } from "../utils/addressFormat.js";

// ========== OPENSTREETMAP/NOMINATIM CONFIG ==========
// Nominatim API không cần API key, nhưng cần User-Agent header
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_MAP_CENTER = { latitude: 47.4979, longitude: 19.0402 };
// User-Agent header bắt buộc cho Nominatim (theo policy của họ)
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'FoodDeliveryApp/1.0';

// Convert Nominatim result to our address format
const nominatimResultToAddress = (result = {}) => {
  const latitude = parseFloat(result.lat) || DEFAULT_MAP_CENTER.latitude;
  const longitude = parseFloat(result.lon) || DEFAULT_MAP_CENTER.longitude;
  const components = extractAddressComponents(result);

  // Format địa chỉ ngắn gọn từ components
  const shortAddress = formatShortAddress(components);

  // Nếu không format được địa chỉ ngắn, fallback về display_name đã được clean
  const formattedAddress = shortAddress || cleanDisplayName(result.display_name) || "";

  return {
    latitude,
    longitude,
    formattedAddress: formattedAddress,
    components: components,
  };
};

// ========== HAVERSINE FORMULA ==========
// Tính khoảng cách thẳng giữa 2 điểm trên trái đất (km)
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Bán kính trái đất (km)
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRad(value) {
  return value * Math.PI / 180;
}

// ========== GEOCODING WITH NOMINATIM (OPENSTREETMAP) ==========
async function geocodeAddress(address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    // Nominatim API: search endpoint
    // countrycodes=hu: giới hạn trong Hungary
    // addressdetails=1: lấy chi tiết địa chỉ
    // limit=5: lấy 5 kết quả để tìm địa chỉ có số nhà
    const url = `${NOMINATIM_BASE_URL}/search?q=${encodedAddress}&format=json&limit=5&countrycodes=hu&addressdetails=1&accept-language=en`;

    console.log("🔍 Geocoding address with Nominatim:", address);

    const response = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error("Address not found");
    }

    // ✨ Ưu tiên chọn địa chỉ có số nhà cụ thể
    let bestResult = data[0];
    let bestParsed = nominatimResultToAddress(bestResult);

    // Tìm địa chỉ có số nhà trong các kết quả
    for (const result of data) {
      const parsed = nominatimResultToAddress(result);
      if (parsed.components.houseNumber && parsed.components.houseNumber.trim().length > 0) {
        bestResult = result;
        bestParsed = parsed;
        console.log("✅ Found address with house number:", parsed.components.houseNumber);
        break; // Dừng khi tìm thấy địa chỉ có số nhà
      }
    }

    console.log("✅ Geocoding successful:", {
      latitude: bestParsed.latitude,
      longitude: bestParsed.longitude,
      placeName: bestParsed.formattedAddress,
      houseNumber: bestParsed.components.houseNumber || "N/A"
    });

    return bestParsed;
  } catch (error) {
    console.error("❌ Geocoding error:", error);
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
}

async function reverseGeocodeCoordinates(latitude, longitude) {
  try {
    // Nominatim reverse geocoding
    const url = `${NOMINATIM_BASE_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`;
    console.log("🔄 Reverse geocoding coordinates with Nominatim:", latitude, longitude);

    const response = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.lat || !data.lon) {
      throw new Error("Reverse geocoding failed");
    }

    const parsedResult = nominatimResultToAddress(data);

    console.log("✅ Reverse geocoding successful:", {
      latitude: parsedResult.latitude,
      longitude: parsedResult.longitude,
      placeName: parsedResult.formattedAddress,
    });

    return parsedResult;
  } catch (error) {
    console.error("❌ Reverse geocoding error:", error);
    throw new Error(`Failed to reverse geocode coordinates: ${error.message}`);
  }
}

// ========== GET DELIVERY ZONES ==========
const getDeliveryZones = async (req, res) => {
  try {
    const zones = await deliveryZoneModel.find({ isActive: true }).sort({ order: 1, minDistance: 1 });

    res.json({
      success: true,
      data: zones
    });
  } catch (error) {
    console.error("Error fetching delivery zones:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========== CALCULATE DELIVERY FEE ==========
const calculateDeliveryFee = async (req, res) => {
  try {
    const { address, latitude, longitude } = req.body;

    let customerLat, customerLng, formattedAddress;
    let addressComponents = null;

    // Nếu có latitude/longitude thì dùng luôn
    if (latitude && longitude) {
      customerLat = parseFloat(latitude);
      customerLng = parseFloat(longitude);

      if (address) {
        formattedAddress = address;
      } else {
        try {
          const reverse = await reverseGeocodeCoordinates(customerLat, customerLng);
          formattedAddress = reverse.formattedAddress;
          addressComponents = reverse.components;
        } catch (geoErr) {
          console.warn("⚠️ Reverse geocode failed, falling back to raw coordinates:", geoErr?.message);
          formattedAddress = `${latitude}, ${longitude}`;
        }
      }
    }
    // Nếu không, geocode từ address
    else if (address) {
      const geocoded = await geocodeAddress(address);
      customerLat = geocoded.latitude;
      customerLng = geocoded.longitude;
      formattedAddress = geocoded.formattedAddress;
      addressComponents = geocoded.components;
    }
    else {
      return res.status(400).json({
        success: false,
        message: "Please provide either address or latitude/longitude"
      });
    }

    // Lấy vị trí nhà hàng
    const restaurant = await restaurantLocationModel.findOne({
      isActive: true,
      isPrimary: true
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant location not configured"
      });
    }

    // Tính khoảng cách
    const distance = calculateHaversineDistance(
      restaurant.latitude,
      restaurant.longitude,
      customerLat,
      customerLng
    );

    // Tìm zone phù hợp
    const zones = await deliveryZoneModel.find({ isActive: true }).sort({ minDistance: 1 });

    console.log(`🔍 Delivery calculation for distance: ${distance.toFixed(2)}km`);
    console.log(`📦 Available zones (${zones.length}):`, zones.map(z => ({
      name: z.name,
      range: `${z.minDistance}-${z.maxDistance}km`,
      fee: `${z.deliveryFee} Ft`
    })));

    let matchedZone = null;
    for (const zone of zones) {
      if (distance >= zone.minDistance && distance <= zone.maxDistance) {
        matchedZone = zone;
        console.log(`✅ Matched zone: ${zone.name} (${zone.minDistance}-${zone.maxDistance}km) - Fee: ${zone.deliveryFee} Ft`);
        break;
      }
    }

    // Nếu khách gần hơn cả zone nhỏ nhất (ví dụ < 1km) thì áp dụng zone đầu tiên
    if (!matchedZone && zones.length > 0) {
      const nearestZone = zones[0];
      if (distance < nearestZone.minDistance) {
        matchedZone = nearestZone;
        console.log(`⚠️ Distance ${distance.toFixed(2)}km is less than minimum zone. Using nearest zone: ${nearestZone.name}`);
      }
    }

    if (!matchedZone) {
      console.log(`❌ No zone matched for distance: ${distance.toFixed(2)}km`);
    }


    if (!matchedZone) {
      // Kiểm tra xem có zone nào được setup không
      if (zones.length === 0) {
        return res.json({
          success: false,
          message: "Hiện chưa có khu vực giao hàng được cấu hình. Vui lòng liên hệ nhà hàng để biết thêm chi tiết.",
          messageEn: "No delivery zones are currently configured. Please contact the restaurant for more details.",
          messageHu: "Jelenleg nincsenek kiszállítási zónák beállítva. Kérjük, vegye fel a kapcsolatot az étteremmel.",
          distance: parseFloat(distance.toFixed(2)),
          address: formattedAddress,
          outOfRange: true,
          noZonesConfigured: true
        });
      }

      // Có zone nhưng địa chỉ ngoài tất cả các zone
      const maxDistance = Math.max(...zones.map(z => z.maxDistance || 0));
      return res.json({
        success: false,
        message: `Xin lỗi, địa chỉ này quá xa (${parseFloat(distance.toFixed(2))}km). Hiện chúng tôi chưa phục vụ giao hàng tại khu vực này. Vui lòng chọn địa chỉ gần hơn hoặc liên hệ nhà hàng để biết thêm chi tiết.`,
        messageEn: `Sorry, this address is too far (${parseFloat(distance.toFixed(2))}km). We currently don't deliver to this area. Please choose a closer address or contact the restaurant for more details.`,
        messageHu: `Sajnáljuk, ez a cím túl messze van (${parseFloat(distance.toFixed(2))} km). Jelenleg nem szállítunk erre a területre. Kérjük, válasszon közelebbi címet, vagy vegye fel a kapcsolatot az étteremmel.`,
        distance: parseFloat(distance.toFixed(2)),
        address: formattedAddress,
        outOfRange: true,
        maxDeliveryDistance: maxDistance
      });
    }

    res.json({
      success: true,
      data: {
        zone: {
          name: matchedZone.name,
          deliveryFee: matchedZone.deliveryFee,
          minOrder: matchedZone.minOrder,
          estimatedTime: matchedZone.estimatedTime,
          color: matchedZone.color
        },
        distance: parseFloat(distance.toFixed(2)),
        address: formattedAddress,
        addressComponents,
        coordinates: {
          latitude: customerLat,
          longitude: customerLng
        },
        restaurant: {
          name: restaurant.name,
          address: restaurant.address
        }
      }
    });

  } catch (error) {
    console.error("Error calculating delivery fee:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========== AUTOCOMPLETE ADDRESS (NOMINATIM/OPENSTREETMAP) ==========
const autocompleteAddress = async (req, res) => {
  try {
    const { query, proximity } = req.query; // proximity: "lng,lat" để ưu tiên kết quả gần nhà hàng

    if (!query || query.length < 3) {
      return res.json({
        success: true,
        data: []
      });
    }

    const encodedQuery = encodeURIComponent(query);
    // Nominatim search API
    // countrycodes=hu: giới hạn trong Hungary
    // addressdetails=1: lấy chi tiết địa chỉ
    // limit=15: lấy nhiều kết quả để filter
    let url = `${NOMINATIM_BASE_URL}/search?q=${encodedQuery}&format=json&limit=15&countrycodes=hu&addressdetails=1&accept-language=en`;

    // Thêm proximity nếu có (Nominatim dùng viewbox thay vì proximity)
    // viewbox=min_lon,min_lat,max_lon,max_lat
    if (proximity) {
      const [lng, lat] = proximity.split(',').map(parseFloat);
      if (!isNaN(lng) && !isNaN(lat)) {
        // Tạo viewbox xung quanh điểm proximity (~50km) để ưu tiên kết quả gần nhà hàng
        // KHÔNG dùng bounded=1 vì sẽ chặn hoàn toàn địa chỉ ngoài viewbox,
        // làm các zone giao hàng mới (khoảng cách xa hơn) không tìm được địa chỉ
        const offset = 0.5; // ~55km - đủ rộng để bao phủ mọi zone giao hàng thực tế
        const viewbox = `${lng - offset},${lat - offset},${lng + offset},${lat + offset}`;
        url += `&viewbox=${viewbox}`;
      }
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    let suggestions = [];

    // Parse kết quả từ Nominatim
    if (data && data.length > 0) {
      suggestions = data.map((result, index) => {
        const parsed = nominatimResultToAddress(result);

        // Phân loại ưu tiên:
        // Priority 1: Có số nhà rõ ràng
        // Priority 2: Address nhưng không có số nhà (chỉ tên đường)
        // Priority 3: Place (địa chỉ chung chung)
        const hasHouseNumber = parsed.components.houseNumber &&
          parsed.components.houseNumber.trim().length > 0;
        const isPlace = result.type === 'administrative' ||
          result.type === 'city' ||
          result.type === 'town' ||
          result.type === 'village';
        const priority = hasHouseNumber ? 1 : (isPlace ? 3 : 2);

        return {
          id: result.place_id || result.osm_id || `nominatim-${index}`,
          address: parsed.formattedAddress, // Địa chỉ đã được format ngắn gọn
          shortAddress: parsed.formattedAddress || parsed.components.streetLine || parsed.components.street || result.display_name.split(',')[0],
          latitude: parsed.latitude,
          longitude: parsed.longitude,
          components: parsed.components,
          priority: priority,
          hasHouseNumber: hasHouseNumber
        };
      });
    }

    // ✨ Sắp xếp: ưu tiên địa chỉ có số nhà trước
    suggestions.sort((a, b) => {
      // Ưu tiên theo priority (1 = có số nhà, 2 = address không có số nhà, 3 = place)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Nếu cùng priority, giữ nguyên thứ tự từ Nominatim
      return 0;
    });

    // Chỉ trả về 5 kết quả tốt nhất
    suggestions = suggestions.slice(0, 5);

    res.json({
      success: true,
      data: suggestions
    });

  } catch (error) {
    console.error("❌ Autocomplete error:", error);
    console.error("Error details:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.response?.data || "Network error or Nominatim API issue"
    });
  }
};

// ========== ADMIN: CRUD DELIVERY ZONES ==========
const createDeliveryZone = async (req, res) => {
  try {
    const { name, minDistance, maxDistance, deliveryFee, minOrder, estimatedTime, color, order } = req.body;

    const zone = new deliveryZoneModel({
      name,
      minDistance,
      maxDistance,
      deliveryFee,
      minOrder,
      estimatedTime,
      color,
      order
    });

    await zone.save();

    res.json({
      success: true,
      message: "Delivery zone created successfully",
      data: zone
    });

  } catch (error) {
    console.error("Error creating delivery zone:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateDeliveryZone = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const zone = await deliveryZoneModel.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Delivery zone not found"
      });
    }

    res.json({
      success: true,
      message: "Delivery zone updated successfully",
      data: zone
    });

  } catch (error) {
    console.error("Error updating delivery zone:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const deleteDeliveryZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await deliveryZoneModel.findByIdAndDelete(id);

    if (!zone) {
      return res.status(404).json({
        success: false,
        message: "Delivery zone not found"
      });
    }

    res.json({
      success: true,
      message: "Delivery zone deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting delivery zone:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ========== ADMIN: CRUD RESTAURANT LOCATION ==========
const getRestaurantLocation = async (req, res) => {
  try {
    const location = await restaurantLocationModel.findOne({
      isActive: true,
      isPrimary: true
    });

    res.json({
      success: true,
      data: location
    });

  } catch (error) {
    console.error("Error fetching restaurant location:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateRestaurantLocation = async (req, res) => {
  try {
    const { name, address, latitude, longitude, boxFee, systemFee } = req.body;

    console.log('🔍 Update Restaurant Location - Request body:', req.body);
    console.log('📦 Box Fee received:', boxFee, 'Type:', typeof boxFee);
    console.log('⚙️ System Fee received:', systemFee, 'Type:', typeof systemFee);

    // Tìm location hiện tại hoặc tạo mới
    let location = await restaurantLocationModel.findOne({
      isActive: true,
      isPrimary: true
    });

    if (location) {
      const oldBoxFee = location.boxFee;

      location.name = name || location.name;
      location.address = address || location.address;
      location.latitude = latitude || location.latitude;
      location.longitude = longitude || location.longitude;

      // Update box fee if provided
      if (boxFee !== undefined && boxFee !== null) {
        location.boxFee = Number(boxFee);
        console.log(`📦 Box Fee updated: ${oldBoxFee} → ${location.boxFee}`);
      }

      if (systemFee !== undefined && systemFee !== null) {
        location.systemFee = Number(systemFee);
        console.log(`⚙️ System Fee updated: ${location.systemFee}`);
      }

      await location.save();
      console.log('✅ Location saved successfully');
    } else {
      location = new restaurantLocationModel({
        name,
        address,
        latitude,
        longitude,
        boxFee: boxFee !== undefined && boxFee !== null ? Number(boxFee) : 0.3,
        systemFee: systemFee !== undefined && systemFee !== null ? Number(systemFee) : 0,
        isActive: true,
        isPrimary: true
      });
      await location.save();
      console.log('✅ New location created with boxFee:', location.boxFee);
    }

    res.json({
      success: true,
      message: "Restaurant location updated successfully",
      data: location
    });

  } catch (error) {
    console.error("Error updating restaurant location:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export {
  getDeliveryZones,
  calculateDeliveryFee,
  autocompleteAddress,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  getRestaurantLocation,
  updateRestaurantLocation
};

