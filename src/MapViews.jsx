import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { calculateBaconStatus } from './lib/status.js';

const DEFAULT_CENTER = [59.9139, 10.7522];

function makeIcon(summary) {
  return L.divIcon({
    html: `<span class="map-pin ${summary.key}"><span>${summary.emoji}</span></span>`,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -34]
  });
}

function makeUserLocationIcon() {
  return L.divIcon({
    html: '<span class="user-location-pin"><span></span></span>',
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
}

function toMappableHotel(hotel) {
  const latitude = Number(hotel.latitude);
  const longitude = Number(hotel.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { ...hotel, latitude, longitude };
}

function MapCenter({ center, zoom }) {
  const map = useMap();
  const lat = center[0];
  const lng = center[1];

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map.setView([lat, lng], zoom, { animate: true });
  }, [lat, lng, map, zoom]);

  return null;
}

export function PinPicker({ lat, lng, onChange }) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  const center = [
    Number.isFinite(latitude) ? latitude : DEFAULT_CENTER[0],
    Number.isFinite(longitude) ? longitude : DEFAULT_CENTER[1]
  ];

  function MapClicker() {
    useMapEvents({
      click(event) {
        onChange({ lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) });
      }
    });
    return null;
  }

  return (
    <div className="pin-picker-frame">
      <MapContainer center={center} zoom={13} scrollWheelZoom>
        <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapCenter center={center} zoom={13} />
        <MapClicker />
        <Marker position={center} icon={makeIcon({ key: 'bacon_confirmed', emoji: '🥓' })} />
      </MapContainer>
    </div>
  );
}

export function BaconMap({ hotels, go, screens, statusFilters, matchesStatusFilter, getLocationIfAllowed }) {
  const routes = screens || { add: 'add', detail: 'detail', search: 'search' };
  const filters = statusFilters || [{ key: 'all', label: 'All' }];
  const matchesFilter = matchesStatusFilter || (() => true);
  const mappableHotels = hotels.map(toMappableHotel).filter(Boolean);
  const [userLocation, setUserLocation] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    let active = true;

    if (!getLocationIfAllowed) return () => {
      active = false;
    };

    getLocationIfAllowed()
      .then((location) => {
        if (!active || !location) return;
        setUserLocation(location);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [getLocationIfAllowed]);

  const filteredHotels = mappableHotels.filter((hotel) => matchesFilter(hotel, statusFilter));
  const centerHotel = filteredHotels[0] || mappableHotels[0];
  const center = userLocation
    ? [userLocation.latitude, userLocation.longitude]
    : (centerHotel ? [centerHotel.latitude, centerHotel.longitude] : DEFAULT_CENTER);
  const zoom = (userLocation || filteredHotels.length === 1) ? 13 : 5;
  const first = filteredHotels[0] || null;
  const firstSummary = first ? calculateBaconStatus(first.reports) : null;

  return (
    <div className="map-screen">
      <div className="map-frame">
        <MapContainer center={center} zoom={zoom} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapCenter center={center} zoom={zoom} />
          {userLocation && (
            <Marker position={[userLocation.latitude, userLocation.longitude]} icon={makeUserLocationIcon()}>
              <Popup>Your location</Popup>
            </Marker>
          )}
          {filteredHotels.map((hotel) => {
            const summary = calculateBaconStatus(hotel.reports);
            return (
              <Marker key={hotel.id} position={[hotel.latitude, hotel.longitude]} icon={makeIcon(summary)}>
                <Popup>
                  <strong>{hotel.name}</strong>
                  <p>{summary.label}</p>
                  <button onClick={() => go(routes.detail, hotel.id)}>Open hotel</button>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      <div className="map-overlay-top">
        <button className="map-search-pill" onClick={() => go(routes.search)}><span>⌕</span><span>Bacon map · {filteredHotels.length} of {mappableHotels.length} hotels</span></button>
        <div className="chips">
          {filters.map((filter) => (
            <button
              className={statusFilter === filter.key ? 'map-chip active' : 'map-chip'}
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {first ? (
        <button className="map-bottom-sheet" onClick={() => go(routes.detail, first.id)}>
          <span className="hotel-thumb">🏨</span>
          <span className="hotel-main">
            <span className="hotel-title">{first.name}</span>
            <span className={`status-badge ${firstSummary.key}`}>{firstSummary.emoji} {firstSummary.label}</span>
          </span>
          <span className="sheet-arrow">›</span>
        </button>
      ) : (
        <button className="map-bottom-sheet" onClick={() => go(routes.add)}>
          <span className="hotel-thumb">+</span>
          <span className="hotel-main">
            <span className="hotel-title">{mappableHotels.length ? 'No hotels match this filter' : 'No hotels on the map yet'}</span>
            <span className="hotel-meta">{mappableHotels.length ? 'Try another bacon status' : 'Add the first breakfast target'}</span>
          </span>
          <span className="sheet-arrow">+</span>
        </button>
      )}
    </div>
  );
}
