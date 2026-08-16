#pragma once

#include <Arduino.h>
#include "types.h"
#include "config.h"

#if defined(ESP32)
  #include <ESP32Servo.h>
#else
  #include <Servo.h>
#endif

class ExhaustFanFSM {
public:
  ExhaustFanFSM();

  // Initialization (Pin modes, attach servo, read initial limit switch, safe boot state)
  void begin();

  // Non-blocking tick called inside main loop()
  void update();

  // User / MQTT Command Inputs (Desired state)
  void requestPower(bool power);
  void requestDirection(FanDirection direction);
  void clearError();

  // Getters for Telemetry & State Reporting
  bool getDesiredPower() const { return _desiredPower; }
  FanDirection getDesiredDirection() const { return _desiredDirection; }
  bool getActualPower() const { return _actualPower; }
  FanDirection getActualDirection() const { return _actualDirection; }
  DuctPosition getDuctPosition() const { return _ductPosition; }
  FanOperationState getOperationState() const { return _operationState; }
  FanErrorCode getErrorCode() const { return _errorCode; }

  // State Change Notification Hook
  bool hasStateChanged();
  void clearStateChanged() { _stateChanged = false; }

private:
  // Hardware I/O Read/Write
  DuctPosition readRawLimitSwitch();
  void setRelayPower(bool on);
  void setRelayDirection(FanDirection dir);

  // Servo Control Sub-routine
  void startServoPulls(uint8_t targetPulls);
  void updateServoSubFSM();
  void stopServo();

  // State Machine Step Handlers
  void handleBooting();
  void handleIdle();
  void handleOpeningDuct();
  void handleClosingDuct();
  void handleStoppingFan();
  void handleWaitingMotorStop();
  void handleChangingDirection();
  void handleWaitingRelaySettle();
  void handleStartingFan();
  void handleRunning();
  void handleError();

  void setOperationState(FanOperationState newState);
  void triggerError(FanErrorCode error);

  // Hardware Pins
  uint8_t _pinRelayPower;
  uint8_t _pinRelayDirection;
  uint8_t _pinServo;
  uint8_t _pinLimitSwitch;

  // Servo instance
  Servo _servo;

  // Servo Sub-FSM state
  enum ServoSubState {
    SERVO_SUB_IDLE,
    SERVO_SUB_PULLING,
    SERVO_SUB_HOLDING,
    SERVO_SUB_RETURNING,
    SERVO_SUB_PAUSING
  };

  ServoSubState _servoSubState;
  uint8_t _servoPullsTarget;
  uint8_t _servoPullsCompleted;
  unsigned long _servoStepTimer;

  // Current State
  bool _desiredPower;
  FanDirection _desiredDirection;
  bool _actualPower;
  FanDirection _actualDirection;
  DuctPosition _ductPosition;
  FanOperationState _operationState;
  FanErrorCode _errorCode;

  // Timers & Flags
  unsigned long _stateTimer;
  unsigned long _ductOperationTimer;
  bool _stateChanged;
};
