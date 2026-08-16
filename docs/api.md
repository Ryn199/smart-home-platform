# Smart Home Platform - REST API Reference

All endpoints are prefixed with `/api`. Protected routes require `Authorization: Bearer <JWT_TOKEN>`.

Interactive Swagger Documentation: `http://localhost:3000/api/docs`

---

## 1. Authentication (`/api/auth`)

### `POST /api/auth/register`
- **Body**: `{ "name": "John", "email": "john@example.com", "password": "secretpassword" }`
- **Response**: `{ "user": { "id": 1, "name": "John", "email": "john@example.com" }, "accessToken": "..." }`

### `POST /api/auth/login`
- **Body**: `{ "email": "john@example.com", "password": "secretpassword" }`
- **Response**: `{ "user": { ... }, "accessToken": "..." }`

### `GET /api/auth/me` *(Protected)*
- **Response**: User profile data.

---

## 2. Homes & Rooms

### `POST /api/homes`
- **Body**: `{ "name": "Main Residence", "address": "123 Smart St" }`

### `GET /api/homes`
- **Response**: List of all homes.

### `POST /api/homes/:homeId/rooms`
- **Body**: `{ "name": "Living Room" }`

### `GET /api/homes/:homeId/rooms`
- **Response**: List of rooms in home with device counts.

---

## 3. Devices (`/api/devices`)

### `POST /api/devices`
- **Body**:
  ```json
  {
    "roomId": 1,
    "name": "Living Room Lock",
    "deviceUid": "door-001",
    "deviceType": "SMART_DOOR"
  }
  ```
- **Supported `deviceType`**: `CUSTOM_SENSOR`, `SMART_DOOR`, `SMART_CURTAIN`, `EXHAUST_FAN`.

### `GET /api/devices`
- **Query Params**: `?roomId=1&deviceType=SMART_DOOR&status=ONLINE`

### `GET /api/devices/:id/presence`
- **Response**: `{ "id": 1, "deviceUid": "door-001", "status": "ONLINE", "lastSeenAt": "...", "thresholdSeconds": 60, "secondsSinceLastSeen": 12 }`

### `POST /api/devices/:id/commands`
- **Door**: `{ "action": "unlock" }` or `{ "action": "lock" }`
- **Curtain**: `{ "action": "set_position", "position": 70 }`, `{ "action": "open" }`, `{ "action": "close" }`, `{ "action": "stop" }`
- **Exhaust Fan**: `{ "action": "set_speed", "speed": 2 }`, `{ "action": "on" }`, `{ "action": "off" }`

---

## 4. Custom Sensor Telemetry

### `GET /api/devices/:deviceId/sensors`
- Returns list of sensors associated with the custom sensor node.

### `GET /api/sensors/:sensorId/readings`
- **Query Params**: `?from=2026-08-16T00:00:00Z&to=2026-08-16T23:59:59Z&limit=100`

---

## 5. Automations (`/api/automations`)

### `POST /api/automations`
- **Body**:
  ```json
  {
    "homeId": 1,
    "name": "Auto Fan On High Temp",
    "enabled": true,
    "configuration": {
      "trigger": { "type": "sensor_threshold", "sensorType": "temperature", "operator": ">", "value": 30 },
      "action": { "deviceId": 3, "action": "set_speed", "speed": 2 }
    }
  }
  ```

---

## 6. Real-Time WebSockets

Connect to `ws://localhost:3000`.

Events:
- `sensor.telemetry` -> `{ "deviceUid": "esp-001", "sensor": "temperature", "value": 28.4, "recordedAt": "..." }`
- `device.state` -> `{ "deviceUid": "door-001", "deviceType": "SMART_DOOR", "state": { "door": "closed", "lock": "locked" } }`
- `device.status` -> `{ "deviceUid": "esp-001", "status": "online", "lastSeenAt": "..." }`
- `command.executed` -> `{ "deviceUid": "door-001", "command": "unlock", "status": "SENT", "executedAt": "..." }`
