# Smart Home Platform - Architecture Documentation

## High-Level Architecture Overview

```
                         +--------------------------+
                         |   Flutter Mobile App     |
                         +------------+-------------+
                                      |
                                      | REST API (JWT)
                                      v
+------------------+          +------------------------------+
|    Web Admin     |--------->|           NestJS             |
| (React / Vue /   |          |      Fastify Adapter         |
|  Vanilla JS)     |          |                              |
+------------------+          | - REST API / Swagger         |
                              | - WebSocket Gateway (ws/io)  |
                              | - MQTT Application Client    |
                              | - Rule Automation Engine     |
                              +---------------+--------------+
                                              |
                              +---------------+---------------+
                              |                               |
                              v                               v
                       +-------------+                 +-------------+
                       |  Mosquitto  |                 | PostgreSQL  |
                       | MQTT Broker |                 |  + Prisma   |
                       +------+------+                 +-------------+
                              |
                    +---------+---------+
                    |         |         |
                 +-----+   +-----+   +-----+
                 |ESP01|   |ESP02|   |ESP03| ... (Simulated or Physical)
                 +-----+   +-----+   +-----+
```

## Architectural Principles

1. **Strict Separation of Concerns**:
   - Web Admin and Flutter communicate strictly with NestJS via REST API and WebSockets.
   - Physical/Simulated ESP devices communicate strictly with the Mosquitto MQTT broker.
   - ESP devices, Web Admin, and Flutter **never** connect directly to PostgreSQL.

2. **Device Type Architecture**:
   - **Generic Device Management** (`/api/devices`): Handles generic identity, room assignment, deviceUid, deviceType, status, and lastSeenAt.
   - **Generic Custom Sensor Telemetry** (`/api/sensors`): Historical time-series measurements stored in `SensorReading`.
   - **Specialized Device Domains**:
     - `SMART_DOOR`: specialized door/lock state, lock/unlock actions.
     - `SMART_CURTAIN`: specialized position (0-100), state (opening/closing/stopped), set_position/open/close/stop actions.
     - `EXHAUST_FAN`: specialized power (boolean), speed (0-3), on/off/set_speed actions.
   - Specialized states are **not** forced into `SensorReading` table.

3. **Presence & Online State**:
   - Real-time dynamic computed status from `lastSeenAt` vs `DEVICE_OFFLINE_THRESHOLD_SECONDS` (default: 60s).
   - Zero database write overhead for heartbeat checks.
