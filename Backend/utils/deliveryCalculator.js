import deliveryZoneModel from "../models/deliveryZoneModel.js";
import restaurantLocationModel from "../models/restaurantLocationModel.js";
import { extractAddressComponents, formatShortAddress, cleanDisplayName } from "./addressFormat.js";

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_MAP_CENTER = { latitude: 47.4979, longitude: 19.0402 };
const NOMINATIM_USER_AGENT = process.env.NOMINATIM_USER_AGENT || 'FoodDeliveryApp/1.0';

const nominatimResultToAddress = (result = {}) => {
  const latitude = parseFloat(result.lat) || DEFAULT_MAP_CENTER.latitude;
  const longitude = parseFloat(result.lon) || DEFAULT_MAP_CENTER.longitude;
  const components = extractAddressComponents(result);
  const shortAddress = formatShortAddress(components);
  const formattedAddress = shortAddress || cleanDisplayName(result.display_name) || "";

  return {
    latitude,
    longitude,
    formattedAddress,
    components,
  };
};

function toRad(value) {
  return value * Math.PI / 180;
}

export function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function geocodeAddress(address) {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `${NOMINATIM_BASE_URL}/search?q=${encodedAddress}&format=json&limit=5&countrycodes=hu&addressdetails=1&accept-language=en`;

    const response = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      throw new Error("Address not found");
    }

    let bestResult = data[0];
    let bestParsed = nominatimResultToAddress(bestResult);

    for (const result of data) {
      const parsed = nominatimResultToAddress(result);
      if (parsed.components.houseNumber && parsed.components.houseNumber.trim().length > 0) {
        bestResult = result;
        bestParsed = parsed;
        break;
      }
    }

    return bestParsed;
  } catch (error) {
    throw new Error(`Failed to geocode address: ${error.message}`);
  }
}

export async function reverseGeocodeCoordinates(latitude, longitude) {
  try {
    const url = `${NOMINATIM_BASE_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&accept-language=en`;

    const response = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data || !data.lat || !data.lon) {
      throw new Error("Reverse geocoding failed");
    }

    return nominatimResultToAddress(data);
  } catch (error) {
    throw new Error(`Failed to reverse geocode coordinates: ${error.message}`);
  }
}

export function buildStructuredAddressQuery({
  street = '',
  houseNumber = '',
  city = '',
  zipcode = '',
  country = 'Hungary'
} = {}) {
  const streetLine = [houseNumber, street].filter(Boolean).join(' ').trim();
  return [streetLine, zipcode, city, country].filter(Boolean).join(', ');
}

function findMatchingZone(distance, zones) {
  let matchedZone = null;

  for (const zone of zones) {
    if (distance >= zone.minDistance && distance <= zone.maxDistance) {
      matchedZone = zone;
      break;
    }
  }

  if (!matchedZone && zones.length > 0) {
    const nearestZone = zones[0];
    if (distance < nearestZone.minDistance) {
      matchedZone = nearestZone;
    }
  }

  return matchedZone;
}

function buildOutOfRangeResult({ distance, formattedAddress, zones }) {
  if (zones.length === 0) {
    return {
      success: false,
      message: "Hiện chưa có khu vực giao hàng được cấu hình. Vui lòng liên hệ nhà hàng để biết thêm chi tiết.",
      messageEn: "No delivery zones are currently configured. Please contact the restaurant for more details.",
      messageHu: "Jelenleg nincsenek kiszállítási zónák beállítva. Kérjük, vegye fel a kapcsolatot az étteremmel.",
      distance: parseFloat(distance.toFixed(2)),
      address: formattedAddress,
      outOfRange: true,
      noZonesConfigured: true
    };
  }

  const maxDistance = Math.max(...zones.map(z => z.maxDistance || 0));
  return {
    success: false,
    message: `Xin lỗi, địa chỉ này quá xa (${parseFloat(distance.toFixed(2))}km). Hiện chúng tôi chưa phục vụ giao hàng tại khu vực này. Vui lòng chọn địa chỉ gần hơn hoặc liên hệ nhà hàng để biết thêm chi tiết.`,
    messageEn: `Sorry, this address is too far (${parseFloat(distance.toFixed(2))}km). We currently don't deliver to this area. Please choose a closer address or contact the restaurant for more details.`,
    messageHu: `Sajnáljuk, ez a cím túl messze van (${parseFloat(distance.toFixed(2))} km). Jelenleg nem szállítunk erre a területre. Kérjük, válasszon közelebbi címet, vagy vegye fel a kapcsolatot az étteremmel.`,
    distance: parseFloat(distance.toFixed(2)),
    address: formattedAddress,
    outOfRange: true,
    maxDeliveryDistance: maxDistance
  };
}

async function resolveDeliveryFromCoords(customerLat, customerLng, formattedAddress, addressComponents = null) {
  const restaurant = await restaurantLocationModel.findOne({
    isActive: true,
    isPrimary: true
  });

  if (!restaurant) {
    return {
      success: false,
      message: "Restaurant location not configured"
    };
  }

  const distance = calculateHaversineDistance(
    restaurant.latitude,
    restaurant.longitude,
    customerLat,
    customerLng
  );

  const zones = await deliveryZoneModel.find({ isActive: true }).sort({ minDistance: 1 });
  const matchedZone = findMatchingZone(distance, zones);

  if (!matchedZone) {
    return buildOutOfRangeResult({ distance, formattedAddress, zones });
  }

  return {
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
  };
}

/**
 * Resolve delivery zone + fee from address input.
 * @param {Object} options
 * @param {string} [options.address] - Free-text address for geocoding
 * @param {number} [options.latitude]
 * @param {number} [options.longitude]
 * @param {Object} [options.structuredAddress] - Confirmed street/house/city/zip (used at order placement)
 * @param {boolean} [options.preferStructuredGeocode=false] - Geocode structured fields first (order validation)
 */
export async function resolveDelivery({
  address,
  latitude,
  longitude,
  structuredAddress,
  preferStructuredGeocode = false
} = {}) {
  if (preferStructuredGeocode && structuredAddress?.street && structuredAddress?.city && structuredAddress?.zipcode) {
    const query = buildStructuredAddressQuery(structuredAddress);
    try {
      const geocoded = await geocodeAddress(query);
      return resolveDeliveryFromCoords(
        geocoded.latitude,
        geocoded.longitude,
        geocoded.formattedAddress,
        geocoded.components
      );
    } catch (geoErr) {
      console.warn("⚠️ Structured address geocode failed, falling back:", geoErr?.message);
    }
  }

  const resolvedLat = latitude ?? structuredAddress?.coordinates?.latitude;
  const resolvedLng = longitude ?? structuredAddress?.coordinates?.longitude;

  if (resolvedLat != null && resolvedLng != null) {
    const customerLat = parseFloat(resolvedLat);
    const customerLng = parseFloat(resolvedLng);

    if (address) {
      return resolveDeliveryFromCoords(customerLat, customerLng, address);
    }

    try {
      const reverse = await reverseGeocodeCoordinates(customerLat, customerLng);
      return resolveDeliveryFromCoords(
        customerLat,
        customerLng,
        reverse.formattedAddress,
        reverse.components
      );
    } catch (geoErr) {
      console.warn("⚠️ Reverse geocode failed, using raw coordinates:", geoErr?.message);
      return resolveDeliveryFromCoords(
        customerLat,
        customerLng,
        `${resolvedLat}, ${resolvedLng}`
      );
    }
  }

  if (address) {
    const geocoded = await geocodeAddress(address);
    return resolveDeliveryFromCoords(
      geocoded.latitude,
      geocoded.longitude,
      geocoded.formattedAddress,
      geocoded.components
    );
  }

  return {
    success: false,
    message: "Please provide either address or latitude/longitude"
  };
}
