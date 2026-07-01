import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './ManualLocationPicker.css';

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_COORDS = { latitude: 47.4979, longitude: 19.0402 }; // Budapest (fallback)
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';
const NOMINATIM_USER_AGENT = 'FoodDeliveryApp/1.0';

// Format địa chỉ ngắn gọn từ Nominatim result
// Ví dụ: "Bajcsy-Zsilinszky út 12, 1051 Budapest, Hungary"
const formatShortAddress = (result) => {
  const address = result.address || {};
  const parts = [];
  
  // Phần 1: Street line (số nhà + tên đường)
  const houseNumber = address.house_number || address.house || address.housenumber || "";
  const street = address.road || address.street || address.pedestrian || address.path || "";
  const streetLine = [houseNumber, street].filter(Boolean).join(" ").trim();
  
  if (streetLine) {
    parts.push(streetLine);
  } else if (street) {
    parts.push(street);
  }
  
  // Phần 2: Village (thành phố nhỏ, ví dụ: Veča)
  const village = address.village || "";
  const town = address.town || address.city || "";
  
  if (village && village !== town) {
    parts.push(village);
  }
  
  // Phần 3: Zipcode + Town (thành phố lớn hơn, ví dụ: 1051 Budapest)
  const zipcode = address.postcode || "";
  if (zipcode && town) {
    const zipAndTown = `${zipcode} ${town}`;
    if (!parts.includes(town)) {
      parts.push(zipAndTown);
    } else {
      parts.push(zipcode);
    }
  } else if (zipcode) {
    parts.push(zipcode);
  } else if (town && !village) {
    parts.push(town);
  } else if (address.city && !village && !town) {
    parts.push(address.city);
  }
  
  // Nếu không format được, fallback về display_name nhưng cố gắng rút gọn
  if (parts.length === 0) {
    // Thử lấy phần đầu của display_name (trước 3 dấu phẩy đầu tiên)
    if (result.display_name) {
      const displayParts = result.display_name.split(',').slice(0, 3);
      return displayParts.join(',').trim();
    }
    return "";
  }
  
  return parts.join(", ");
};

// Component để di chuyển map khi coords thay đổi
function MapUpdater({ center, zoom, onMapClick }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.latitude, center.longitude], zoom || map.getZoom());
    }
  }, [center, zoom, map]);

  useEffect(() => {
    if (onMapClick) {
      map.on('click', onMapClick);
      return () => {
        map.off('click', onMapClick);
      };
    }
  }, [map, onMapClick]);

  return null;
}

const ManualLocationPicker = ({
  isOpen,
  onClose,
  onConfirm,
  initialCoords,
  restaurantLocation
}) => {
  const { t } = useTranslation();
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const [selectedCoords, setSelectedCoords] = useState(initialCoords || restaurantLocation || DEFAULT_COORDS);
  const [localError, setLocalError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [mapCenter, setMapCenter] = useState(selectedCoords);
  const debounceTimer = useRef(null);
  const markerRef = useRef(null);
  const prevIsOpenRef = useRef(false);

  // Search for addresses using Nominatim API
  const searchAddresses = useCallback(async (query) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const encodedQuery = encodeURIComponent(query);
      let url = `${NOMINATIM_BASE_URL}/search?q=${encodedQuery}&format=json&limit=5&countrycodes=hu&addressdetails=1&accept-language=en`;
      
      // Add viewbox if restaurant location is available
      if (restaurantLocation?.longitude && restaurantLocation?.latitude) {
        const lng = restaurantLocation.longitude;
        const lat = restaurantLocation.latitude;
        const offset = 0.1; // ~10km
        const viewbox = `${lng - offset},${lat - offset},${lng + offset},${lat + offset}`;
        url += `&viewbox=${viewbox}&bounded=1`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': NOMINATIM_USER_AGENT
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }

      const data = await response.json();

      if (data && data.length > 0) {
        const formattedSuggestions = data.map((result, index) => {
          // Format địa chỉ ngắn gọn
          const shortAddress = formatShortAddress(result);
          return {
            id: result.place_id || result.osm_id || `nominatim-${index}`,
            address: shortAddress || result.display_name, // Fallback về display_name nếu không format được
            fullAddress: result.display_name, // Lưu địa chỉ đầy đủ để dùng khi cần
            latitude: parseFloat(result.lat),
            longitude: parseFloat(result.lon)
          };
        });
        setSuggestions(formattedSuggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error searching addresses:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, [restaurantLocation]);

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (searchQuery) {
        searchAddresses(searchQuery);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 500);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, searchAddresses]);

  // Handle suggestion selection
  const handleSelectSuggestion = (suggestion) => {
    setSearchQuery(suggestion.address);
    setShowSuggestions(false);
    
    const newCoords = {
      latitude: suggestion.latitude,
      longitude: suggestion.longitude
    };
    
    setSelectedCoords(newCoords);
    setMapCenter(newCoords);
  };

  // Handle map click
  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    const newCoords = { latitude: lat, longitude: lng };
    setSelectedCoords(newCoords);
    setSearchQuery(''); // Clear search when clicking
  };

  // Handle marker drag end
  const handleMarkerDragEnd = (e) => {
    const { lat, lng } = e.target.getLatLng();
    const newCoords = { latitude: lat, longitude: lng };
    setSelectedCoords(newCoords);
    setSearchQuery(''); // Clear search when dragging
  };

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (!justOpened) return;

    setLocalError('');
    setSearchQuery('');
    setSuggestions([]);
    setShowSuggestions(false);

    const startCoords =
      initialCoords ||
      (restaurantLocation?.latitude && restaurantLocation?.longitude
        ? { latitude: restaurantLocation.latitude, longitude: restaurantLocation.longitude }
        : DEFAULT_COORDS);

    setSelectedCoords(startCoords);
    setMapCenter(startCoords);
  }, [
    isOpen,
    initialCoords?.latitude,
    initialCoords?.longitude,
    restaurantLocation?.latitude,
    restaurantLocation?.longitude
  ]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target)
      ) {
        setShowSuggestions(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (!selectedCoords) {
      setLocalError(t('manualPicker.error'));
      return;
    }
    onConfirm(selectedCoords);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="manual-picker-overlay">
      <div className="manual-picker">
        <div className="manual-picker-header">
          <h3>{t('manualPicker.title')}</h3>
          <button type="button" onClick={onClose} aria-label="Close picker">
            ✖
          </button>
        </div>
        <>
          {/* Search Box */}
          <div className="manual-picker-search-wrapper">
            <div className="manual-picker-search-input-wrapper">
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('manualPicker.searchPlaceholder')}
                className="manual-picker-search-input"
                autoComplete="off"
              />
              {isSearching && <div className="manual-picker-search-loading">🔄</div>}
            </div>
            
            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div ref={suggestionsRef} className="manual-picker-suggestions">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="manual-picker-suggestion-item"
                    onClick={() => handleSelectSuggestion(suggestion)}
                  >
                    <div className="manual-picker-suggestion-address">
                      {suggestion.address}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="manual-picker-map">
            <MapContainer
              center={[mapCenter.latitude, mapCenter.longitude]}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapUpdater 
                center={mapCenter} 
                zoom={15} 
                onMapClick={handleMapClick}
              />
              <Marker
                position={[selectedCoords.latitude, selectedCoords.longitude]}
                draggable={true}
                eventHandlers={{
                  dragend: handleMarkerDragEnd
                }}
                ref={markerRef}
              />
            </MapContainer>
          </div>
          <div className="manual-picker-footer">
            <div className="manual-picker-coords">
              <span>Lat: {selectedCoords?.latitude?.toFixed(5)}</span>
              <span>Lng: {selectedCoords?.longitude?.toFixed(5)}</span>
            </div>
            <div className="manual-picker-actions">
              <button type="button" className="secondary" onClick={onClose}>
                {t('manualPicker.cancel')}
              </button>
              <button type="button" className="primary" onClick={handleConfirm}>
                {t('manualPicker.useLocation')}
              </button>
            </div>
          </div>
        </>
        {localError && <div className="manual-picker-error">{localError}</div>}
      </div>
    </div>
  );
};

export default ManualLocationPicker;
