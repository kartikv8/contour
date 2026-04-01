import type { StyleSpecification } from "maplibre-gl";

const OPEN_STREET_MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors';

export const OSM_RASTER_STYLE: StyleSpecification = {
  version: 8,
  name: "OSM Raster",
  sources: {
    "osm-raster-tiles": {
      type: "raster",
      // Suitable for light/internal use in v1. For higher-volume production use,
      // switch to a dedicated hosted tile backend with an explicit SLA.
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: OPEN_STREET_MAP_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: "osm-raster-layer",
      type: "raster",
      source: "osm-raster-tiles",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

export const DEFAULT_MAP_VIEW = {
  center: [-98.5795, 39.8283] as [number, number],
  zoom: 3,
};
