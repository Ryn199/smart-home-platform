#include "limit_switch.h"

LimitSwitch::LimitSwitch()
  : _pinSwitch(PIN_LIMIT_SWITCH) {
}

void LimitSwitch::begin() {
  // Configured with internal pullup:
  // Switch Tertekan (Short to GND / LOW)   = Duct TERTUTUP (CLOSED)
  // Switch Terbuka  (Open Circuit / HIGH)  = Duct DIBUKA (OPEN)
  pinMode(_pinSwitch, INPUT_PULLUP);
}

DuctPosition LimitSwitch::readPosition() {
  int pinVal = digitalRead(_pinSwitch);
  if (pinVal == LIMIT_CLOSED_LEVEL) {
    return DUCT_CLOSED;
  } else {
    return DUCT_OPEN;
  }
}
