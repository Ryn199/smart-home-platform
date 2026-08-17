#include "servo_controller.h"

ServoController::ServoController()
  : _pinServo(PIN_SERVO),
    _state(SERVO_IDLE),
    _pullsTarget(0),
    _pullsCompleted(0),
    _timer(0) {
}

void ServoController::begin() {
  #if defined(ESP32)
    ESP32PWM::allocateTimer(0);
    ESP32PWM::allocateTimer(1);
    ESP32PWM::allocateTimer(2);
    ESP32PWM::allocateTimer(3);
    _servo.setPeriodHertz(50);
  #endif

  _servo.attach(_pinServo);
  _servo.write(SERVO_REST_ANGLE);
  delay(100);
}

void ServoController::startPulls(uint8_t targetPulls) {
  _pullsTarget = targetPulls;
  _pullsCompleted = 0;
  _state = SERVO_PULLING;
  _timer = millis();

  if (!_servo.attached()) {
    _servo.attach(_pinServo);
  }
  _servo.write(SERVO_PULL_ANGLE);
  Serial.print("[SERVO] Starting stroke (1 of ");
  Serial.print(_pullsTarget);
  Serial.println(")...");
}

void ServoController::stop() {
  _state = SERVO_IDLE;
  if (_servo.attached()) {
    _servo.write(SERVO_REST_ANGLE);
  }
}

void ServoController::update() {
  if (_state == SERVO_IDLE) return;

  unsigned long now = millis();

  switch (_state) {
    case SERVO_PULLING:
      if (now - _timer >= SERVO_STROKE_HOLD_MS) {
        _servo.write(SERVO_REST_ANGLE);
        _state = SERVO_RETURNING;
        _timer = now;
      }
      break;

    case SERVO_RETURNING:
      if (now - _timer >= SERVO_STROKE_PAUSE_MS) {
        _pullsCompleted++;
        if (_pullsCompleted < _pullsTarget) {
          // Trigger next stroke
          _servo.write(SERVO_PULL_ANGLE);
          _state = SERVO_PULLING;
          _timer = now;
          Serial.print("[SERVO] Next stroke (");
          Serial.print(_pullsCompleted + 1);
          Serial.print(" of ");
          Serial.print(_pullsTarget);
          Serial.println(")...");
        } else {
          // Finished all strokes
          _state = SERVO_IDLE;
          Serial.println("[SERVO] Pull strokes completed.");
        }
      }
      break;

    default:
      _state = SERVO_IDLE;
      break;
  }
}
