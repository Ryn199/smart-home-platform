#pragma once

#include <Arduino.h>
#include "types.h"
#include "config.h"
#include "relay_controller.h"
#include "limit_switch.h"
#include "servo_controller.h"

class ExhaustFanFSM {
public:
  ExhaustFanFSM();

  // Initialization
  void begin();

  // Non-blocking tick called in main loop()
  void update();

  // User / MQTT Command Inputs
  void requestPower(bool power);
  void requestDirection(FanDirection direction);
  void clearError();

  // Getters for Telemetry & State Reporting
  bool getDesiredPower() const { return _desiredPower; }
  FanDirection getDesiredDirection() const { return _desiredDirection; }
  bool getActualPower() const { return _relays.isPowerOn(); }
  FanDirection getActualDirection() const { return _relays.getDirection(); }
  DuctPosition getDuctPosition() const { return _ductPosition; }
  FanOperationState getOperationState() const { return _operationState; }
  FanErrorCode getErrorCode() const { return _errorCode; }

  // State Change Notification Hook
  bool hasStateChanged();
  void clearStateChanged() { _stateChanged = false; }

private:
  // Hardware Component Instances
  RelayController _relays;
  LimitSwitch     _limitSwitch;
  ServoController _servo;

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

  // Current State
  bool _desiredPower;
  FanDirection _desiredDirection;
  DuctPosition _ductPosition;
  FanOperationState _operationState;
  FanErrorCode _errorCode;

  // Timers & Flags
  unsigned long _stateTimer;
  unsigned long _ductOperationTimer;
  bool _stateChanged;
};
