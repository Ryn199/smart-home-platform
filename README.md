# Smart Home Platform - Backend

Production-ready Smart Home IoT platform built with NestJS, Fastify, PostgreSQL, Prisma, Mosquitto MQTT broker, and WebSockets.

---

## 🚀 Key Features

- **NestJS + Fastify**: High-performance asynchronous HTTP engine with strict TypeScript.
- **PostgreSQL + Prisma v7**: Robust data modeling with optimized time-series indexing on sensor readings.
- **Mosquitto MQTT Broker**: Decoupled message transport with standard topic conventions.
- **Domain-Specific Device Architecture**:
  - `CUSTOM_SENSOR`: Multi-sensor discovery & telemetry logging.
  - `SMART_DOOR`: Lock/unlock command validation & physical state management.
  - `SMART_CURTAIN`: Motor position (0-100%) and open/close/stop actions.
  - `EXHAUST_FAN`: Multi-speed fan controls (0-3) and power toggles.
- **Real-Time WebSockets**: Live event streaming (`sensor.telemetry`, `device.state`, `device.status`, `command.executed`).
- **Presence Tracking**: Zero-write dynamic online/offline computation based on configurable heartbeat thresholds.
- **Automation Engine**: Sensor threshold trigger evaluation triggering device commands cleanly through the service layer.
- **Interactive OpenAPI / Swagger**: Available at `/api/docs`.
- **Security Hardening**: Helmet HTTP headers, CORS, JWT auth, DTO whitelist validation, and secure password hashing.
- **Device Simulator**: Built-in multi-device MQTT simulator for hardware-free development and testing.

---

## 🛠️ Quick Start

### 1. Prerequisites
- Node.js v20+ / v22+
- Docker & Docker Compose

### 2. Environment Setup
```bash
cp backend/.env.example backend/.env
```

### 3. Start Infrastructure (PostgreSQL & Mosquitto)
```bash
docker compose up -d postgres mosquitto
```

### 4. Install & Run Database Migrations
```bash
cd backend
npm install
npx prisma migrate deploy
```

### 5. Run the Backend
```bash
npm run start:dev
```
- API Base: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`
- Health Check: `http://localhost:3000/api/health`

### 6. Run Device Simulator (Optional)
```bash
npm run simulate
```

---

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run end-to-end integration tests
npm run test:e2e

# Run linter & formatter
npm run lint
npm run format
```

---

## 📚 Documentation

- [Architecture Overview](docs/architecture.md)
- [REST & WebSocket API Reference](docs/api.md)
- [MQTT Topic & Payload Specification](docs/mqtt.md)
- [Database Schema & Entity Model](docs/database.md)
