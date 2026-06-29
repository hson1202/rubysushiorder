import React, { useState, useEffect, useRef } from 'react';
import './LazyImage.css';

const LazyImage = ({ 
  src, 
  alt, 
  className = '', 
  width, 
  height,
  style = {},
  onError,
  withFoodBackground = false,
  placeholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjkwIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iOTAiIGZpbGw9IiNmNWY1ZjUiLz48L3N2Zz4='
}) => {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef(null);

  useEffect(() => {
    // Intersection Observer để detect khi ảnh vào viewport
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect(); // Chỉ load 1 lần
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.01
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (observer) observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (isInView && src && src !== placeholder) {
      // Preload image
      const img = new Image();
      img.src = src;
      
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
        setHasError(false);
      };
      
      img.onerror = (e) => {
        setHasError(true);
        setIsLoaded(true);
        if (onError) onError(e);
      };
    }
  }, [isInView, src, placeholder, onError]);

  const objectFit = withFoodBackground ? 'contain' : 'cover';

  return (
    <div 
      ref={imgRef} 
      className={`lazy-image-wrapper${withFoodBackground ? ' with-food-background' : ''} ${className}`}
      style={{ 
        width: width || '100%', 
        height: height || '100%', 
        ...style 
      }}
    >
      <img
        src={imageSrc}
        alt={alt}
        className={`lazy-image ${isLoaded ? 'loaded' : 'loading'} ${hasError ? 'error' : ''}`}
        style={{ width: '100%', height: '100%', objectFit }}
      />
      {!isLoaded && <div className="lazy-image-spinner"></div>}
    </div>
  );
};

export default LazyImage;

