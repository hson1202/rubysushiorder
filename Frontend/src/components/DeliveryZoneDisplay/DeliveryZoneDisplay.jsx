import React, { useState, useEffect } from 'react';
import './DeliveryZoneDisplay.css';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

const DeliveryZoneDisplay = ({ url }) => {
  const { t } = useTranslation();
  const [zones, setZones] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    try {
      const response = await axios.get(`${url}/api/delivery/zones`);
      if (response.data.success) {
        setZones(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching delivery zones:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="zones-loading">{t('deliveryZones.loading')}</div>;
  }

  return (
    <div className="delivery-zones-display">
      <h3 className="zones-title">🚚 {t('deliveryZones.title')}</h3>
      <div className="zones-grid">
        {zones.map((zone) => (
          <div 
            key={zone._id} 
            className="zone-card"
            style={{ borderLeftColor: zone.color }}
          >
            <div className="zone-header">
              <span className="zone-distance">{zone.name}</span>
              <span className="zone-time">⏱️ {zone.estimatedTime} min</span>
            </div>
            <div className="zone-details">
              <div className="zone-detail-row">
                <span className="detail-label">{t('deliveryZones.deliveryFee')}</span>
                <span className="detail-value fee">
                  {zone.deliveryFee === 0 ? (
                    <span className="free-badge">{t('deliveryZones.free')}</span>
                  ) : (
                    new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(zone.deliveryFee)
                  )}
                </span>
              </div>
              <div className="zone-detail-row">
                <span className="detail-label">{t('deliveryZones.minOrder')}</span>
                <span className="detail-value">{new Intl.NumberFormat('hu-HU', { style: 'currency', currency: 'HUF', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(zone.minOrder)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeliveryZoneDisplay;

