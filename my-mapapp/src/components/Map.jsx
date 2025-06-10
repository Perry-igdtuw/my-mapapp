// src/components/Map.jsx
import React, { useRef, useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import { samplePins } from '../data/samplePins';
import './Map.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function Map() {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const [visibleData, setVisibleData] = useState({ type: 'FeatureCollection', features: [] });

  // 1. Filter by bounds
  const filterByBounds = (bounds, data) =>
    data.features.filter(({ geometry }) => {
      const [lng, lat] = geometry.coordinates;
      return (
        lng >= bounds.getWest() &&
        lng <= bounds.getEast() &&
        lat >= bounds.getSouth() &&
        lat <= bounds.getNorth()
      );
    });

  // 2. Simple grid‐based sampling
  const sampleFeatures = (features, maxCount = 100, gridSize = 5) => {
    if (features.length <= maxCount) return features;

    // Assign features to grid cells
    const cells = {};
    features.forEach(f => {
      const [lng, lat] = f.geometry.coordinates;
      const x = Math.floor((lng + 180) / (360 / gridSize));
      const y = Math.floor((lat + 90)  / (180 / gridSize));
      const key = `${x},${y}`;
      cells[key] = cells[key] || [];
      cells[key].push(f);
    });

    // Pick one from each cell round‐robin until we hit maxCount
    const sampled = [];
    const cellKeys = Object.keys(cells);
    let idx = 0;
    while (sampled.length < maxCount) {
      const key = cellKeys[idx % cellKeys.length];
      const bucket = cells[key];
      if (bucket && bucket.length > 0) {
        sampled.push(bucket.shift());
      }
      idx++;
      // If we’ve looped over all buckets and none have items, break
      if (idx > cellKeys.length * maxCount) break;
    }
    return sampled;
  };

  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style:    'mapbox://styles/mapbox/streets-v11',
      center:   [10.0, 51.0],
      zoom:     5,
      minZoom:  4,
      maxZoom:  15,
    });
    mapRef.current = map;

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      // Initialize with an empty source
      map.addSource('pins', { type: 'geojson', data: visibleData });
      map.addLayer({
        id: 'pin-layer',
        type: 'circle',
        source: 'pins',
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            5, 6,
            12, 12
          ],
          'circle-color':        'black',
          'circle-stroke-width': 3,
          'circle-stroke-color': '#FFFFFF',
          'circle-blur':         0.4,
          'circle-opacity':      0.9,
        },
      });

      // Trigger initial load
      map.fire('moveend');
    });

    map.on('moveend', () => {
      const bounds   = map.getBounds();
      const filtered = filterByBounds(bounds, samplePins);
      const sampled  = sampleFeatures(filtered, 30, 10);

      const geojson = { type: 'FeatureCollection', features: sampled };
      setVisibleData(geojson);
      map.getSource('pins').setData(geojson);
    });

    return () => map.remove();
  }, []);

  return <div ref={mapContainer} className="map-container" />;
}
