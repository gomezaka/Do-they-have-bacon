"use client";

import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

interface HotelPinPickerProps {
  latitude: number;
  longitude: number;
  onChange: (coords: { latitude: number; longitude: number }) => void;
}

const pinIcon = L.divIcon({
  html: `<span class="map-pin pin-picker-marker">🥓</span>`,
  className: "",
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

export default function HotelPinPicker({ latitude, longitude, onChange }: HotelPinPickerProps) {
  const position = useMemo<[number, number]>(() => [latitude, longitude], [latitude, longitude]);

  return (
    <div className="pin-picker-frame">
      <MapContainer center={position} zoom={13} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap position={position} />
        <ClickToMovePin onChange={onChange} />
        <Marker
          draggable
          position={position}
          icon={pinIcon}
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target as L.Marker;
              const next = marker.getLatLng();
              onChange({
                latitude: Number(next.lat.toFixed(6)),
                longitude: Number(next.lng.toFixed(6))
              });
            }
          }}
        />
      </MapContainer>
    </div>
  );
}

function RecenterMap({ position }: { position: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position, map.getZoom(), { animate: true });
  }, [map, position]);

  return null;
}

function ClickToMovePin({ onChange }: { onChange: HotelPinPickerProps["onChange"] }) {
  useMapEvents({
    click(event) {
      onChange({
        latitude: Number(event.latlng.lat.toFixed(6)),
        longitude: Number(event.latlng.lng.toFixed(6))
      });
    }
  });

  return null;
}
