# Video Streaming Architecture

| | |
|---|---|
| **Document** | Video Streaming Architecture |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-16 |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Architecture |
| **Reviewer** | _Pending — Tech Lead, SRE Lead, Security Engineer_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Architecture | Initial draft |

---

## 1. Scope

This document covers recorded video (Phase 1, **Implemented**) and live video (Phase 2, **Integration Required** — it depends on a provider adapter with the `liveVideo` capability). Requirements: VIDEO-001 – VIDEO-010.

## 2. Recorded Video Pipeline

```text
Drone SD card / provider media sync
      │
      ▼
Upload (browser multipart → S3 quarantine bucket, or provider sync worker → quarantine)
      │  POST /media/uploads/:id/complete
      ▼
Malware scan (ClamAV worker; files > 4 GB: container-structure validation via ffprobe + sampled scan)
      │ clean
      ▼
Object Storage (media bucket): org/{orgId}/media/{mediaId}/original.{ext}
      │ enqueue video.transcode
      ▼
Processing (FFmpeg workers, CPU; GPU NVENC optional)
  1. ffprobe → codec, resolution, fps, duration, rotation, embedded metadata
  2. Extract DJI SRT/telemetry track if present → media_metadata.track (GeoJSON LineString with timestamps)
  3. Transcode HLS (fMP4 segments, 4 s, closed GOP 2 s):
        1080p  H.264 High  6 Mbps   (only if source ≥ 1080p)
         720p  H.264 Main  3 Mbps
         480p  H.264 Main  1.2 Mbps
     (H.265 source decoded. Output H.264 for browser compatibility. AV1 ladder Future Scope.)
  4. Poster (frame at 10%), thumbnail (256 px), sprite sheet (1 frame / 5 s, for scrub previews), WebVTT for sprites
      │
      ▼
Thumbnail + Metadata → media.status = ready, duration, renditions → event media.ready
      │
      ▼
Streaming URL: GET /media/:id/playback → { manifestUrl, expiresAt }
  CloudFront signed cookies scoped to org/{orgId}/media/{mediaId}/hls/*  (TTL 1 h, refreshed by the player)
```

| Concern | Decision |
|---|---|
| Max upload | 20 GB per file (MEDIA-001) |
| Originals | Retained (download needs `media:download`). Lifecycle to infrequent-access after 180 days. |
| Processing SLA | ≤ 1× realtime p95 for 1080p (NFR-PERF-013) |
| Failure | 3 retries. Then `status=failed` with `processing_error`. The user can retry. The original is retained. |
| Cost metering | `video_processing_minutes` usage record per transcode (VIDEO-010) |

## 3. Live Video Architecture

```text
Drone ──(RC / dock link)── Provider app / dock / edge bridge
                              │  push:  RTMP  | RTSP (pull by gateway) | WHIP (WebRTC ingest)
                              ▼
                     Streaming Gateway (MediaMTX in Phase 2; LiveKit when > 100 concurrent streams)
                       · per-stream publish key (random 32 bytes, single mission, expires at mission end)
                       · transmux, no transcode by default (H.264 passthrough)
                       · optional record → S3 (VIDEO-008)
                              │
                ┌─────────────┴───────────────┐
                ▼                             ▼
        WebRTC egress (WHEP)            LL-HLS egress (CMAF, 1 s parts)
        target < 1.5 s glass-to-glass   target < 6 s; fallback for restrictive networks
                │                             │
                └──────────► AeroSight UI ◄───┘
                     (player tries WHEP first; falls back to LL-HLS after 5 s or ICE failure)
        TURN (coturn, TLS 443) for clients behind restrictive NAT/firewalls
```

### 3.1 Session flow

1. Mission enters `in_progress`. For adapters with `liveVideo`, the Drone Integration Service calls `startLiveStream()`, passing an ingest target `rtmp(s)://live-ingest…/{orgId}/{streamId}?key=…` (or a WHIP URL). A `live_stream_sessions` row is created (`status=starting`).
2. The gateway's `on_publish` webhook → API validates the key → `status=live` → event pushed on the mission channel.
3. Viewer clicks **Watch live** → `POST /live-streams/{droneId}/session` → API checks `livevideo:view` on the project → returns a **viewer token** (JWT, 10 min, claims: `streamId`, `orgId`, `userId`, `exp`) and WHEP / LL-HLS URLs.
4. The gateway's `on_read` auth hook validates the viewer token (signature, exp, stream match). Each viewer is counted (VIDEO-009).
5. Mission ends or publisher disconnects for > 60 s → `status=ended`. The publish key is invalidated. A recording (if enabled) becomes a media item via the recorded pipeline.

### 3.2 Access controls

| Control | Implementation |
|---|---|
| Publish auth | Per-stream key, single-use per mission, IP pinning when the provider gives a stable egress range |
| Viewer auth | Short-lived JWT validated by the gateway hook. Re-issued by the player before expiry. |
| Tenant isolation | Stream path includes `orgId`. Token `orgId` must match. Gateway rejects mismatches. |
| Transport | RTMPS/SRT where supported. WebRTC DTLS-SRTP. HLS over HTTPS. |
| Watermark (optional, Enterprise) | Viewer email + timestamp overlay on the player (client-side) to deter leaks |
| Audit | `live_stream.viewed` audit event per viewer session (start/end) |

## 4. Signed URL Policy (all media)

| Use | Mechanism | TTL |
|---|---|---|
| Original download | S3 presigned GET with `response-content-disposition=attachment` | 5 min |
| Image preview/thumbnail | CloudFront signed URL | 1 h (cached client-side) |
| HLS playback | CloudFront signed cookies, path-scoped | 1 h, refreshed |
| Live viewer | Gateway JWT | 10 min, refreshed |
| External report share | Token → server-side authorization → short presigned URLs | 5 min per asset |

Signed URLs are never logged, never stored in the DB, and generated only after `PolicyEngine` authorization.

## 5. Player Requirements (UI)

- hls.js (MSE) with native HLS on Safari. WHEP client for WebRTC.
- Quality selector (Auto/1080/720/480). Playback speed (0.25–2×). Frame step (`,` `.` keys). Fullscreen. Picture-in-picture.
- Synced minimap and telemetry overlay when a track exists (VIDEO-004).
- Snapshot button → `POST /media/:id/frames {timeMs}` → server extracts the full-resolution frame from the original (VIDEO-007).
- Live: latency indicator, viewer count, reconnecting state, "Live" badge. `Simulated` badge when the simulator streams a test pattern.

## 6. Capacity & Cost

| Item | Estimate |
|---|---|
| Transcode cost driver | ~0.4 vCPU-hour per hour of 4K source to the 3-rung ladder (x264 `veryfast`); spot instances |
| Storage per hour of video | Original 4K ~ 45 GB/h (100 Mbps); HLS ladder ~ 4.5 GB/h |
| Live egress | 3 Mbps per WebRTC viewer. CDN for LL-HLS when > 20 viewers per stream. |

## 7. Monitoring

`video_transcode_duration_seconds`, `video_transcode_failures_total`, queue depth `video.transcode`, `live_streams_active`, `live_viewers_active`, `webrtc_ice_failures_total`, `whep_fallback_to_hls_total`, gateway CPU/network. Alerts in [Monitoring](../12-DevOps/Monitoring.md).
