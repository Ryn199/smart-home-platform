#pragma once

#include <Arduino.h>
#include "types.h"
#include "config.h"

class LimitSwitch {
public:
  LimitSwitch();

  void begin();
  DuctPosition readPosition();

  bool isClosed() { return readPosition() == DUCT_CLOSED; }
  bool isOpen()   { return readPosition() == DUCT_OPEN; }

private:
  uint8_t _pinSwitch;
};
