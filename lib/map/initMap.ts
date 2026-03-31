import maplibregl, { LngLatLike, LngLatBounds, Map, NavigationControl } from "maplibre-gl";
import { DEFAULT_MAP_VIEW, MapStyleKey, getMapStyleUrl } from "./styles";

export type InitMapParams = {
  container: HTMLDivElement;
  styleKey: MapStyleKey;
  onCursorMove?: (coords: { lng: number; lat: number }) => void;
};

export type InitMapResult = {
  map: Map;
  setMapStyle: (styleKey: MapStyleKey) => Promise<void>;
  resetView: () => void;
  cleanup: () => void;
};

function waitForStyleLoad(map: Map): Promise<void> {
  return new Promise((resolve) => {
    if (map.isStyleLoaded()) {
      resolve();
      return;
    }

    const handleStyleData = () => {
      if (!map.isStyleLoaded()) {
        return;
      }
      map.off("styledata", handleStyleData);
      resolve();
    };

    map.on("styledata", handleStyleData);
  });
}

function getTransformRequest() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  return (url: string, resourceType?: string) => {
    if (!token || !url.startsWith("mapbox://")) {
      return { url };
    }

    if (url.startsWith("mapbox://sprites/")) {
      const path = url.replace("mapbox://sprites/", "");
      return { url: `https://api.mapbox.com/styles/v1/${path}?access_token=${token}` };
    }

    if (url.startsWith("mapbox://fonts/")) {
      const path = url.replace("mapbox://fonts/", "");
      return { url: `https://api.mapbox.com/fonts/v1/${path}?access_token=${token}` };
    }

    if (url.startsWith("mapbox://")) {
      const tilesetId = url.replace("mapbox://", "");
      return { url: `https://api.mapbox.com/v4/${tilesetId}.json?secure&access_token=${token}` };
    }

    return { url, resourceType };
  };
}

export function initMap({ container, styleKey, onCursorMove }: InitMapParams): InitMapResult {
  const map = new maplibregl.Map({
    container,
    style: getMapStyleUrl(styleKey),
    center: DEFAULT_MAP_VIEW.center as LngLatLike,
    zoom: DEFAULT_MAP_VIEW.zoom,
    transformRequest: getTransformRequest(),
  });

  map.addControl(new NavigationControl({ showZoom: true, showCompass: true }), "top-right");

  const handleMouseMove = (event: { lngLat: { lng: number; lat: number } }) => {
    onCursorMove?.({ lng: event.lngLat.lng, lat: event.lngLat.lat });
  };

  map.on("mousemove", handleMouseMove);

  const setMapStyle = async (nextStyleKey: MapStyleKey) => {
    map.setStyle(getMapStyleUrl(nextStyleKey));
    await waitForStyleLoad(map);
  };

  const resetView = () => {
    map.easeTo({ center: DEFAULT_MAP_VIEW.center as LngLatLike, zoom: DEFAULT_MAP_VIEW.zoom, duration: 500 });
  };

  const cleanup = () => {
    map.off("mousemove", handleMouseMove);
    map.remove();
  };

  return { map, setMapStyle, resetView, cleanup };
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
