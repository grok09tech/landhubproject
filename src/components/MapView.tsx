import React, { useEffect, useState, useRef, useCallback } from "react";
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

// Helpers (unchanged)
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
  block_number?: string;
  plot_number?: string;
  attributes?: any; // Shapefile attributes from database
}

// Enhanced geometry validation (unchanged)
const isValidGeometry = (geometry: any): boolean => {
  if (!geometry || !geometry.type || !geometry.coordinates) {
    console.warn("[MapView] Invalid geometry: missing required properties");
    return false;
  }

  const isValidCoordinate = (coord: any): boolean => {
    return (
      Array.isArray(coord) &&
      coord.length >= 2 &&
      typeof coord[0] === "number" &&
      typeof coord[1] === "number" &&
      !isNaN(coord[0]) &&
      !isNaN(coord[1]) &&
      isFinite(coord[0]) &&
      isFinite(coord[1])
    );
  };

  const isReasonableCoordinate = (lng: number, lat: number): boolean => {
    return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
  };

  try {
    if (geometry.type === "Polygon") {
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
        return false;
      }
      return geometry.coordinates.every((ring: any) => {
        if (!Array.isArray(ring) || ring.length < 4) {
          return false;
        }
        return ring.every((coord) => {
          if (!isValidCoordinate(coord)) {
            return false;
          }
          if (!isReasonableCoordinate(coord[0], coord[1])) {
            return false;
          }
          return true;
        });
      });
    }

    if (geometry.type === "MultiPolygon") {
      if (!Array.isArray(geometry.coordinates) || geometry.coordinates.length === 0) {
        return false;
      }
      return geometry.coordinates.every((polygon: any) => {
        if (!Array.isArray(polygon) || polygon.length === 0) {
          return false;
        }
        return polygon.every((ring) => {
          if (!Array.isArray(ring) || ring.length < 4) {
            return false;
          }
          return ring.every((coord) => {
            if (!isValidCoordinate(coord)) {
              return false;
            }
            if (!isReasonableCoordinate(coord[0], coord[1])) {
              return false;
            }
            return true;
          });
        });
      });
    }

    return false;
  } catch (error) {
    console.error("[MapView] Error validating geometry:", error);
    return false;
  }
};

// Calculate polygon centroid (unchanged)
const getPolygonCentroid = (coordinates: number[][][]): [number, number] => {
  try {
    const ring = coordinates[0]; // Outer ring
    if (!ring || ring.length < 4) {
      return [0, 0];
    }

    let area = 0;
    let x = 0;
    let y = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const a = x0 * y1 - x1 * y0;
      area += a;
      x += (x0 + x1) * a;
      y += (y0 + y1) * a;
    }

    if (Math.abs(area) < 1e-10) {
      const avgX = ring.reduce((sum, coord) => sum + coord[0], 0) / ring.length;
      const avgY = ring.reduce((sum, coord) => sum + coord[1], 0) / ring.length;
      return [avgX, avgY];
    }

    area *= 0.5;
    return [x / (6 * area), y / (6 * area)];
  } catch (error) {
    console.error("[MapView] Error calculating centroid:", error);
    return [0, 0];
  }
};

// Debug container styles (unchanged)
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
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializingRef = useRef(false);
  const plotsRef = useRef<Plot[]>([]); // Store plots in ref for popup callbacks

  // State
  const [plots, setPlots] = useState<Plot[]>([]);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMapInitialized, setIsMapInitialized] = useState(false);

  // Changed: Removed hasLoadedPlots state, using plots.length to track loaded state
  // This simplifies the logic and prevents unnecessary re-renders

  /** 📌 Handles plot click */
  const handlePlotClick = useCallback(
    (plotId: string) => {
      console.log('[MapView] handlePlotClick called with plotId:', plotId);
      console.log('[MapView] Available plots in ref (first 3):', plotsRef.current.slice(0, 3).map(p => ({ id: p.id, plot_code: p.plot_code })));

      // Try to find plot by id first
      let plot = plotsRef.current.find((p) => p.id === plotId);

      // If not found by id, try by plot_code
      if (!plot) {
        plot = plotsRef.current.find((p) => p.plot_code === plotId);
        console.log('[MapView] Found plot by plot_code:', plot ? plot.id : 'not found');
      }

      // If still not found, try partial match on id
      if (!plot) {
        plot = plotsRef.current.find((p) => p.id && p.id.includes(plotId));
        console.log('[MapView] Found plot by partial id match:', plot ? plot.id : 'not found');
      }

      if (!plot) {
        console.error("[MapView] Plot not found with any method:", plotId);
        return;
      }

      console.log('[MapView] Found plot:', { id: plot.id, plot_code: plot.plot_code, status: plot.status });
      if (plot.status === "available") {
        console.log('[MapView] Opening modal for plot:', plotId);
        setSelectedPlot(plot);
        setIsModalOpen(true);
      } else {
        console.log('[MapView] Plot not available:', plot.status);
      }
    },
    []
  );  /** 📌 Create popup content (unchanged) */
  const createPopupContent = useCallback((feature: { properties: FeatureProperties }, plotId: string) => {
    const container = L.DomUtil.create("div", "p-3 min-w-[320px] max-w-[400px]");
    const { plot_code, status, area_hectares, block_number, plot_number, attributes } = feature.properties;

    // Convert to square meters
    const areaSquareMeters = (area_hectares * 10000).toLocaleString();

    // Extract all data from attributes (shapefile data)
    const blockNumber = attributes?.Block_numb || attributes?.block_numb || block_number || 'N/A';
    const intendedUse = attributes?.Land_use || attributes?.land_use || 'Not specified';
    const plotNumber = attributes?.Plot_Numb || attributes?.plot_numb || plot_number || plot_code;
    const registrationNumber = attributes?.reg_pn || attributes?.Reg_pn || 'N/A';
    const locality = attributes?.Locality || attributes?.locality || 'N/A';
    const council = attributes?.Council || attributes?.council || 'N/A';
    const region = attributes?.Region || attributes?.region || 'N/A';
    const titlePlanNumber = attributes?.tp_number || attributes?.Tp_number || 'N/A';
    const unit = attributes?.Unit || attributes?.unit || 'Sqm';
    const fid = attributes?.fid || attributes?.FID || 'N/A';
    const calculatedArea = attributes?.Cal_Area || attributes?.cal_area || area_hectares;

    const header = L.DomUtil.create("div", "flex justify-between items-start mb-3", container);
    const title = L.DomUtil.create("h3", "font-bold text-lg text-gray-800", header);
    title.textContent = `Plot ${plot_code}`;
    const badge = L.DomUtil.create("span", `px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(status)}`, header);
    badge.textContent = status.charAt(0).toUpperCase() + status.slice(1);

    const details = L.DomUtil.create("div", "space-y-2 text-sm text-gray-600 mb-4", container);

    // Basic information
    const area = L.DomUtil.create("div", "flex justify-between", details);
    area.innerHTML = `<strong>Area:</strong> <span>${areaSquareMeters} ${unit}</span>`;

    const blockNum = L.DomUtil.create("div", "flex justify-between", details);
    blockNum.innerHTML = `<strong>Block Number:</strong> <span>${blockNumber}</span>`;

    const plotNum = L.DomUtil.create("div", "flex justify-between", details);
    plotNum.innerHTML = `<strong>Plot Number:</strong> <span>${plotNumber}</span>`;

    // Land use information
    const landUse = L.DomUtil.create("div", "flex justify-between", details);
    landUse.innerHTML = `<strong>Intended Use:</strong> <span>${intendedUse}</span>`;

    // Registration information
    const regNum = L.DomUtil.create("div", "flex justify-between", details);
    regNum.innerHTML = `<strong>Registration No:</strong> <span>${registrationNumber}</span>`;

    const tpNum = L.DomUtil.create("div", "flex justify-between", details);
    tpNum.innerHTML = `<strong>Title Plan No:</strong> <span>${titlePlanNumber}</span>`;

    // Location information
    const loc = L.DomUtil.create("div", "flex justify-between", details);
    loc.innerHTML = `<strong>Locality:</strong> <span>${locality}</span>`;

    const coun = L.DomUtil.create("div", "flex justify-between", details);
    coun.innerHTML = `<strong>Council:</strong> <span>${council}</span>`;

    const reg = L.DomUtil.create("div", "flex justify-between", details);
    reg.innerHTML = `<strong>Region:</strong> <span>${region}</span>`;

    // Additional technical information
    const fidInfo = L.DomUtil.create("div", "flex justify-between", details);
    fidInfo.innerHTML = `<strong>FID:</strong> <span>${fid}</span>`;

    const calcArea = L.DomUtil.create("div", "flex justify-between", details);
    calcArea.innerHTML = `<strong>Calculated Area:</strong> <span>${calculatedArea} ${unit}</span>`;

    if (status === "available") {
      const button = L.DomUtil.create(
        "button",
        "w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium cursor-pointer mt-3",
        container
      );
      button.textContent = "Order This Plot";
      button.type = "button"; // Ensure it's not treated as a submit button

      // Use standard addEventListener for reliable event handling
      button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('[MapView] Order button clicked for plot:', plotId);
        handlePlotClick(plotId);
      });

      // Prevent map interactions when clicking the button
      L.DomEvent.disableClickPropagation(button);
    } else {
      const div = L.DomUtil.create(
        "div",
        "w-full px-4 py-2 bg-gray-300 text-gray-600 rounded-lg text-center font-medium mt-3",
        container
      );
      div.textContent = "Plot Not Available";
    }

    return container;
  }, [handlePlotClick]);

  /** 📌 Create plot labels (unchanged) */
  const createPlotLabels = useCallback((plotsData: Plot[]) => {
    if (!mapRef.current) return;

    // Remove existing labels
    if (labelLayerRef.current) {
      mapRef.current.removeLayer(labelLayerRef.current);
    }

    labelLayerRef.current = L.layerGroup();

    plotsData.forEach((plot, index) => {
      if (!isValidGeometry(plot.geometry)) {
        return;
      }

      let centroid: [number, number];

      const geom = plot.geometry as any;
      if (geom.type === "Polygon") {
        centroid = getPolygonCentroid(geom.coordinates);
      } else if (geom.type === "MultiPolygon") {
        // Use centroid of first polygon
        centroid = getPolygonCentroid(geom.coordinates[0]);
      } else {
        return;
      }

      // Validate centroid
      if (isNaN(centroid[0]) || isNaN(centroid[1])) {
        return;
      }

      // Extract just the numeric part from plot code (e.g., "test_mbuyuni_0019" -> "0019")
      const extractPlotNumber = (plotCode: string): string => {
        const match = plotCode.match(/(\d+)$/);
        return match ? match[1] : plotCode;
      };

      const plotNum = extractPlotNumber((plot as any).plot_number || plot.plot_code || plot.id || `Plot-${index}`);

      const labelIcon = L.divIcon({
        className: "plot-label",
        html: `<div style="
          background: rgba(255, 255, 255, 0.9);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: bold;
          font-size: 11px;
          color: #333;
          text-shadow: 1px 1px 1px rgba(255,255,255,0.8);
          border: 1px solid rgba(0,0,0,0.3);
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
          white-space: nowrap;
        ">${plotNum}</div>`,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const labelMarker = L.marker([centroid[1], centroid[0]], {
        icon: labelIcon,
        interactive: false,
        zIndexOffset: 1000,
      });

      labelLayerRef.current?.addLayer(labelMarker);
    });

    if (labelLayerRef.current) {
      labelLayerRef.current.addTo(mapRef.current);
    }
  }, []);

  /** 📌 Render plots */
  const renderPlots = useCallback(
    (plotsData: Plot[]) => {
      console.log('[MapView] renderPlots called with', plotsData.length, 'plots');
      if (!mapRef.current || !isMapInitialized) {
        console.warn("[MapView] Cannot render plots: map is not initialized");
        setLoading(false);
        return;
      }

      if (plotLayerRef.current) {
        mapRef.current.removeLayer(plotLayerRef.current);
        plotLayerRef.current = null;
      }

      const validPlots = plotsData.filter((plot) => isValidGeometry(plot.geometry));
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
        features: validPlots.map((plot, index) => {
          return {
            type: "Feature" as const,
            properties: {
              ...plot,
              plot_code: plot.plot_code || plot.id || `Plot-${index}`,
              status: plot.status || "available",
              area_hectares: plot.area_hectares || 0,
              village: plot.village || "Unknown",
              ward: plot.ward || "Unknown",
              district: plot.district || "Unknown",
              id: plot.id || `plot-${index}`,
              block_number: (plot as any).block_number || "N/A",
              plot_number: (plot as any).plot_number || plot.plot_code || plot.id,
              attributes: plot.attributes || {}, // Explicitly include attributes
            },
            geometry: plot.geometry,
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
            const correspondingPlot = plotsData.find(p => p.id === plotId);
            console.log('[MapView] onEachFeature - plotId from feature:', plotId, 'found corresponding plot:', correspondingPlot ? correspondingPlot.id : 'not found');
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
        createPlotLabels(validPlots);
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
    [isMapInitialized, createPlotLabels, createPopupContent]
  );

  const loadingPlotsRef = useRef(false);

  /** 📌 Load plots */
  const loadPlots = useCallback(async () => {
    console.log('[MapView] loadPlots called - isMapInitialized:', isMapInitialized, 'plots.length:', plots.length, 'loading:', loadingPlotsRef.current);

    // Only load if map is initialized
    if (!isMapInitialized) {
      console.warn("[MapView] Skipping plot loading: map not initialized");
      return;
    }

    // Prevent duplicate loading
    if (loadingPlotsRef.current) {
      console.warn("[MapView] Skipping plot loading: already loading");
      return;
    }

    // Don't load if we already have plots
    if (plotsRef.current.length > 0) {
      console.warn("[MapView] Skipping plot loading: plots already loaded");
      return;
    }

    loadingPlotsRef.current = true;

    try {
      setLoading(true);
      setError(null);

      console.log('[MapView] Starting to load plots from API...');
      const plotsData = await plotService.getAllPlots();
      console.log('[MapView] Received plots data:', plotsData?.length || 0, 'plots');

      if (!plotsData?.length) {
        setError("No land plots available.");
        return;
      }

      console.log('[MapView] Setting plots state with', plotsData.length, 'plots');
      setPlots(plotsData);
      plotsRef.current = plotsData; // Store in ref for popup callbacks
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
      loadingPlotsRef.current = false;
    }
  }, [isMapInitialized, renderPlots]);

  /** 📌 Initialize map */
  const initMap = useCallback(() => {
    if (!containerRef.current) {
      console.error("[MapView] Map container is null");
      setError("Map container not found.");
      return;
    }
    if (mapRef.current || initializingRef.current) {
      console.warn("[MapView] Map already initialized or initializing");
      return;
    }
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
        center: [-6.369028, 34.888822], // Tanzania center
        zoom: 6,
        minZoom: 10,
        maxZoom: 46,
        attributionControl: true,
        zoomControl: true,
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
        const updatedPlots = plotsRef.current.map((p) =>
          p.id === selectedPlot.id ? { ...p, status: "pending" as const } : p
        );
        setPlots(updatedPlots);
        plotsRef.current = updatedPlots; // Update ref as well
        renderPlots(updatedPlots);
        setSelectedPlot(null);
        setIsModalOpen(false);
      } catch (err) {
        console.error("[MapView] Order submission failed:", err);
        setOrderError("Failed to submit order. Please try again.");
      }
    },
    [selectedPlot, renderPlots]
  );

  /** 📌 Initialize map and load plots */
  useEffect(() => {
    // Initialize map
    initMap();

    // Cleanup
    return () => {
      if (plotLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(plotLayerRef.current);
        plotLayerRef.current = null;
      }
      if (labelLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(labelLayerRef.current);
        labelLayerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setIsMapInitialized(false);
    };
  }, [initMap]);

  /** 📌 Load plots after map initialization */
  useEffect(() => {
    if (isMapInitialized) {
      loadPlots();
    }
  }, [isMapInitialized, loadPlots]);

  return (
    <div className="h-full w-full relative">
      {/* Map container */}
      <div
        ref={containerRef}
        className="h-full w-full bg-gray-200"
        style={{ minHeight: "500px", height: "100%" }}
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
                setPlots([]); // Reset plots to allow reloading
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