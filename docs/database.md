# Smart Home Platform - Database Documentation

## Database Technology
- **Database Engine**: PostgreSQL 16
- **ORM**: Prisma v7 with `@prisma/adapter-pg`

---

## Entity Relationship Summary

```
User (Authentication & ownership)
 
Home (1) ───< Room (N) ───< Device (N)
                               │
            ┌──────────────────┴──────────────────┐
            │ (CUSTOM_SENSOR)                     │ (All Devices)
            ▼                                     ▼
        Sensor (N)                          DeviceCommand (N)
            │
            ▼
     SensorReading (N)  <-- Indexed by [sensorId, recordedAt]

Home (1) ───< Automation (N)
```

---

## Tables & Models

1. **`users`**: `id`, `name`, `email`, `passwordHash`, `createdAt`, `updatedAt`
2. **`homes`**: `id`, `name`, `address`, `createdAt`, `updatedAt`
3. **`rooms`**: `id`, `homeId`, `name`, `createdAt`, `updatedAt`
4. **`devices`**: `id`, `roomId`, `name`, `deviceUid` (UNIQUE), `deviceType` (`CUSTOM_SENSOR` | `SMART_DOOR` | `SMART_CURTAIN` | `EXHAUST_FAN`), `status`, `lastSeenAt`, `metadata` (JSON), `createdAt`, `updatedAt`
5. **`sensors`**: `id`, `deviceId`, `type`, `name`, `unit`, `createdAt`, `updatedAt`
6. **`sensor_readings`**: `id`, `sensorId`, `value`, `recordedAt` *(Indexed for high-performance time-series queries)*
7. **`device_commands`**: `id`, `deviceId`, `command`, `payload` (JSON), `status` (`PENDING` | `SENT` | `ACKNOWLEDGED` | `FAILED`), `createdAt`, `executedAt`
8. **`automations`**: `id`, `homeId`, `name`, `enabled`, `configuration` (JSON), `createdAt`, `updatedAt`
