# Offline ISR Drone Feed & Geospatial COP

**DJI bridge setup and troubleshooting:** see [CLIENT_SETUP_GUIDE.md](CLIENT_SETUP_GUIDE.md).
The repaired bridge uses telemetry schema V2; update the Android and desktop applications together.
GitHub Actions provides build/test reports and a network-only test APK. A DJI-enabled APK requires
the owner's package-matched `DJI_API_KEY`; it is built only by explicit workflow dispatch.
The bridge forwards telemetry, not live video. Real hardware compatibility remains a bench-test requirement.

> Offline-first Common Operating Picture and geospatial visualization platform for drone/sensor data integration. 
> **Version 1.0 Production Release**: Includes real-time hardware adapters for MAVLink (UDP/Serial) and DJI SDK JSON Telemetry.

---

# 1. Project Overview

This project is an offline-first desktop software platform designed to integrate drone/platform sensor information, telemetry, video, and geospatial data into a unified Common Operating Picture (COP).

The application is designed to operate without Internet connectivity during normal operation.

The platform combines:

- Drone/platform telemetry
- Sensor/video feeds
- Offline maps
- Geographic coordinates
- Grid references
- Platform position
- Platform track
- Sensor metadata
- Geospatial observations
- Mission/event logging
- Local database storage
- Mission replay
- Simulator-based development
- Future hardware-specific adapters

The architecture is intentionally platform-independent.

Potential future platform integrations include:

- Asteria A200
- ideaForge Q6
- ULPGM / Raphe mPhibr platforms
- FPV platforms
- Other compatible platforms

Actual hardware integration must be implemented using the official interface documentation provided for the relevant platform.

---

# 2. Project Documentation

The project has three primary documentation/reference files.

```text
README.md
    |
    |-- Overall project documentation
    |
V1_BUILD_PROMPT.md
    |
    |-- Instructions for the coding agent
    |
docs/SYSTEM_ARCHITECTURE.tex
    |
    |-- Detailed technical architecture
````

There is also a UI/UX prototype:

```text
prototype/sentinel-prototype.html
```

The prototype is a reference implementation for the intended interface and workflow.

---

# 3. Prototype

The project includes an existing HTML prototype.

Location:

```text
prototype/sentinel-prototype.html
```

The prototype should be treated as:

* UI reference
* UX reference
* Workflow reference
* Feature reference
* Visual design reference

It should NOT automatically be treated as the production architecture.

The coding agent should study the prototype before implementing the new application.

The agent should identify:

* Existing UI sections
* Existing workflows
* Existing controls
* Existing terminology
* Existing map concepts
* Existing telemetry concepts
* Existing observation concepts
* Existing mission concepts

Then reproduce the useful functionality in the new modular architecture.

---

# 4. Core Principle

The application should follow:

```text
Drone / Simulator
       |
       v
Data Ingestion
       |
       v
Platform Adapter
       |
       v
Normalized Data Model
       |
       +----------------+
       |                |
       v                v
    Video          Telemetry
       |                |
       +-------+--------+
               |
               v
       Synchronization
               |
               v
     Geospatial Engine
               |
       +-------+-------+
       |               |
       v               v
   Offline Map     Local Database
       |               |
       +-------+-------+
               |
               v
           COP UI
```

The UI must never be tightly coupled to a specific drone.

---

# 5. Main Objectives

The project must eventually provide:

1. Offline desktop operation.
2. Offline map visualization.
3. Platform telemetry visualization.
4. Platform track visualization.
5. Sensor/video visualization.
6. Video and telemetry synchronization.
7. Coordinate conversion.
8. Grid-reference support.
9. Geospatial observation creation.
10. Mission management.
11. Mission/event logging.
12. Mission replay.
13. Local persistence.
14. Data export.
15. Simulator-based testing.
16. Future real-hardware integration.

---

# 6. Version 1 Philosophy

Version 1 is intentionally hardware-independent.

The first working system should use:

```text
Synthetic Telemetry
        +
Recorded Video
        +
Offline Map
        +
Coordinate Engine
        +
SQLite
        +
Mission Replay
```

The real drone should NOT be required to demonstrate that the software architecture works.

The purpose is to establish the complete software pipeline first.

---

# 7. Why Simulator First?

Real hardware integration introduces external dependencies such as:

* Hardware availability
* Vendor documentation
* Communication interfaces
* Telemetry protocols
* Video protocols
* Sensor metadata
* Network configuration
* Device-specific behavior

If the software is designed around hardware from day one, hardware availability can block development.

Instead:

```text
Simulator
   ↓
Software validation
   ↓
Automated testing
   ↓
Recorded mission replay
   ↓
Hardware adapter
```

This makes development much more predictable.

---

# 8. System Components

The project consists of the following major components.

## 8.1 Desktop Application

Recommended:

```text
Electron
```

Responsible for:

* Desktop window
* Application lifecycle
* Local system integration
* Secure IPC
* Local resources

---

## 8.2 Frontend

Recommended:

```text
React
JavaScript
```

Responsible for:

* Map UI
* Video UI
* Telemetry UI
* Platform panel
* Observation panel
* Mission controls
* Status indicators

---

## 8.3 Core Application

Contains the business logic.

Recommended modules:

```text
core/
├── coordinates/
├── georeferencing/
├── telemetry/
├── synchronization/
├── observations/
└── mission/
```

The core must not depend directly on React components.

---

# 9. Offline Map

The map is one of the central components.

The application must use local map data.

Possible formats include:

* MBTiles
* GeoJSON
* GeoPackage
* Raster tiles
* Vector tiles

The final mapping library should be selected based on the offline requirements.

The application must not require:

* Google Maps
* Online map tiles
* Cloud map APIs
* Internet geocoding

during normal offline operation.

---

# 10. Map Features

The map should support:

* Pan
* Zoom
* Coordinate display
* Platform marker
* Historical platform track
* Observation markers
* Grid overlay
* Map layers
* Scale
* North indicator
* Multiple platforms

---

# 11. Coordinate Engine

Coordinate calculations must be isolated in a dedicated module.

Potential supported systems:

```text
WGS84
UTM
MGRS
Required Indian grid/reference system
```

Example API:

```javascript
coordinateEngine.toMGRS(latitude, longitude);

coordinateEngine.fromMGRS(mgrs);

coordinateEngine.toUTM(latitude, longitude);

coordinateEngine.fromUTM(utm);
```

The exact Indian grid/reference system must be confirmed before implementation.

The project must not guess the datum, projection, or transformation parameters.

---

# 12. Telemetry

The application uses a normalized telemetry model.

Conceptually:

```javascript
{
    timestamp,
    platformId,

    position: {
        latitude,
        longitude,
        altitudeMSL
    },

    attitude: {
        roll,
        pitch,
        yaw
    },

    velocity: {
        groundSpeed
    },

    sensor: {
        azimuth,
        elevation,
        hfov,
        vfov
    }
}
```

The exact schema should be versioned.

---

# 13. Platform Adapters

The system uses adapters to isolate platform-specific interfaces.

Future adapters may include:

```text
adapters/
├── simulator/
├── asteria/
├── ideaforge/
├── raphe/
└── fpv/
```

Version 1 should make the simulator adapter functional.

Real hardware adapters should only be implemented once the relevant interface documentation is available.

Do not invent undocumented protocols.

---

# 14. Video System

Version 1 uses recorded video.

Example:

```text
media/
└── test-video/
```

The video subsystem should support:

* Open
* Play
* Pause
* Stop
* Seek
* Timestamp
* Duration
* Error handling

Future versions can replace the recorded source with a documented hardware feed.

---

# 15. Video / Telemetry Synchronization

The video and telemetry systems must share a common time reference.

Conceptually:

```text
Video timestamp
       |
       v
Synchronization Engine
       |
       v
Nearest telemetry record
       |
       v
Platform state
```

This allows the system to determine the platform state associated with a recorded video time.

---

# 16. Geospatial Observations

The application should support structured observations.

Example:

```json
{
    "id": "OBS-0001",
    "missionId": "MISSION-001",
    "platformId": "UAV-01",
    "timestamp": 1720000000000,
    "source": "VIDEO",
    "latitude": 19.0760,
    "longitude": 72.8777,
    "gridReference": "...",
    "status": "OBSERVED",
    "notes": ""
}
```

Observation states should distinguish between:

```text
OBSERVED
CALCULATED
CONFIRMED
```

The system should preserve the distinction between what was observed and what was calculated.

---

# 17. Georeferencing

The georeferencing subsystem conceptually performs:

```text
Sensor Observation
       ↓
Camera Model
       ↓
Line of Sight
       ↓
Sensor Orientation
       ↓
Platform Position
       ↓
Ground Model
       ↓
Geographic Coordinate
       ↓
Grid Reference
```

The accuracy depends on the quality of:

* Platform position
* Platform altitude
* Platform attitude
* Sensor orientation
* Camera calibration
* Field of view
* Ground/elevation data

Version 1 may use simplified assumptions for software testing.

---

# 18. Database

Recommended:

```text
SQLite
```

Main entities:

```text
missions
platforms
telemetry
observations
mission_events
```

The database must work without a server or Internet connection.

---

# 19. Mission

A mission contains:

```text
Mission
├── Platforms
├── Telemetry
├── Video
├── Observations
├── Events
└── Metadata
```

Mission fields may include:

```text
id
name
created_at
started_at
ended_at
status
description
```

---

# 20. Mission Events

Important events should be recorded.

Examples:

```text
MISSION_STARTED
MISSION_ENDED
PLATFORM_CONNECTED
PLATFORM_DISCONNECTED
VIDEO_STARTED
VIDEO_STOPPED
TELEMETRY_STARTED
TELEMETRY_STOPPED
OBSERVATION_CREATED
OBSERVATION_UPDATED
```

Events should have timestamps.

---

# 21. Mission Replay

The system should support replaying a recorded mission.

Replay should synchronize:

```text
Video
Telemetry
Platform Track
Observations
Mission Events
```

Replay is also a major testing mechanism.

---

# 22. Export

Version 1 should support:

```text
JSON
CSV
```

Possible exports:

```text
mission.json
telemetry.csv
observations.csv
events.csv
```

---

# 23. Testing

Testing should occur continuously.

Testing categories:

```text
Unit Tests
Integration Tests
UI Tests
Coordinate Tests
Telemetry Tests
Video Tests
Synchronization Tests
Database Tests
Replay Tests
Offline Tests
Failure Tests
```

---

# 24. Offline Test

The complete application should be tested with network connectivity disabled.

Test:

```text
Launch
  ↓
Map
  ↓
Telemetry
  ↓
Video
  ↓
Synchronization
  ↓
Observation
  ↓
Database
  ↓
Replay
  ↓
Export
```

No Internet should be required.

---

# 25. Failure Testing

Test:

* Missing map
* Missing video
* Telemetry interruption
* Invalid coordinates
* Invalid grid
* Database failure
* Corrupt video
* Mission load failure
* Export failure
* Application restart

The UI must display useful error information.

---

# 26. Project Structure

```text
project-root/
│
├── README.md
├── V1_BUILD_PROMPT.md
│
├── docs/
│   └── SYSTEM_ARCHITECTURE.tex
│
├── prototype/
│   └── sentinel-prototype.html
│
├── electron/
│   ├── main.js
│   └── preload.js
│
├── client/
│   └── src/
│
├── core/
│   ├── coordinates/
│   ├── georeferencing/
│   ├── telemetry/
│   ├── synchronization/
│   ├── observations/
│   └── mission/
│
├── adapters/
│   └── simulator/
│
├── database/
│   ├── migrations/
│   └── repositories/
│
├── maps/
│   └── tiles/
│
├── media/
│   └── test-video/
│
├── simulator/
│   ├── telemetry/
│   └── missions/
│
└── tests/
    ├── coordinates/
    ├── telemetry/
    ├── video/
    ├── synchronization/
    ├── database/
    ├── replay/
    └── offline/
```

---

# 27. Development Roadmap

## Phase 1

Application shell.

## Phase 2

Offline map.

## Phase 3

Coordinate engine.

## Phase 4

Telemetry simulator.

## Phase 5

Video playback.

## Phase 6

Video/telemetry synchronization.

## Phase 7

Observation system.

## Phase 8

Mission/database system.

## Phase 9

Replay and export.

## Phase 10

Automated testing.

## Phase 11

Real hardware adapters.

---

# 28. Version 1

Version 1 must provide:

* Electron application
* React UI
* Offline map
* Telemetry simulator
* Platform marker
* Platform track
* Recorded video
* Video timestamp
* Telemetry synchronization
* Coordinate conversion
* Grid reference
* Observation creation
* SQLite database
* Mission events
* Mission replay
* JSON/CSV export
* Automated tests
* Offline operation

---

# 29. Future Hardware Integration

Hardware integration should be implemented through adapters.

Example:

```text
                 Core Application
                       |
                 Common Interface
                       |
       +---------------+---------------+
       |               |               |
       v               v               v
   Simulator        UAV Adapter     UAV Adapter
                     Asteria         ideaForge
```

The core application should remain unchanged as much as possible.

---

# 30. Engineering Principles

## Modular

Every major subsystem should be independently replaceable.

## Offline-first

Internet is not a runtime dependency.

## Testable

Important functionality must have automated tests.

## Hardware-independent

Core application logic should not depend on one drone.

## Deterministic

Simulator and replay should produce repeatable results.

## Maintainable

Avoid large components and tightly coupled code.

## Documented

Important design decisions must be documented.

---

# 31. Prototype Rule

The HTML prototype is a reference.

The development agent should:

1. Inspect it.
2. Understand the existing UI.
3. Identify reusable concepts.
4. Recreate the required UI in React.
5. Preserve useful workflows.
6. Improve the architecture where necessary.

The agent should NOT:

* Copy the entire HTML blindly.
* Treat simulated data as real telemetry.
* Assume prototype calculations are production-accurate.
* Keep all functionality in one HTML file.
* Depend on online services used by the prototype.

---

# 32. Definition of Done

The project reaches Version 1 when:

```text
Application launches
        ↓
Offline map loads
        ↓
Simulator starts
        ↓
Platform appears
        ↓
Platform moves
        ↓
Track appears
        ↓
Video plays
        ↓
Video synchronizes with telemetry
        ↓
Observation can be created
        ↓
Coordinate/grid is generated
        ↓
Observation is stored
        ↓
Mission events are recorded
        ↓
Mission can be replayed
        ↓
Mission can be exported
        ↓
Tests pass
        ↓
Application works offline
```

---

# 33. Final Principle

Build the software first.

Simulate the hardware.

Validate the data pipeline.

Test repeatedly.

Then integrate real hardware through adapters.

```text
SIMULATE
   ↓
BUILD
   ↓
TEST
   ↓
REPLAY
   ↓
VALIDATE
   ↓
HARDWARE INTEGRATION
```

---

# 34. Repository Rule

Before adding a new feature, determine:

1. Which module owns the feature?
2. Which data model is required?
3. How will it be tested?
4. Does it work offline?
5. Does it introduce hardware coupling?
6. Does it affect mission replay?
7. Does documentation need updating?

Do not implement features directly inside unrelated UI components.

---

# 35. Final Project Goal

The final system should become a modular offline geospatial platform capable of receiving standardized sensor and telemetry information from multiple supported sources.

Version 1 establishes the foundation.

Future versions add hardware.

The architecture should therefore be designed so that:

```text
SIMULATOR
```

can eventually be replaced with:

```text
REAL PLATFORM ADAPTER
```

without rewriting the core application.

````

---

# File 2 — `V1_BUILD_PROMPT.md`

This one should be **much more direct**. Your coding agent should receive this as its actual build instruction.

```markdown
# VERSION 1 — CODING AGENT BUILD PROMPT

You are the primary software engineering agent for this project.

Your job is to build Version 1 of the Offline ISR Drone Feed & Geospatial COP application.

---

# 1. SOURCE DOCUMENTS

Before implementing anything, read:

```text
README.md
docs/SYSTEM_ARCHITECTURE.tex
prototype/sentinel-prototype.html
````

These are the project references.

Use:

```text
README.md
```

for the overall project direction.

Use:

```text
docs/SYSTEM_ARCHITECTURE.tex
```

for the technical architecture.

Use:

```text
prototype/sentinel-prototype.html
```

as the UI/UX and workflow reference.

---

# 2. IMPORTANT PROTOTYPE INSTRUCTION

The existing HTML prototype is NOT the final architecture.

Study it first.

Identify:

* Layout
* Navigation
* Map area
* Video area
* Telemetry area
* Platform information
* Grid/reference controls
* Observation workflow
* Mission/event concepts
* Existing visual language

Then rebuild the functionality using the new modular architecture.

Do NOT simply convert the HTML into one React component.

Do NOT keep the entire application in one file.

Do NOT assume simulated prototype values represent real hardware data.

---

# 3. VERSION 1 OBJECTIVE

Build a working offline desktop application that demonstrates:

```text
Create Mission
     ↓
Start Simulator
     ↓
Platform Appears on Offline Map
     ↓
Platform Moves
     ↓
Track Is Drawn
     ↓
Recorded Video Plays
     ↓
Video + Telemetry Are Synchronized
     ↓
Create Geospatial Observation
     ↓
Coordinate/Grid Reference
     ↓
Save Observation
     ↓
Record Mission Event
     ↓
Replay Mission
     ↓
Export Mission
```

Everything above must work without Internet connectivity.

---

# 4. TECHNOLOGY

Use:

```text
Electron
React
JavaScript
Node.js
SQLite
```

Do not use TypeScript.

Do not introduce unnecessary frameworks.

---

# 5. ARCHITECTURE

Use:

```text
UI
 ↓
Application Core
 ↓
Geospatial/Data Services
 ↓
Adapters
 ↓
Simulator / Future Hardware
```

The UI must not directly contain:

* Telemetry parsing
* Coordinate algorithms
* Database queries
* Hardware protocols

---

# 6. PROJECT STRUCTURE

Create:

```text
project-root/
│
├── README.md
├── V1_BUILD_PROMPT.md
│
├── docs/
│   ├── SYSTEM_ARCHITECTURE.tex
│   ├── DATABASE.md
│   ├── TELEMETRY.md
│   ├── COORDINATES.md
│   └── TESTING.md
│
├── prototype/
│   └── sentinel-prototype.html
│
├── electron/
│   ├── main.js
│   └── preload.js
│
├── client/
│   └── src/
│       ├── components/
│       │   ├── Map/
│       │   ├── Video/
│       │   ├── Telemetry/
│       │   ├── Platforms/
│       │   ├── Observations/
│       │   └── Mission/
│       ├── pages/
│       ├── services/
│       ├── state/
│       └── styles/
│
├── core/
│   ├── coordinates/
│   ├── georeferencing/
│   ├── telemetry/
│   ├── synchronization/
│   ├── observations/
│   └── mission/
│
├── adapters/
│   └── simulator/
│
├── database/
│   ├── migrations/
│   └── repositories/
│
├── maps/
│   └── tiles/
│
├── media/
│   └── test-video/
│
├── simulator/
│   ├── telemetry/
│   └── missions/
│
└── tests/
    ├── coordinates/
    ├── telemetry/
    ├── video/
    ├── synchronization/
    ├── database/
    ├── replay/
    └── offline/
```

---

# 7. BUILD ORDER

Do not attempt everything simultaneously.

Implement in this order:

```text
1. Electron + React
2. Application shell
3. UI layout
4. SQLite
5. Coordinate engine
6. Offline map
7. Telemetry simulator
8. Platform marker
9. Platform track
10. Recorded video
11. Synchronization
12. Observation system
13. Mission events
14. Mission replay
15. Export
16. Automated tests
17. Offline validation
18. Documentation
```

After each stage:

```text
Implement
 ↓
Run tests
 ↓
Fix errors
 ↓
Verify
 ↓
Document
 ↓
Continue
```

---

# 8. UI

Recreate the important visual concepts from:

```text
prototype/sentinel-prototype.html
```

The main layout should contain:

```text
┌──────────────────────────────────────────────────────────┐
│ Mission | Platform | Layers | Grid | Record | Replay    │
├───────────────────┬────────────────────┬─────────────────┤
│                   │                    │                 │
│ PLATFORM PANEL    │       MAP          │ SENSOR VIDEO   │
│                   │                    │                 │
├───────────────────┴────────────────────┴─────────────────┤
│ TELEMETRY             │ OBSERVATION / EVENT LOG          │
├──────────────────────────────────────────────────────────┤
│ System Status / Offline / Database / Video / Telemetry  │
└──────────────────────────────────────────────────────────┘
```

The UI should be clean and professional.

Do not overcomplicate the UI.

---

# 9. OFFLINE MAP

Implement an offline map architecture.

Do not use online map services.

The application must be able to load local map resources.

If map data is not currently available:

* Build the map abstraction.
* Create the expected local directory.
* Add a clear empty state.
* Document how map data is added.

Do not silently call remote map servers.

---

# 10. TELEMETRY SIMULATOR

Implement:

```text
adapters/simulator/
```

The simulator should output normalized telemetry.

Use:

```javascript
{
    timestamp,
    platformId,

    position: {
        latitude,
        longitude,
        altitudeMSL
    },

    attitude: {
        roll,
        pitch,
        yaw
    },

    velocity: {
        groundSpeed
    },

    sensor: {
        azimuth,
        elevation,
        hfov,
        vfov
    }
}
```

Use deterministic data.

Create a repeatable path:

```text
A → B → C → D
```

Controls:

```text
Start
Pause
Reset
Speed
```

---

# 11. PLATFORM DISPLAY

Display:

```text
Platform ID
Status
Latitude
Longitude
Altitude
Heading
Speed
Timestamp
```

The map should update as telemetry changes.

---

# 12. TRACK

Store valid platform positions.

Display the historical path on the map.

The track must:

* Update during simulation.
* Reset when a new mission starts.
* Persist during mission recording.
* Be reproducible during replay.

---

# 13. VIDEO

Use a local recorded video.

Expected directory:

```text
media/test-video/
```

If there is no video yet, implement the player and empty state.

Do not fabricate a real sensor feed.

Provide:

```text
Play
Pause
Stop
Seek
Timestamp
Duration
```

---

# 14. SYNCHRONIZATION

Implement:

```text
core/synchronization/
```

Provide:

```javascript
getTelemetryAtTime(timestamp)
```

The method should return the closest valid telemetry state.

Handle:

* Exact match
* Nearest match
* No telemetry
* Telemetry gaps
* Video before telemetry
* Video after telemetry

Add automated tests.

---

# 15. COORDINATES

Implement a dedicated coordinate service.

At minimum provide:

```javascript
toMGRS(latitude, longitude)
fromMGRS(mgrs)
toUTM(latitude, longitude)
fromUTM(utm)
```

Use a reliable coordinate/geospatial library where appropriate rather than implementing complex projection mathematics unnecessarily.

For the Indian grid/reference system:

DO NOT GUESS.

Create the architecture for it, but only implement the exact system once the required datum/projection/zone specification is available.

---

# 16. OBSERVATIONS

Create an observation module.

Observation:

```javascript
{
    id,
    missionId,
    platformId,
    timestamp,
    source,
    latitude,
    longitude,
    gridReference,
    status,
    notes
}
```

Support:

```text
OBSERVED
CALCULATED
CONFIRMED
```

The application must preserve these states.

---

# 17. OBSERVATION WORKFLOW

Version 1 observation workflow:

```text
Operator chooses observation location
        ↓
Read geographic coordinate
        ↓
Coordinate conversion
        ↓
Grid reference
        ↓
Display marker
        ↓
Save observation
        ↓
Record mission event
```

This is a geospatial observation/visualization feature.

Do not implement weapon guidance, engagement logic, attack optimization, or automated targeting functionality.

---

# 18. SQLITE

Implement SQLite.

Tables:

```text
missions
platforms
telemetry
observations
mission_events
```

Use migrations.

Create repository/service functions instead of putting SQL directly in React components.

---

# 19. MISSION

Support:

```text
Create Mission
Start Mission
End Mission
Load Mission
Replay Mission
```

Persist mission information.

---

# 20. EVENTS

Record:

```text
MISSION_STARTED
MISSION_ENDED
PLATFORM_CONNECTED
PLATFORM_DISCONNECTED
VIDEO_STARTED
VIDEO_STOPPED
TELEMETRY_STARTED
TELEMETRY_STOPPED
OBSERVATION_CREATED
OBSERVATION_UPDATED
```

Every event must have a timestamp.

---

# 21. REPLAY

Replay must reconstruct:

```text
Platform Position
Platform Track
Telemetry
Video Time
Observations
Mission Events
```

Controls:

```text
Play
Pause
Stop
Timeline
Playback Speed
```

Replay must use deterministic test data.

---

# 22. EXPORT

Implement:

```text
JSON
CSV
```

Export:

```text
Mission
Telemetry
Observations
Events
```

---

# 23. TESTING

Create automated tests for:

## Coordinates

* Valid coordinate
* Invalid coordinate
* MGRS
* Reverse MGRS
* UTM
* Boundary cases

## Telemetry

* Simulator output
* Validation
* Timestamp
* Missing data
* Invalid data

## Synchronization

* Exact match
* Nearest match
* Missing telemetry
* Time gaps

## Database

* Mission creation
* Telemetry insertion
* Observation insertion
* Event insertion
* Data retrieval
* Persistence

## Replay

* Mission loading
* Telemetry replay
* Observation replay
* Event replay

---

# 24. OFFLINE TEST

Perform an explicit offline test.

Disable:

```text
Wi-Fi
Ethernet
Internet
```

Then test:

```text
Application launch
Map
Simulator
Telemetry
Video
Coordinates
Observation
Database
Replay
Export
```

The application must continue functioning.

---

# 25. FAILURE TESTING

Test:

```text
Missing map
Missing video
Telemetry interruption
Invalid coordinate
Invalid grid
Database failure
Corrupt video
Failed mission load
Failed export
Application restart
```

The UI should show clear errors.

---

# 26. HARDWARE ADAPTERS

Create the architecture for:

```text
AsteriaAdapter
IdeaForgeAdapter
RapheAdapter
FPVAdapter
```

But do not implement undocumented hardware protocols.

Version 1 should use:

```text
SimulatorAdapter
```

Real adapters will be implemented later using official platform documentation.

---

# 27. ELECTRON SECURITY

Use:

* Secure preload
* Restricted IPC
* No unrestricted Node access in renderer
* Validated IPC arguments
* Privileged operations in main process

Do not expose arbitrary filesystem or system APIs to React.

---

# 28. CODE QUALITY

Follow:

```text
Small components
Clear modules
No duplicated logic
No magic values
No direct database access from UI
No hardware logic in UI
No coordinate logic in UI
```

Keep code readable.

---

# 29. DOCUMENTATION

Update:

```text
README.md
docs/DATABASE.md
docs/TELEMETRY.md
docs/COORDINATES.md
docs/TESTING.md
```

Document important implementation decisions.

---

# 30. DEFINITION OF DONE

Do not report Version 1 complete until all of these work:

* [ ] Application launches.
* [ ] UI loads.
* [ ] Offline map architecture works.
* [ ] Simulator starts.
* [ ] Platform appears.
* [ ] Platform moves.
* [ ] Track is displayed.
* [ ] Video plays.
* [ ] Video timestamp works.
* [ ] Telemetry/video synchronization works.
* [ ] Coordinate conversion works.
* [ ] Grid reference works where specification is available.
* [ ] Observation can be created.
* [ ] Observation appears on map.
* [ ] Observation persists.
* [ ] Mission events persist.
* [ ] Mission replay works.
* [ ] JSON export works.
* [ ] CSV export works.
* [ ] Automated tests pass.
* [ ] Offline test passes.
* [ ] Failure handling works.
* [ ] Documentation is updated.

---

# 31. FINAL RULE

Build Version 1 as a complete software pipeline using simulation and recorded data.

Do not wait for physical hardware.

Do not invent hardware protocols.

Do not introduce online dependencies.

Do not turn the prototype into the production architecture.

Use the prototype for visual and workflow guidance.

The final architecture must allow:

```text
Simulator
    ↓
Common Interface
    ↓
Core Application
```

to later become:

```text
Real Platform
    ↓
Platform Adapter
    ↓
Common Interface
    ↓
Core Application
```

without rewriting the application.

Build incrementally.

Test every module.

Keep the system offline-first.

END OF V1 BUILD PROMPT

````

### And yes — add the HTML prototype

I **strongly recommend** adding it. In fact, give the coding agent all three:

```text
README.md
        ↓
"What is this project?"

SYSTEM_ARCHITECTURE.tex
        ↓
"How is the system designed?"

prototype/sentinel-prototype.html
        ↓
"What should the interface/workflow look like?"

V1_BUILD_PROMPT.md
        ↓
"What exactly do I build now?"
````

That gives your coding agent a much better context than giving it only the prompt.

**One thing I would do before starting the agent:** rename the prototype something explicit like:

```text
prototype/sentinel-v0.html
```

rather than letting the agent think it is the actual application. Then your repository clearly communicates:

```text
v0 = prototype/reference
v1 = real modular application
```

And **do not delete the prototype after V1 is built**. It becomes useful as a visual regression/reference when you change the UI later.
