#pragma once

#include <Arduino.h>

// ============================================================
// SMART EXHAUST FAN ENUMS & DATA TYPES
// ============================================================

enum FanDirection {
  DIR_INTAKE = 0,
  DIR_EXHAUST = 1
};

enum DuctPosition {
  DUCT_OPEN = 0,
  DUCT_CLOSED = 1,
  DUCT_OPENING = 2,
  DUCT_CLOSING = 3,
  DUCT_UNKNOWN = 4,
  DUCT_ERROR = 5
};

enum FanOperationState {
  STATE_BOOTING = 0,
  STATE_IDLE = 1,
  STATE_OPENING_DUCT = 2,
  STATE_CLOSING_DUCT = 3,
  STATE_STOPPING_FAN = 4,
  STATE_WAITING_MOTOR_STOP = 5,
  STATE_CHANGING_DIRECTION = 6,
  STATE_WAITING_RELAY_SETTLE = 7,
  STATE_STARTING_FAN = 8,
  STATE_RUNNING = 9,
  STATE_ERROR = 10
};

enum FanErrorCode {
  ERR_NONE = 0,
  ERR_DUCT_OPEN_TIMEOUT = 1,
  ERR_DUCT_CLOSE_TIMEOUT = 2,
  ERR_DUCT_POSITION_INVALID = 3,
  ERR_SERVO_ERROR = 4,
  ERR_MOTOR_STOP_TIMEOUT = 5,
  ERR_DIRECTION_CHANGE_ERROR = 6,
  ERR_MQTT_ERROR = 7
};

// ============================================================
// STRING CONVERSION HELPERS
// ============================================================

inline const char* directionToString(FanDirection dir) {
  switch (dir) {
    case DIR_INTAKE:  return "INTAKE";
    case DIR_EXHAUST: return "EXHAUST";
    default:          return "EXHAUST";
  }
}

inline FanDirection stringToDirection(const char* str) {
  if (str && (strcmp(str, "INTAKE") == 0 || strcmp(str, "intake") == 0)) {
    return DIR_INTAKE;
  }
  return DIR_EXHAUST;
}

inline const char* ductPositionToString(DuctPosition pos) {
  switch (pos) {
    case DUCT_OPEN:    return "OPEN";
    case DUCT_CLOSED:  return "CLOSED";
    case DUCT_OPENING: return "OPENING";
    case DUCT_CLOSING: return "CLOSING";
    case DUCT_UNKNOWN: return "UNKNOWN";
    case DUCT_ERROR:   return "ERROR";
    default:           return "UNKNOWN";
  }
}

inline const char* operationStateToString(FanOperationState state) {
  switch (state) {
    case STATE_BOOTING:              return "BOOTING";
    case STATE_IDLE:                 return "IDLE";
    case STATE_OPENING_DUCT:         return "OPENING_DUCT";
    case STATE_CLOSING_DUCT:         return "CLOSING_DUCT";
    case STATE_STOPPING_FAN:         return "STOPPING_FAN";
    case STATE_WAITING_MOTOR_STOP:   return "WAITING_MOTOR_STOP";
    case STATE_CHANGING_DIRECTION:   return "CHANGING_DIRECTION";
    case STATE_WAITING_RELAY_SETTLE: return "WAITING_RELAY_SETTLE";
    case STATE_STARTING_FAN:         return "STARTING_FAN";
    case STATE_RUNNING:              return "RUNNING";
    case STATE_ERROR:                return "ERROR";
    default:                         return "IDLE";
  }
}

inline const char* errorCodeToString(FanErrorCode err) {
  switch (err) {
    case ERR_NONE:                   return "NONE";
    case ERR_DUCT_OPEN_TIMEOUT:      return "DUCT_OPEN_TIMEOUT";
    case ERR_DUCT_CLOSE_TIMEOUT:     return "DUCT_CLOSE_TIMEOUT";
    case ERR_DUCT_POSITION_INVALID:  return "DUCT_POSITION_INVALID";
    case ERR_SERVO_ERROR:            return "SERVO_ERROR";
    case ERR_MOTOR_STOP_TIMEOUT:     return "MOTOR_STOP_TIMEOUT";
    case ERR_DIRECTION_CHANGE_ERROR: return "DIRECTION_CHANGE_ERROR";
    case ERR_MQTT_ERROR:             return "MQTT_ERROR";
    default:                         return "NONE";
  }
}
