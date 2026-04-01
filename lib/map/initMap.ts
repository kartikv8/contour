import maplibregl, {
  AttributionControl,
  LngLatLike,
  LngLatBounds,
  Map,
  NavigationControl,
} from "maplibre-gl";
import { DEFAULT_MAP_VIEW, OSM_RASTER_STYLE } from "./styles";

export type InitMapParams = {
  container: HTMLDivElement;
  onCursorMove?: (coords: { lng: number; lat: number }) => void;
};

export type InitMapResult = {
  map: Map;
  resetView: () => void;
  cleanup: () => void;
};

export function initMap({ container, onCursorMove }: InitMapParams): InitMapResult {
  const map = new maplibregl.Map({
    container,
    style: OSM_RASTER_STYLE,
    center: DEFAULT_MAP_VIEW.center as LngLatLike,
    zoom: DEFAULT_MAP_VIEW.zoom,
    attributionControl: false,
  });

  map.addControl(new NavigationControl({ showZoom: true, showCompass: true }), "top-right");
  map.addControl(new AttributionControl({ compact: false }), "bottom-right");

  const handleMouseMove = (event: { lngLat: { lng: number; lat: number } }) => {
    onCursorMove?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
  };

  map.on("mousemove", handleMouseMove);

  const resetView = () => {
    map.easeTo({ center: DEFAULT_MAP_VIEW.center as LngLatLike, zoom: DEFAULT_MAP_VIEW.zoom, duration: 500 });
  };

  const cleanup = () => {
    map.off("mousemove", handleMouseMove);
    map.remove();
  };

  return { map, resetView, cleanup };
}

export function fitMapToMultiPolygon(map: Map, geometry: GeoJSON.MultiPolygon) {
  const bounds = new LngLatBounds();
  let hasPoint = false;

  geometry.coordinates.forEach((polygon) => {
    polygon.forEach((ring) => {
      ring.forEach(([lng, lat]) => {
        bounds.extend([lng, lat]);
        hasPoint = true;
      });
    });
  });

  if (hasPoint) {
    map.fitBounds(bounds, { padding: 48, duration: 500 });
  }
}
