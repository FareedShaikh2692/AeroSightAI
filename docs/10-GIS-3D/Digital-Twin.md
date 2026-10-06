# 3D Digital Twin Specification

| | |
|---|---|
| **Document** | 3D Digital Twin Specification |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-19 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI — GIS/3D Team |
| **Reviewer** | _Pending — GIS Lead, Frontend Lead, Product Owner_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | GIS/3D | Initial draft |

---

## 1. Purpose & Status

A navigable, georeferenced 3D representation of each site, combining terrain, photogrammetry meshes, BIM models, point clouds, assets, inspection markers, survey boundaries and flight paths, with history over time.

**BR:** BR-08, BR-10 · **Feature:** FEAT-TWIN · **Requirements:** TWIN-001 – TWIN-012 · **Phase:** 3 (Planned). A **Prototype** viewer for uploaded 3D Tiles may be enabled in Phase 2 behind the `twin.viewer` flag.

## 2. Scene Composition

| Layer | Source | Format (delivered) | Notes |
|---|---|---|---|
| Global terrain | Cesium World Terrain / Copernicus DEM | quantized-mesh | Licensed or self-hosted |
| Site terrain (high-res) | Survey DTM | quantized-mesh (generated via `cesium-terrain-builder` / `ctod`) or heightmap | Phase 3+ |
| Imagery | Basemap satellite + site orthomosaic (COG → imagery provider) | WMTS/XYZ | Orthomosaic draped on terrain |
| Photogrammetry mesh | Survey output / processing engine | **3D Tiles 1.1** (b3dm/glb content) | Primary "reality" model |
| BIM | IFC 2x3/4 | 3D Tiles (glTF content, with metadata/property tables) | Georeferenced via IfcMapConversion or a manual transform |
| Point cloud | LAS/LAZ/COPC | 3D Tiles (pnts / glTF + EXT_mesh_features) | Point budget control |
| Building models (simple) | GLB/glTF upload | glTF placed by transform | For small site objects |
| Assets | DB | Billboards / 3D icons / extruded footprints | Clamped to ground or at Z |
| Inspection markers | DB | Billboards with severity color, leader lines | |
| Survey boundaries & areas | DB | Ground-clamped polylines/polygons | |
| Drone paths | Missions/telemetry | Polylines (planned dashed, flown solid altitude-colored) | Live drone glTF model in Phase 3 |
| Historical models | Multiple twin_models by `captured_at` | Same as above | History slider |

## 3. Supported 3D File Formats (ingest)

| Format | Ingest | Conversion | Max size |
|---|---|---|---|
| 3D Tiles (zip with tileset.json) | ✓ | Validate (3d-tiles-validator), rewrite URIs | 50 GB |
| OBJ (+MTL, textures, zip) | ✓ | obj → glTF → 3D Tiles (e.g. `obj2gltf` + tiler) | 10 GB |
| glTF / GLB | ✓ | Draco/Meshopt compression, KTX2 textures; tile if > 200 MB | 5 GB |
| FBX | Phase 4 | via Blender/assimp headless | — |
| IFC | ✓ (Phase 3) | IfcOpenShell → glTF with property tables → 3D Tiles | 2 GB |
| LAS / LAZ / COPC | ✓ | PDAL pipeline (filter, reproject) → 3D Tiles point cloud (py3dtiles / entwine-equivalent) | 50 GB / 5 billion points |
| E57 | Phase 4 | PDAL | — |

Conversion runs in `geo.3dtiles` workers (CPU-heavy, spot instances, 16 vCPU / 64 GB) with progress reporting. Outputs go to `org/{org}/twin/{modelId}/tiles/`.

## 4. Rendering Strategy

- **Engine:** CesiumJS (WebGL2), lazy-loaded only on the twin route (~3 MB gz).
- **Streaming:** 3D Tiles hierarchical LOD (HLOD). Tiles are fetched by screen-space error (SSE).
- **Delivery:** CloudFront with signed cookies scoped to `org/{org}/twin/{modelId}/*`. HTTP/2, Brotli for JSON, immutable cache headers (versioned paths).
- **Georeferencing:** model `transform` (ENU at origin + rotation/scale) stored in `twin_models.transform`. A UI tool supports manual alignment (3-point registration) when georeference is missing.
- **Picking & metadata:** `EXT_structural_metadata` for BIM properties. Feature IDs map to assets via `assets.bim_guid`.
- **Styling:** 3D Tiles styling language (e.g. colorize BIM by status, highlight elements with open findings).
- **Clipping:** clipping planes/boxes for section views.
- **Comparison:** split-screen with two models (Cesium `splitDirection`) or a history slider swapping visibility.

## 5. Performance Optimization

| Technique | Setting |
|---|---|
| Screen-space error | `maximumScreenSpaceError` 16 (High), 24 (Balanced), 48 (Performance) |
| Memory budget | `cacheBytes` 512 MB desktop, 256 MB tablet, 128 MB low tier |
| Geometry compression | Draco or Meshopt for meshes. Quantized positions for point clouds. |
| Textures | KTX2/Basis Universal (UASTC for detail, ETC1S for size). Max 2048² per tile texture. |
| Point budget | 2M points desktop, 750k tablet, eye-dome lighting optional |
| Resolution scale | `resolutionScale` 1.0 / 0.85 / 0.7 by tier, dynamic when FPS < target |
| Frustum/occlusion | Built-in culling. Skip LOD (`skipLevelOfDetail`) for faster first view |
| Request scheduling | Prioritize foveated (center of screen) tiles. Cancel offscreen requests. |
| Request render mode | `requestRenderMode=true` (render only on change) to save battery |
| Overlays | Billboards batched. Clustering for > 500 markers. |

Targets: NFR-PERF-009 (first meaningful frame < 5 s p75), NFR-PERF-010 (≥ 30 fps desktop, ≥ 20 fps tablet).

## 6. Level of Detail (LOD) Policy

| LOD | Content | Typical geometric error |
|---|---|---|
| L0 | Site footprint + simplified mesh (≤ 50k triangles) | 16–32 m |
| L1 | Medium mesh tiles | 4–8 m |
| L2 | Full-resolution mesh tiles | 0.5–2 m |
| L3 | Detail tiles (close-range inspection captures) | < 0.25 m |

BIM: element-level LOD (merged per storey at far range, per element near). Point clouds: octree levels per tile.

## 7. Device Tiers, Mobile Fallback & 2D Fallback

| Tier | Detection | Behavior |
|---|---|---|
| High | WebGL2 + discrete GPU (renderer string) or ≥ 8 GB device memory | High quality |
| Medium | WebGL2, integrated GPU, ≥ 4 GB | Balanced |
| Low | WebGL2 but ≤ 4 GB memory / mobile phones / `saveData` | Performance mode, no shadows, point budget 500k, mesh L1 cap. Phones show a prompt: "3D may be slow on this device — open 2D map instead?" |
| None | No WebGL2 / context lost twice | **2D fallback:** route to the Maps view with the latest orthomosaic, asset and finding layers, and a banner explaining why |

Mobile: touch gestures (one-finger orbit, two-finger pan/zoom, two-finger rotate), simplified panels (bottom sheet), no split compare (sequential toggle instead).

On WebGL context loss, the viewer attempts one automatic restore. On a second loss it falls back to 2D.

## 8. Functional Requirements

| ID | Requirement |
|---|---|
| TWIN-001 | Global terrain + imagery with site orthomosaic draped |
| TWIN-002 | Stream photogrammetry 3D Tiles with LOD |
| TWIN-003 | BIM (IFC → 3D Tiles) georeferenced, with properties on click |
| TWIN-004 | Point clouds with point budget and size/color controls (RGB, elevation, classification) |
| TWIN-005 | Overlays: boundary, assets, findings, survey areas, planned/flown paths |
| TWIN-006 | History slider and split comparison across capture dates |
| TWIN-007 | Identify: click → asset/finding/BIM details panel |
| TWIN-008 | 3D measurements (distance with H/V components, height, surface area) |
| TWIN-009 | Live drone model during active missions (telemetry channel) |
| TWIN-010 | Adaptive quality per device tier and FPS |
| TWIN-011 | 2D fallback |
| TWIN-012 | Saved viewpoints usable in reports (rendered server-side via headless Chromium + Cesium for PDF snapshots) |

## 9. API & Data

`twin_models`, `viewpoints` tables. Endpoints: `GET /twin/models?siteId`, `POST /twin/models`, `GET /twin/models/:id/tileset`, `GET/POST /viewpoints`. See [API §6.13](../06-API/API-Specification.md#613-surveys-maps--twin).

## 10. Acceptance Criteria (summary)

- AC-TWIN-01: A 2 GB photogrammetry model of a 5 ha site renders a first meaningful frame in < 5 s (p75) on the reference laptop with ≥ 30 fps while orbiting.
- AC-TWIN-02: The history slider switches between ≥ 3 captures with the camera position preserved.
- AC-TWIN-03: Clicking a BIM element linked to an asset opens the asset panel with open findings.
- AC-TWIN-04: On a device without WebGL2, the user lands on the 2D map with an explanatory banner and no errors.
