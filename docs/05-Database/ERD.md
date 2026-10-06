# Entity Relationship Diagram (ERD)

| | |
|---|---|
| **Document** | Entity Relationship Diagram |
| **Project** | AeroSight AI |
| **Doc ID** | ASAI-DOC-08a |
| **Version** | 0.1 |
| **Status** | Draft |
| **Author** | AeroSight AI Engineering (DBA) |
| **Reviewer** | _Pending — Tech Lead, DBA_ |
| **Created** | 2026-10-06 |
| **Last Updated** | 2026-10-06 |

### Change History
| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-06 | Engineering | Initial ERD (Mermaid) |

---

The ERD is split into six domain views so it stays readable. Diagrams use Mermaid (they render on GitHub, GitLab and most Markdown viewers). Column-level detail is in [Database-Design.md](Database-Design.md).

**Convention:** every entity except `ORGANIZATION`, `USER`, `PERMISSION` and `PLAN` carries `organization_id`. For readability, the `ORGANIZATION ||--o{ X` edge is drawn only in view 1.

## 1. Tenancy, Identity & Access

```mermaid
erDiagram
    ORGANIZATION ||--o{ ORGANIZATION_MEMBER : has
    USER ||--o{ ORGANIZATION_MEMBER : "belongs via"
    ORGANIZATION ||--o{ ROLE : "defines (custom)"
    ROLE ||--o{ ROLE_PERMISSION : grants
    PERMISSION ||--o{ ROLE_PERMISSION : "granted in"
    USER ||--o{ USER_ROLE : has
    ROLE ||--o{ USER_ROLE : "assigned as"
    ORGANIZATION ||--o{ INVITATION : issues
    ROLE ||--o{ INVITATION : "invites with"
    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o{ MFA_RECOVERY_CODE : owns
    ORGANIZATION ||--|| SUBSCRIPTION : has
    PLAN ||--o{ SUBSCRIPTION : "priced by"
    ORGANIZATION ||--o{ USAGE_RECORD : accrues
    ORGANIZATION ||--o{ RETENTION_POLICY : configures
    ORGANIZATION ||--o{ API_KEY : issues
    ORGANIZATION ||--o{ INTEGRATION : connects
    INTEGRATION ||--o{ WEBHOOK : "may define"
    WEBHOOK ||--o{ WEBHOOK_DELIVERY : logs
    ORGANIZATION ||--o{ AUDIT_LOG : records

    ORGANIZATION {
        uuid id PK
        string name
        string slug UK
        string status
    }
    USER {
        uuid id PK
        citext email UK
        string status
    }
    ORGANIZATION_MEMBER {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        string status
    }
    ROLE {
        uuid id PK
        uuid organization_id FK "null = system"
        string key
        string scope
    }
    PERMISSION {
        uuid id PK
        string key UK
    }
    USER_ROLE {
        uuid id PK
        uuid organization_id FK
        uuid user_id FK
        uuid role_id FK
    }
```

## 2. Projects, Sites & Assets

```mermaid
erDiagram
    PROJECT ||--o{ PROJECT_MEMBER : has
    USER ||--o{ PROJECT_MEMBER : "member of"
    ROLE ||--o{ PROJECT_MEMBER : "project role"
    PROJECT ||--o{ SITE : contains
    SITE ||--o{ SITE_MEMBER : "restricts to"
    SITE ||--o{ SITE_NO_FLY_ZONE : has
    SITE ||--o{ ASSET : contains
    ASSET ||--o{ ASSET : "parent of"
    PROJECT ||--o{ MILESTONE : plans
    SITE ||--o{ MILESTONE : "optionally scopes"
    MILESTONE ||--o{ PROGRESS_RECORD : measured_by
    PROJECT ||--o{ PROGRESS_RECORD : has
    PROGRESS_RECORD }o--o| AI_ANALYSIS : "sourced from"

    PROJECT {
        uuid id PK
        uuid organization_id FK
        string code
        string status
        geography location
    }
    SITE {
        uuid id PK
        uuid organization_id FK
        uuid project_id FK
        geography boundary
        geography centroid
    }
    ASSET {
        uuid id PK
        uuid site_id FK
        uuid parent_asset_id FK
        string tag
        geography location
    }
    MILESTONE {
        uuid id PK
        uuid project_id FK
        numeric weight
        date planned_start
        date planned_end
    }
    PROGRESS_RECORD {
        uuid id PK
        uuid milestone_id FK
        numeric percent_complete
        string source
        string approval_status
    }
```

## 3. Fleet, Missions & Telemetry

```mermaid
erDiagram
    INTEGRATION ||--o{ DRONE : "syncs"
    DRONE ||--o{ DRONE_MAINTENANCE_LOG : has
    USER ||--o| DRONE_PILOT : "is (per org)"
    PROJECT ||--o{ DRONE_MISSION : schedules
    SITE ||--o{ DRONE_MISSION : "flown at"
    DRONE ||--o{ DRONE_MISSION : flies
    DRONE_PILOT ||--o{ DRONE_MISSION : pilots
    DRONE_MISSION ||--o{ MISSION_WAYPOINT : has
    DRONE_MISSION ||--o{ MISSION_EVENT : logs
    DRONE ||--o{ TELEMETRY : emits
    DRONE_MISSION ||--o{ TELEMETRY : "recorded during"
    DRONE_MISSION ||--o{ LIVE_STREAM_SESSION : streams
    SURVEY }o--o{ DRONE_MISSION : "captured by"

    DRONE {
        uuid id PK
        string provider_key
        string serial_number
        string status
    }
    DRONE_PILOT {
        uuid id PK
        uuid user_id FK
        string license_number
        date license_expires_at
    }
    DRONE_MISSION {
        uuid id PK
        uuid site_id FK
        uuid drone_id FK
        uuid pilot_id FK
        string status
        boolean is_simulated
    }
    MISSION_WAYPOINT {
        uuid id PK
        uuid mission_id FK
        int seq
        geography location
    }
    TELEMETRY {
        timestamptz time PK
        uuid drone_id PK
        uuid mission_id
        float latitude
        float longitude
    }
```

## 4. Media, Surveys, Maps & 3D

```mermaid
erDiagram
    PROJECT ||--o{ MEDIA : holds
    SITE ||--o{ MEDIA : "captured at"
    DRONE_MISSION ||--o{ MEDIA : produced
    ASSET ||--o{ MEDIA : depicts
    MEDIA ||--|| MEDIA_METADATA : has
    MEDIA ||--o{ MEDIA_TAG : tagged
    UPLOAD_SESSION ||--o{ MEDIA : creates
    SITE ||--o{ SURVEY : surveyed
    SURVEY ||--o{ SURVEY_AREA : covers
    SURVEY ||--o{ MAP : outputs
    MAP ||--o{ MAP_LAYER : "rendered as"
    SITE ||--o{ ANNOTATION : has
    SURVEY ||--o{ TWIN_MODEL : outputs
    SITE ||--o{ TWIN_MODEL : "modelled by"
    SITE ||--o{ VIEWPOINT : saves

    MEDIA {
        uuid id PK
        string type
        string status
        string storage_key
        geography location
    }
    SURVEY {
        uuid id PK
        string type
        string status
        date capture_date
    }
    MAP {
        uuid id PK
        uuid survey_id FK
        string type
        date captured_at
    }
    MAP_LAYER {
        uuid id PK
        uuid map_id FK
        string source_key
    }
    TWIN_MODEL {
        uuid id PK
        string format
        string tileset_key
    }
```

## 5. Inspections, AI & Reports

```mermaid
erDiagram
    INSPECTION_TEMPLATE ||--o{ INSPECTION : instantiates
    SITE ||--o{ INSPECTION : "inspected at"
    ASSET ||--o{ INSPECTION : "subject of"
    DRONE_MISSION ||--o{ INSPECTION : "evidence from"
    INSPECTION ||--o{ INSPECTION_FINDING : raises
    ASSET ||--o{ INSPECTION_FINDING : "affects"
    INSPECTION ||--o{ INSPECTION_ATTACHMENT : has
    INSPECTION_FINDING ||--o{ INSPECTION_ATTACHMENT : has
    MEDIA ||--o{ INSPECTION_ATTACHMENT : "referenced by"
    AI_ANALYSIS ||--o{ AI_SUGGESTION : proposes
    AI_SUGGESTION |o--o| INSPECTION_FINDING : "accepted as"
    USER ||--o{ AI_CONVERSATION : starts
    AI_CONVERSATION ||--o{ AI_MESSAGE : contains
    REPORT_TEMPLATE ||--o{ REPORT : formats
    PROJECT ||--o{ REPORT : "reported in"
    REPORT ||--o{ REPORT_SHARE_LINK : "shared by"
    REPORT_SCHEDULE ||--o{ REPORT : generates

    INSPECTION {
        uuid id PK
        string status
        uuid assignee_id FK
        uuid reviewer_id FK
    }
    INSPECTION_FINDING {
        uuid id PK
        string severity
        string status
        boolean ai_generated
    }
    AI_ANALYSIS {
        uuid id PK
        string type
        string status
        string model_version
    }
    REPORT {
        uuid id PK
        string type
        string status
        int version
    }
```

## 6. Collaboration, Notifications & Events

```mermaid
erDiagram
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ NOTIFICATION_PREFERENCE : sets
    ORGANIZATION ||--o{ NOTIFICATION_RULE : configures
    USER ||--o{ PUSH_SUBSCRIPTION : registers
    USER ||--o{ COMMENT : writes
    DOMAIN_EVENT ||--o{ NOTIFICATION : "fans out to"

    NOTIFICATION {
        uuid id PK
        uuid user_id FK
        string event_key
        timestamptz read_at
    }
    COMMENT {
        uuid id PK
        string entity_type
        uuid entity_id
    }
    DOMAIN_EVENT {
        uuid id PK
        string event_type
        timestamptz published_at
    }
```

## 7. Relationship Rules Summary

| Rule | Enforcement |
|---|---|
| Child rows share the parent's organization | Composite FKs `(organization_id, parent_id)` → parent `(organization_id, id)` |
| Asset hierarchy stays within one site | Trigger `assets_parent_same_site` + cycle check (recursive CTE) |
| Mission's site belongs to the mission's project | Composite FK `(organization_id, project_id, site_id)` → `sites(organization_id, project_id, id)` |
| One subscription per organization | `UNIQUE(organization_id)` on `subscriptions` |
| One pilot profile per user per org | `UNIQUE(organization_id, user_id)` on `drone_pilots` |
| One metadata row per media | `UNIQUE(media_id)` on `media_metadata` |
