import maplibregl, { LngLatLike, Map, NavigationControl } from "maplibre-gl";
import { DEFAULT_MAP_VIEW, MAP_STYLE_URL } from "./styles";

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
    style: MAP_STYLE_URL,
    center: DEFAULT_MAP_VIEW.center as LngLatLike,
    zoom: DEFAULT_MAP_VIEW.zoom,
  });

  map.addControl(new NavigationControl({ showZoom: true, showCompass: true }), "top-right");

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
