#include "relay_controller.h"

RelayController::RelayController()
  : _pinPower(PIN_RELAY_POWER),
    _pinDirection(PIN_RELAY_DIRECTION),
    _powerOn(false),
    _direction(DIR_EXHAUST) {
}

void RelayController::begin() {
  pinMode(_pinPower, OUTPUT);
  pinMode(_pinDirection, OUTPUT);

  // Default safe initial state: Fan OFF, Direction EXHAUST
  setPower(false);
  setDirection(DIR_EXHAUST);
}

void RelayController::setPower(bool on) {
  _powerOn = on;
  digitalWrite(_pinPower, on ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
  Serial.print("[RELAY] Power -> ");
  Serial.println(on ? "ON" : "OFF");
}

void RelayController::setDirection(FanDirection dir) {
  _direction = dir;
  digitalWrite(_pinDirection, (dir == DIR_INTAKE) ? RELAY_DIR_INTAKE_LEVEL : RELAY_DIR_EXHAUST_LEVEL);
  Serial.print("[RELAY] Direction -> ");
  Serial.println(directionToString(dir));
}
