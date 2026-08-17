#pragma once

#include <Arduino.h>
#include "config.h"

#if defined(ESP32)
  #include <ESP32Servo.h>
#else
  #include <Servo.h>
#endif

class ServoController {
public:
  ServoController();

  void begin();
  void update();
  void startPulls(uint8_t targetPulls);
  void stop();

  bool isBusy() const { return _state != SERVO_IDLE; }

private:
  enum ServoState {
    SERVO_IDLE,
    SERVO_PULLING,
    SERVO_HOLDING,
    SERVO_RETURNING,
    SERVO_PAUSING
  };

  uint8_t _pinServo;
  Servo _servo;
  ServoState _state;
  uint8_t _pullsTarget;
  uint8_t _pullsCompleted;
  unsigned long _timer;
};
