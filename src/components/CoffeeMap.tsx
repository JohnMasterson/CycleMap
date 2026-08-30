import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useState, useCallback } from 'react';
import type { LatLngTuple } from 'leaflet';
import { useCoffeeShops } from '../hooks/useCoffeeShops';
import type { CoffeeShop } from '../hooks/useCoffeeShops';
import 'leaflet/dist/leaflet.css';

// 70 Wilson Street, London EC2A 2DB
const OFFICE: [number, number] = [51.5218, -0.0845];
const WALK_RADIUS_M = 400;

const officeIcon = L.divIcon({
  className: 'office-marker',
  html: `<div style="
    background-color: #1e40af;
    color: white;
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  ">🏢</div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

const coffeeIcon = L.divIcon({
  className: 'coffee-marker',
  html: `<div style="
    background-color: #92400e;
    color: white;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  ">☕</div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
});

function FitToRadius() {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(OFFICE[0], OFFICE[1]).toBounds(WALK_RADIUS_M * 2.5);
    map.fitBounds(bounds);
  }, [map]);
  return null;
}

interface WalkingRoute {
  shopId: string;
  route: LatLngTuple[];
  duration: number;
  distance: number;
}

function useWalkingRoutes(shops: CoffeeShop[]) {
  const [routes, setRoutes] = useState<WalkingRoute[]>([]);

  const fetchRoutes = useCallback(async (signal: AbortSignal) => {
    if (shops.length === 0) return;

    const results: WalkingRoute[] = [];
    for (const shop of shops) {
      try {
        const url = `https://router.project-osrm.org/route/v1/foot/${OFFICE[1]},${OFFICE[0]};${shop.lon},${shop.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal });
        if (!res.ok) continue;
        const json = await res.json();
        if (json.code !== 'Ok' || !json.routes?.length) continue;
        const r = json.routes[0];
        results.push({
          shopId: shop.id,
          route: r.geometry.coordinates.map(
            ([lon, lat]: [number, number]) => [lat, lon] as LatLngTuple,
          ),
          duration: r.duration,
          distance: r.distance,
        });
      } catch {
        // skip failed individual routes
      }
    }
    setRoutes(results);
  }, [shops]);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetchRoutes(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [fetchRoutes]);

  return routes;
}

function ratingColor(rating: number): string {
  if (rating >= 8) return '#16a34a';
  if (rating >= 6) return '#d97706';
  return '#dc2626';
}

export function CoffeeMap() {
  const { shops, loading, error } = useCoffeeShops();
  const routes = useWalkingRoutes(shops);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);

  const getRoute = (shopId: string) => routes.find(r => r.shopId === shopId);

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
      <MapContainer
        center={OFFICE}
        zoom={17}
        className="map-container"
        scrollWheelZoom={true}
      >
        <FitToRadius />
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />

        {/* 5-min walking radius circle */}
        <Circle
          center={OFFICE}
          radius={WALK_RADIUS_M}
          pathOptions={{
            color: '#92400e',
            weight: 1.5,
            opacity: 0.4,
            fillColor: '#92400e',
            fillOpacity: 0.04,
            dashArray: '6 4',
          }}
        />

        {/* Walking routes — show all faintly, highlight selected */}
        {routes.map(r => (
          <Polyline
            key={r.shopId}
            positions={r.route}
            pathOptions={{
              color: r.shopId === selectedShop ? '#92400e' : '#d97706',
              weight: r.shopId === selectedShop ? 4 : 2,
              opacity: r.shopId === selectedShop ? 0.9 : 0.25,
              dashArray: '4 6',
            }}
          />
        ))}

        {/* Office marker */}
        <Marker position={OFFICE} icon={officeIcon}>
          <Popup>
            <div className="station-popup">
              <h3>AG Grid</h3>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '0.8rem' }}>70 Wilson Street</p>
            </div>
          </Popup>
        </Marker>

        {/* Coffee shop markers */}
        {shops.map(shop => {
          const route = getRoute(shop.id);
          const walkMin = route ? Math.round(route.duration / 60) : null;
          const distM = route ? Math.round(route.distance) : null;

          return (
            <Marker
              key={shop.id}
              position={[shop.lat, shop.lon]}
              icon={coffeeIcon}
              eventHandlers={{
                click: () => setSelectedShop(shop.id),
                popupclose: () => setSelectedShop(null),
              }}
            >
              <Popup>
                <div className="station-popup">
                  <h3>{shop.name}</h3>
                  {shop.rating != null && (
                    <p style={{ margin: '0 0 4px', color: ratingColor(shop.rating), fontSize: '0.85rem', fontWeight: 600 }}>
                      {shop.rating.toFixed(1)}/10
                      {shop.price != null && (
                        <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 6 }}>
                          {'$'.repeat(shop.price)}
                        </span>
                      )}
                    </p>
                  )}
                  {shop.address && (
                    <p style={{ margin: '0 0 4px', color: '#6b7280', fontSize: '0.75rem' }}>
                      {shop.address}
                    </p>
                  )}
                  {walkMin !== null && distM !== null && (
                    <p style={{ margin: '4px 0 0', color: '#374151', fontSize: '0.85rem' }}>
                      🚶 {walkMin} min · {distM}m
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating info panel */}
      <div className="coffee-info-panel">
        <div className="coffee-info-header">
          ☕ Coffee near the office
        </div>
        {loading && <p className="loading-text">Finding coffee shops...</p>}
        {error && <p className="loading-text" style={{ color: '#991b1b' }}>{error}</p>}
        {!loading && !error && (
          <div className="coffee-list">
            {shops.map(shop => {
              const route = getRoute(shop.id);
              const walkMin = route ? Math.round(route.duration / 60) : null;
              const isSelected = shop.id === selectedShop;

              return (
                <button
                  key={shop.id}
                  className={`coffee-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedShop(isSelected ? null : shop.id)}
                >
                  <span className="coffee-list-name">{shop.name}</span>
                  <span className="coffee-list-meta">
                    {shop.rating != null && (
                      <span className="coffee-list-rating" style={{ color: ratingColor(shop.rating) }}>
                        {shop.rating.toFixed(1)}
                      </span>
                    )}
                    {walkMin !== null && (
                      <span className="coffee-list-walk">{walkMin} min</span>
                    )}
                  </span>
                </button>
              );
            })}
            {shops.length === 0 && (
              <p className="loading-text">No coffee shops found nearby</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
