# Smart Home Platform - MQTT Specification

## Topic Pattern

All MQTT topics follow a consistent hierarchy:

```
home/{homeId}/{roomId}/{deviceUid}/{messageType}
```

- `homeId`: Numeric ID of the Home
- `roomId`: Numeric ID of the Room
- `deviceUid`: Unique string identifier for the device (e.g. `esp-001`, `door-001`)
- `messageType`: `telemetry` | `state` | `command` | `config`

---

## 1. Telemetry (`telemetry`)

Used by `CUSTOM_SENSOR` nodes to send environmental readings.

- **Topic**: `home/1/1/sensor-001/telemetry`
- **Payload**:
  ```json
  {
    "temperature": 28.4,
    "humidity": 65.2,
    "pressure": 1013.25
  }
  ```

---

## 2. Device State (`state`)

Used by specialized devices to broadcast internal state changes.

- **Smart Door**:
  - **Topic**: `home/1/1/door-001/state`
  - **Payload**: `{ "door": "closed", "lock": "locked" }`
- **Smart Curtain**:
  - **Topic**: `home/1/1/curtain-001/state`
  - **Payload**: `{ "position": 75, "state": "opening" }`
- **Exhaust Fan**:
  - **Topic**: `home/1/2/fan-001/state`
  - **Payload**: `{ "power": true, "speed": 2 }`

---

## 3. Device Command (`command`)

Published by NestJS backend to control devices.

- **Smart Door**:
  - **Topic**: `home/1/1/door-001/command`
  - **Payload**: `{ "action": "unlock" }`
- **Smart Curtain**:
  - **Topic**: `home/1/1/curtain-001/command`
  - **Payload**: `{ "action": "set_position", "position": 50 }`
- **Exhaust Fan**:
  - **Topic**: `home/1/2/fan-001/command`
  - **Payload**: `{ "action": "set_speed", "speed": 3 }`
