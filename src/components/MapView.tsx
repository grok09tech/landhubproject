import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import PlotOrderModal from "./PlotOrderModal";
import { Plot, OrderData } from "../types/land";
import { plotService } from "../services/plotService";
import LoadingSpinner from "./LoadingSpinner";

// Fix Leaflet default icons
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Tanzania map bounds (approx)
const TANZANIA_BOUNDS: L.LatLngTuple[] = [
  [-11.75, 29.34], // SW
  [-0.95, 40.44], // NE
];

// Helpers
const getPlotColor = (status: Plot["status"]): string => {
  switch (status) {
    case "available":
      return "#10B981"; // green
    case "taken":
      return "#EF4444"; // red
    case "pending":
      return "#F59E0B"; // yellow
    default:
      return "#6B7280"; // gray
  }
};

const getStatusBadgeClass = (status: Plot["status"]): string => {
  switch (status) {
    case "available":
      return "bg-green-100 text-green-800 border border-green-200";
    case "taken":
      return "bg-red-100 text-red-800 border border-red-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    default:
      return "bg-gray-100 text-gray-800 border border-gray-200";
  }
};

interface FeatureProperties {
  plot_code: string;
  status: Plot["status"];
  area_hectares: number;
  village: string;
  ward: string;
  district: string;
  id: string;
}

// Validate GeoJSON geometry and coordinates
const isValidGeometry = (geometry: Plot["geometry"]): boolean => {
  if (!geometry || !geometry.type || !geometry.coordinates) return false;

  const isWithinTanzania = (lng: number, lat: number): boolean => {
    return lng >= 29.34 && lng <= 40.44 && lat >= -11.75 && lat <= -0.95;
  };

  if (geometry.type === "Polygon") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.every(ring =>
        Array.isArray(ring) &&
        ring.every(coord => Array.isArray(coord) && coord.length === 2 && isWithinTanzania(coord[0], coord[1]))
      )
    );
  }
  if (geometry.type === "MultiPolygon") {
    return (
      Array.isArray(geometry.coordinates) &&
      geometry.coordinates.every(poly =>
        Array.isArray(poly) &&
        poly.every(ring =>
          Array.isArray(ring) &&
          ring.every(coord => Array.isArray(coord) && coord.length === 2 && isWithinTanzania(coord[0], coord[1]))
        )
      )
    );
  }
  return false;
};

// Debug container styles
const debugElementStyles = (element: HTMLElement | null) => {
  if (!element) {
    console.error("[MapView] No element provided for debugging");
    return null;
  }

  // Set styles
  element.style.width = "100%";
  element.style.height = "100%";
  element.style.zIndex = "1";

  // Get computed styles
  const computedStyles = window.getComputedStyle(element);
  const parentStyles = element.parentElement ? window.getComputedStyle(element.parentElement) : null;

  // Collect data
  const data = {
    width: computedStyles.width,
    height: computedStyles.height,
    display: computedStyles.display,
    visibility: computedStyles.visibility,
    zIndex: computedStyles.zIndex,
    position: computedStyles.position,
    opacity: computedStyles.opacity,
    childrenCount: element.children.length,
    firstChildDisplay: element.firstElementChild ? window.getComputedStyle(element.firstElementChild).display : null,
    parent: parentStyles
      ? {
          width: parentStyles.width,
          height: parentStyles.height,
          display: parentStyles.display,
          visibility: parentStyles.visibility,
          zIndex: parentStyles.zIndex,
        }
      : null,
  };

  console.log("[MapView] Debug container styles:", data);
  return data;
};

const MapView: React.FC = () => {
  // Refs
  const mapRef = useRef<L.Map | null>(null);
  const plotLayerRef = useRef<L.GeoJSON | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // State
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [hasLoadedPlots, setHasLoadedPlots] = useState(false);

  /** 📌 Handles plot click */
  const handlePlotClick = useCallback(
    (plotId: string) => {
      const plot = plots.find((p) => p.id === plotId);
      if (!plot) {
        console.error("[MapView] Plot not found:", plotId);
        return;
      }
      if (plot.status === "available") {
        setSelectedPlot(plot);
        setIsModalOpen(true);
      }
    },
    [plots]
  );

  /** 📌 Create popup content */
  const createPopupContent = (feature: { properties: FeatureProperties }, plotId: string) => {
    const container = L.DomUtil.create("div", "p-3 min-w-[280px]");
    const { plot_code, status, area_hectares, village, ward, district } = feature.properties;

    const header = L.DomUtil.create("div", "flex justify-between items-start mb-2", container);
    const title = L.DomUtil.create("h3", "font-bold text-lg text-gray-800", header);
    title.textContent = `Plot ${plot_code}`;
    const badge = L.DomUtil.create("span", `px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(status)}`, header);
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);

    const details = L.DomUtil.create("div", "space-y-1 text-sm text-gray-600 mb-3", container);
    const area = L.DomUtil.create("div", "", details);
    area.textContent = `Area: ${area_hectares.toFixed(2)} hectares`;
    const location = L.DomUtil.create("div", "", details);
    location.textContent = `Location: ${village}, ${ward}`;
    const districtEl = L.DomUtil.create("div", "", details);
    districtEl.textContent = `District: ${district}`;

    if (status === "available") {
      const button = L.DomUtil.create(
        "button",
        "w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium",
        container
      );
      button.textContent = "Order This Plot";
      button.onclick = () => handlePlotClick(plotId);
    } else {
      const div = L.DomUtil.create(
        "div",
        "w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-center font-medium",
        container
      );
      div.textContent = "Plot Not Available";
    }

    return container;
  };

  /** 📌 Render plots */
  const renderPlots = useCallback(
    (plotsData: Plot[]) => {
      if (!mapRef.current || !isMapInitialized) {
        console.warn("[MapView] Cannot render plots: map is not initialized");
        setLoading(false);
        return;
      }

      if (plotLayerRef.current) {
        mapRef.current.removeLayer(plotLayerRef.current);
        plotLayerRef.current = null;
      }

      const validPlots = plotsData.filter(plot => isValidGeometry(plot.geometry));
      console.log("[MapView] First plot geometry:", validPlots[0]?.geometry);
      if (validPlots.length !== plotsData.length) {
        console.warn(`[MapView] Skipped ${plotsData.length - validPlots.length} invalid plot geometries`);
      }

      if (!validPlots.length) {
        console.warn("[MapView] No valid plots to render");
        mapRef.current.fitBounds(TANZANIA_BOUNDS);
        setLoading(false);
        return;
      }

      const geoJsonData = {
        type: "FeatureCollection" as const,
        features: validPlots.map((plot) => {
          const geometry =
            plot.geometry.type === "Polygon"
              ? {
                  type: "MultiPolygon" as const,
                  coordinates: [plot.geometry.coordinates],
                }
              : plot.geometry;

          return {
            type: "Feature" as const,
            properties: { ...plot },
            geometry,
          };
        }),
      };

      try {
        plotLayerRef.current = L.geoJSON(geoJsonData, {
          style: (feature) => {
            const status = feature?.properties?.status ?? "available";
            return {
              fillColor: getPlotColor(status),
              weight: 3,
              color: "#ffffff",
              fillOpacity: 0.9,
              dashArray: status === "pending" ? "5,5" : undefined,
            };
          },
          onEachFeature: (feature, layer) => {
            const plotId = feature.properties.id;
            layer.on({
              mouseover: (e) => {
                const target = e.target;
                target.setStyle({ weight: 5, fillOpacity: 1.0, color: "#000" });
                if (target.bringToFront) target.bringToFront();
              },
              mouseout: (e) => {
                if (plotLayerRef.current) {
                  plotLayerRef.current.resetStyle(e.target as L.Path);
                }
              },
            });

            layer.bindPopup(createPopupContent(feature, plotId), {
              maxWidth: 320,
              className: "custom-popup",
              closeButton: true,
              autoPan: true,
            });
          },
        }).addTo(mapRef.current);

        console.log("[MapView] Added", validPlots.length, "plots to map");
        const bounds = plotLayerRef.current.getBounds();
        console.log("[MapView] Plot bounds:", bounds.toBBoxString());
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
        } else {
          console.warn("[MapView] Invalid bounds for plots, using default bounds");
          mapRef.current.fitBounds(TANZANIA_BOUNDS);
        }
        mapRef.current.invalidateSize();
      } catch (err) {
        console.error("[MapView] Error rendering GeoJSON:", err);
        setError("Failed to render plots on map.");
      } finally {
        setLoading(false);
      }
    },
    [handlePlotClick, isMapInitialized]
  );

  /** 📌 Load plots */
  const loadPlots = useMemo(
    () =>
      async () => {
        if (!isMapInitialized || hasLoadedPlots) {
          console.warn("[MapView] Skipping plot loading: map not initialized or plots already loaded");
          return;
        }
        try {
          setLoading(true);
          setError(null);

          const plotsData = await plotService.getAllPlots();
          if (!plotsData?.length) {
            setError("No land plots available.");
            return;
          }

          setPlots(plotsData);
          setHasLoadedPlots(true);
          renderPlots(plotsData);
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            console.log("[MapView] Plot loading aborted");
            return;
          }
          console.error("[MapView] Error loading plots:", err);
          setError("Failed to load plots. Please check your network or try again.");
        } finally {
          setLoading(false);
        }
      },
    [renderPlots, isMapInitialized, hasLoadedPlots]
  );

  /** 📌 Initialize map */
  const initMap = useCallback(() => {
    if (!containerRef.current) {
      console.error("[MapView] Map container is null");
      setError("Map container not found.");
      return;
    }
    if (mapRef.current || initializingRef.current) return;
    initializingRef.current = true;

    // Debug container styles
    debugElementStyles(containerRef.current);

    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("[MapView] Map container has invalid dimensions:", rect);
      setError("Map container has invalid size. Please ensure it is visible.");
      initializingRef.current = false;
      return;
    }

    try {
      const map = L.map(containerRef.current, {
        center: [-10.369028, 35.888822], // Tanzania center
        zoom: 9,
        minZoom: 19,
        maxZoom: 23,
        attributionControl: true,
        zoomControl: true,
        maxBounds: TANZANIA_BOUNDS,
        maxBoundsViscosity: 0.3,
      });

      const osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: "&copy; OpenStreetMap contributors",
          errorTileUrl: "https://a.tile.openstreetmap.org/0/0/0.png",
        }
      ).on("tileerror", () => {
        console.warn("[MapView] OSM tile loading failed, switching to fallback");
        const fallbackLayer = L.tileLayer(
          "https://tile.openstreetmap.de/{z}/{x}/{y}.png",
          { attribution: "&copy; OpenStreetMap Deutschland" }
        );
        map.removeLayer(osmLayer);
        fallbackLayer.addTo(map);
      });

      const satelliteLayer = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
          attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
          errorTileUrl: "https://a.tile.openstreetmap.org/0/0/0.png",
        }
      ).on("tileerror", () => {
        console.warn("[MapView] Satellite tile loading failed");
      });

      osmLayer.addTo(map);

      L.control.layers(
        { "OpenStreetMap": osmLayer, "Satellite": satelliteLayer },
        {}
      ).addTo(map);

      L.control.scale({ metric: true, imperial: false }).addTo(map);

      mapRef.current = map;
      map.invalidateSize();
      setIsMapInitialized(true);
      console.log("[MapView] Map initialized successfully");
    } catch (err) {
      console.error("[MapView] Failed to initialize map:", err);
      setError("Failed to initialize map. Please refresh the page.");
    } finally {
      initializingRef.current = false;
    }
  }, []);

  /** 📌 Handle order submission */
  const handleOrderSubmit = useCallback(
    async (orderData: OrderData) => {
      if (!selectedPlot) {
        setOrderError("No plot selected.");
        return;
      }
      setOrderError(null);
      try {
        await plotService.createOrder(selectedPlot.id, orderData);
        const updatedPlots = plots.map((p) =>
          p.id === selectedPlot.id ? { ...p, status: "pending" as const } : p
        );
        setPlots(updatedPlots);
        setHasLoadedPlots(false); // Allow reloading plots after order
        renderPlots(updatedPlots);
        setSelectedPlot(null);
        setIsModalOpen(false);
      } catch (err) {
        console.error("[MapView] Order submission failed:", err);
        setOrderError("Failed to submit order. Please try again.");
      }
    },
    [selectedPlot, plots, renderPlots]
  );

  /** 📌 Initialize map */
  useEffect(() => {
    initMap();
    return () => {
      if (plotLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(plotLayerRef.current);
        plotLayerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsMapInitialized(false);
      setHasLoadedPlots(false);
    };
  }, [initMap]);

  /** 📌 Load plots after map initialization */
  useEffect(() => {
    if (!isMapInitialized || hasLoadedPlots) return;

    const controller = new AbortController();
    abortControllerRef.current = controller;
    loadPlots();

    return () => {
      controller.abort();
      abortControllerRef.current = null;
    };
  }, [isMapInitialized, hasLoadedPlots, loadPlots]);

  return (
    <div className="h-full w-full relative">
      {/* Map container */}
      <div
        ref={containerRef}
        className="h-full w-full bg-gray-200"
        style={{ minHeight: "80px", height: "10vh", zIndex: 1 }}
      />

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-[10]">
          <LoadingSpinner />
          <p className="mt-2 text-sm text-gray-600">Loading plots...</p>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 z-[10]">
          <div className="text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <button
              className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg"
              onClick={() => {
                setError(null);
                setHasLoadedPlots(false);
                initMap();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Order error */}
      {orderError && (
        <div className="absolute top-4 left-4 bg-red-100 text-red-800 p-4 rounded-lg shadow z-[10]">
          <p>{orderError}</p>
          <button
            className="mt-2 text-sm underline"
            onClick={() => setOrderError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Stats */}
      {plots.length > 0 && !loading && !error && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow px-4 py-2 text-sm z-[10]">
          <div>{plots.length} plots loaded</div>
          <div className="flex gap-3 text-xs mt-1">
            <span className="flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
              {plots.filter((p) => p.status === "available").length} available
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-1" />
              {plots.filter((p) => p.status === "taken").length} taken
            </span>
            <span className="flex items-center">
              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1" />
              {plots.filter((p) => p.status === "pending").length} pending
            </span>
          </div>
        </div>
      )}

      {/* Order modal */}
      {isModalOpen && selectedPlot && (
        <PlotOrderModal
          plot={selectedPlot}
          onClose={() => {
            setSelectedPlot(null);
            setIsModalOpen(false);
          }}
          onSubmit={handleOrderSubmit}
        />
      )}
    </div>
  );
};

export default MapView;