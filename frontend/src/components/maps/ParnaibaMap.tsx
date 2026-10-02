"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

const PARNAIBA_POSITION: [number, number] = [-2.905, -41.776];

export function ParnaibaMap() {
  return (
    // `isolate` cria um contexto de empilhamento próprio: os z-index altos do Leaflet (400 a 1000)
    // passam a valer só dentro do mapa, e ele não sobe por cima do cabeçalho fixo ao rolar.
    <section className="isolate min-w-0 overflow-hidden rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-950">Mapa</h2>
      </div>
      <div className="h-[320px]">
        <MapContainer
          center={PARNAIBA_POSITION}
          zoom={11}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker
            center={PARNAIBA_POSITION}
            radius={10}
            pathOptions={{ color: "#143A60", fillColor: "#E8531E", fillOpacity: 0.85 }}
          >
            <Popup>Parnaiba - PI</Popup>
          </CircleMarker>
        </MapContainer>
      </div>
    </section>
  );
}
