#pragma once

#include <Arduino.h>
#include "types.h"
#include "config.h"

class RelayController {
public:
  RelayController();

  void begin();
  void setPower(bool on);
  void setDirection(FanDirection dir);

  bool isPowerOn() const { return _powerOn; }
  FanDirection getDirection() const { return _direction; }

private:
  uint8_t _pinPower;
  uint8_t _pinDirection;
  bool _powerOn;
  FanDirection _direction;
};
