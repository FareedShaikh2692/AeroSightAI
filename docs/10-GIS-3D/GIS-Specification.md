# GIS / Mapping Specification

| | |
|---|---|
| **Document** | GIS / Mapping Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-18 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI — GIS Team |
| **Reviewer** | _Pending — GIS Lead, Surveying SME, Frontend Lead_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | GIS | Initial draft |

---

## 1. Scope

Covers spatial data model, coordinate systems, map engines, basemaps, layers, raster/vector pipelines, measurements and spatial queries. Requirements: MAP-001 – MAP-014, SITE-001 – SITE-012, SURVEY-001 – SURVEY-010.

## 2. Spatial Reference

| Item | Standard |
|---|---|
| Storage CRS | **EPSG:4326** (WGS 84) as PostGIS `geography` |
| Heights | Metres. Ellipsoidal (WGS 84) where available. Orthometric (EGM2008, EPSG:3855) when provided by the survey. The datum is recorded in metadata. |
| Display CRS | EPSG:3857 (Web Mercator) for 2D tiles. Cesium uses WGS 84 ellipsoid. |
| Survey native CRS | Preserved in `maps.native_crs` / `surveys.crs` (e.g. UTM zone EPSG:32640, local grids via PROJ string). Reprojected on ingest for display. Originals are kept. |
| Coordinate order | GeoJSON `[lon, lat, alt]` everywhere in APIs (RFC 7946) |
| Precision | Store full double precision. Display 6 decimals (~0.1 m). |
| Measurements | Geodesic (`ST_Distance/ST_Area` on geography; turf.js geodesic on the client) |

## 3. Spatial Entities

| Entity | Geometry | Table | Displayed as |
|---|---|---|---|
| Project location | Point | projects.location | Portfolio pin |
| Site boundary | MultiPolygon | sites.boundary | Outline + fill |
| Site centroid | Point | sites.centroid | Cluster pin at low zoom |
| No-fly zones | Polygon | site_no_fly_zones.geometry | Hatched red |
| Geofence buffer | Derived (`ST_Buffer(boundary, buffer_m)`) | computed | Dashed amber |
| Markers / annotations | Point / LineString / Polygon | annotations.geometry | User style |
| Flight paths (planned) | LineStringZ | drone_missions.path + mission_waypoints | Cyan line + numbered waypoints |
| Flight tracks (flown) | LineStringZ | drone_missions.flown_path / telemetry | Altitude gradient |
| Survey areas | Polygon | survey_areas.geometry | Amber outline |
| Assets | PointZ (+ optional geometry) | assets | Type icon |
| Inspection points / findings | PointZ | inspection_findings.location | Severity pin |
| Media capture points | PointZ | media.location | Camera icon with a heading cone |
| Drone live location | Point (streamed) | telemetry | Aircraft icon |
| Terrain | Raster (DTM) / quantized-mesh | maps (dtm) / provider | Hillshade / 3D terrain |
| Satellite imagery | Raster tiles | provider | Basemap |
| Orthomosaics / DSMs | Raster (COG) | maps | Raster layers by date |

## 4. Map Engines

| Mode | Engine | Notes |
|---|---|---|
| **2D Map** | MapLibre GL JS (vector tiles) | Default for all map views |
| **Satellite** | MapLibre raster basemap | Provider imagery (Esri World Imagery / Maxar via licensed provider / Mapbox Satellite, per contract) |
| **Terrain** | MapLibre `raster-dem` hillshade + 3D terrain (pitch) | Terrain-RGB tiles (e.g. MapTiler/Mapbox or self-hosted from Copernicus DEM GLO-30) |
| **3D** | CesiumJS | Global terrain + imagery + 3D Tiles |
| **Digital Twin** | CesiumJS + site models | See [Digital Twin](Digital-Twin.md) |

Basemap providers are configured through env vars (`MAP_STYLE_URL`, `MAP_SATELLITE_URL`, `MAP_TERRAIN_URL`, API keys). The fallback is OSM raster tiles (respecting the OSM tile usage policy; production should use a commercial or self-hosted OSM vector tile server, e.g. OpenMapTiles/Protomaps PMTiles on CDN).

## 5. Raster Pipeline (orthomosaic, DSM, DTM)

```text
Upload GeoTIFF (survey output) → scan → geo-processor worker:
  1. gdalinfo: validate georeference, CRS, bands, nodata, size
  2. If not COG: gdal_translate -of COG -co COMPRESS=DEFLATE|JPEG(ortho) -co BLOCKSIZE=512
        -co OVERVIEWS=AUTO -co PREDICTOR=2 (DSM)  [reproject to EPSG:3857 for display copy if needed]
  3. Compute bounds (EPSG:4326), resolution (cm/px), stats (DSM min/max/histogram)
  4. Store COG at org/{org}/maps/{mapId}/cog.tif ; create maps + map_layers rows
  5. DSM → hillshade COG for visualization
Display: TiTiler dynamic tiles  /tiles/{layerId}/{z}/{x}/{y}.webp?colormap=viridis&rescale=…
  → CDN cache (key includes layer_version) → signed cookie path-scoped per layer
```

Limits: ≤ 30 GB per GeoTIFF, ≤ 100,000 × 100,000 px. Larger requires a tiled upload (Future).

## 6. Vector Data

| Source | Delivery |
|---|---|
| Site features (boundaries, assets, findings, annotations, survey areas) | `GET /sites/:id/features` GeoJSON (≤ 10,000 features per request, bbox filter). Above that → vector tiles via `ST_AsMVT` endpoint `/sites/:id/mvt/{z}/{x}/{y}.pbf` |
| Portfolio pins | `GET /projects?view=map` lightweight GeoJSON |
| Flight tracks | Simplified with `ST_SimplifyPreserveTopology` (tolerance by zoom), full-resolution on demand |
| Imports | GeoJSON, KML/KMZ, Shapefile (zip with .prj required, else assume 4326 with a warning), DXF (contours; Phase 2), CSV with lat/lon |
| Exports | GeoJSON, KML, Shapefile (Phase 2), CSV |

## 7. Spatial Queries (server)

| Use | Query |
|---|---|
| Media auto-link | `ST_Covers(site.boundary, media.location)` and capture time within the mission window ± 30 min |
| Mission geofence validation | `ST_Covers(ST_Buffer(boundary, buffer), waypoint)` AND NOT `ST_Intersects(no_fly_zone, waypoint)` |
| Telemetry geofence alert | Prepared geometry in memory (turf/JSTS) for speed, cross-checked with PostGIS on alert |
| Media near asset | `ST_DWithin(media.location, asset.location, 30)` |
| Co-located photo comparison | `ST_DWithin(a.location, b.location, 15)` AND heading difference ≤ 30° |
| Bbox listing | `location && ST_MakeEnvelope(...)` with GIST |

## 8. Measurement Tools

| Tool | Method | Output |
|---|---|---|
| Distance | Geodesic polyline length | m / ft, segment lengths |
| Area | Geodesic polygon area | m² / ha / ft² / ac, perimeter |
| Point elevation | Sample DSM/DTM COG at the point (bilinear) | m (+ datum) |
| Elevation profile | Sample DSM along the line every max(GSD, length/500) | Chart + min/max/slope |
| Volume (SURVEY-009) | DSM grid vs. base surface within polygon (cell-wise integration at native resolution, server-side) | cut, fill, net (m³), area, method, base |
| Height (3D) | Cesium picking | m |

Accuracy disclaimer: measurement accuracy depends on survey accuracy (GCP RMSE shown when available).

## 9. Temporal Model

- Every raster map has `captured_at`. The site **capture timeline** lists dates from maps + media batches + twin models.
- Compare modes: swipe (two raster layers, same viewport), side-by-side (two synced maps), opacity blend.
- Change-detection results (AI-002) are stored as a raster layer + vector polygons tied to both dates.

## 10. Performance Requirements

- Feature payload ≤ 2 MB per request (gzip). Clustering above 200 points (MAP-003).
- Tiles: 256/512 px WebP. CDN hit rate target ≥ 90%. TiTiler p95 < 300 ms on a cache miss.
- Client: deck.gl for > 10,000 points (telemetry trails), MapLibre for the rest. Web Worker for heavy turf operations.

## 11. Licensing & Attribution

The map shows attribution for every provider (OSM, imagery vendor, terrain). Provider terms are checked for commercial SaaS use and caching. Customer-uploaded data remains customer-owned.
