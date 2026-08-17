#include "exhaust_fan_fsm.h"

ExhaustFanFSM::ExhaustFanFSM()
  : _desiredPower(false),
    _desiredDirection(DIR_EXHAUST),
    _ductPosition(DUCT_UNKNOWN),
    _operationState(STATE_BOOTING),
    _errorCode(ERR_NONE),
    _stateTimer(0),
    _ductOperationTimer(0),
    _stateChanged(true) {
}

void ExhaustFanFSM::begin() {
  Serial.println("[FSM] Initializing Smart Exhaust Fan Hardware Components & FSM...");

  // 1. Initialize Hardware Components
  _relays.begin();
  _limitSwitch.begin();
  _servo.begin();

  // 2. Initial Limit Detection
  _ductPosition = _limitSwitch.readPosition();
  Serial.print("[FSM] Boot Limit Detection: Duct Position is ");
  Serial.println(ductPositionToString(_ductPosition));

  // 3. Initial state: BOOTING
  _operationState = STATE_BOOTING;
  _stateTimer = millis();
  _stateChanged = true;
}

void ExhaustFanFSM::setOperationState(FanOperationState newState) {
  if (_operationState != newState) {
    Serial.print("[FSM] State: ");
    Serial.print(operationStateToString(_operationState));
    Serial.print(" -> ");
    Serial.println(operationStateToString(newState));

    _operationState = newState;
    _stateTimer = millis();
    _stateChanged = true;
  }
}

void ExhaustFanFSM::triggerError(FanErrorCode error) {
  // SAFETY: Instantly shut off power relay & stop servo on error
  _relays.setPower(false);
  _servo.stop();

  _errorCode = error;
  setOperationState(STATE_ERROR);

  Serial.print("[FSM][ERROR] Safety fault triggered: ");
  Serial.println(errorCodeToString(error));
}

void ExhaustFanFSM::clearError() {
  if (_operationState == STATE_ERROR) {
    Serial.println("[FSM] Error cleared by user request.");
    _errorCode = ERR_NONE;
    _desiredPower = false;
    setOperationState(STATE_BOOTING);
  }
}

void ExhaustFanFSM::requestPower(bool power) {
  if (_desiredPower != power) {
    _desiredPower = power;
    _stateChanged = true;
    Serial.print("[FSM] Desired Power updated -> ");
    Serial.println(power ? "ON" : "OFF");
  }
}

void ExhaustFanFSM::requestDirection(FanDirection direction) {
  if (_desiredDirection != direction) {
    _desiredDirection = direction;
    _stateChanged = true;
    Serial.print("[FSM] Desired Direction updated -> ");
    Serial.println(directionToString(direction));
  }
}

bool ExhaustFanFSM::hasStateChanged() {
  return _stateChanged;
}

// ============================================================
// MAIN STATE MACHINE UPDATE LOOP
// ============================================================
void ExhaustFanFSM::update() {
  // 1. Always service non-blocking servo movement
  _servo.update();

  // 2. Read live Limit Switch
  DuctPosition rawPos = _limitSwitch.readPosition();

  // Update duct position unless currently in transit
  if (_operationState != STATE_OPENING_DUCT && _operationState != STATE_CLOSING_DUCT) {
    if (_ductPosition != rawPos) {
      _ductPosition = rawPos;
      _stateChanged = true;
    }
  }

  // 3. State Dispatcher
  switch (_operationState) {
    case STATE_BOOTING:
      handleBooting();
      break;
    case STATE_IDLE:
      handleIdle();
      break;
    case STATE_OPENING_DUCT:
      handleOpeningDuct();
      break;
    case STATE_CLOSING_DUCT:
      handleClosingDuct();
      break;
    case STATE_STOPPING_FAN:
      handleStoppingFan();
      break;
    case STATE_WAITING_MOTOR_STOP:
      handleWaitingMotorStop();
      break;
    case STATE_CHANGING_DIRECTION:
      handleChangingDirection();
      break;
    case STATE_WAITING_RELAY_SETTLE:
      handleWaitingRelaySettle();
      break;
    case STATE_STARTING_FAN:
      handleStartingFan();
      break;
    case STATE_RUNNING:
      handleRunning();
      break;
    case STATE_ERROR:
      handleError();
      break;
  }
}

// ============================================================
// STATE HANDLERS
// ============================================================

void ExhaustFanFSM::handleBooting() {
  // Safe boot: Fan power is OFF, Direction is checked, Duct is evaluated
  _relays.setPower(false);

  DuctPosition pos = _limitSwitch.readPosition();
  _ductPosition = pos;

  if (millis() - _stateTimer >= 1000) {
    if (_desiredPower) {
      // User wanted power ON: Move towards OPENING_DUCT or STARTING
      if (_ductPosition == DUCT_OPEN) {
        if (_relays.getDirection() != _desiredDirection) {
          setOperationState(STATE_CHANGING_DIRECTION);
        } else {
          setOperationState(STATE_STARTING_FAN);
        }
      } else {
        setOperationState(STATE_OPENING_DUCT);
        _ductOperationTimer = millis();
        _ductPosition = DUCT_OPENING;
        _servo.startPulls(1); // 1 pull to open
      }
    } else {
      // Desired power is OFF: Settle in IDLE
      setOperationState(STATE_IDLE);
    }
  }
}

void ExhaustFanFSM::handleIdle() {
  // In IDLE: Fan is OFF.
  if (_relays.isPowerOn()) {
    _relays.setPower(false);
  }

  // Check if user requested ON
  if (_desiredPower) {
    DuctPosition pos = _limitSwitch.readPosition();
    if (pos == DUCT_OPEN) {
      // Duct already open: check direction or start
      if (_relays.getDirection() != _desiredDirection) {
        setOperationState(STATE_CHANGING_DIRECTION);
      } else {
        setOperationState(STATE_STARTING_FAN);
      }
    } else {
      // Duct is closed: initiate OPENING
      setOperationState(STATE_OPENING_DUCT);
      _ductOperationTimer = millis();
      _ductPosition = DUCT_OPENING;
      _servo.startPulls(1); // 1 pull cycle to OPEN duct
    }
  } else {
    // If duct is not CLOSED and user wants OFF, close duct
    DuctPosition pos = _limitSwitch.readPosition();
    if (pos == DUCT_OPEN) {
      setOperationState(STATE_CLOSING_DUCT);
      _ductOperationTimer = millis();
      _ductPosition = DUCT_CLOSING;
      _servo.startPulls(2); // 2 pull cycles to CLOSE duct
    }
  }
}

void ExhaustFanFSM::handleOpeningDuct() {
  // SAFETY: Fan MUST be OFF while duct is opening
  if (_relays.isPowerOn()) {
    _relays.setPower(false);
  }

  DuctPosition pos = _limitSwitch.readPosition();
  if (pos == DUCT_OPEN) {
    Serial.println("[FSM] Duct OPEN verified (Switch open circuit)!");
    _ductPosition = DUCT_OPEN;
    _servo.stop();

    // Check if direction needs changing before start
    if (_relays.getDirection() != _desiredDirection) {
      setOperationState(STATE_CHANGING_DIRECTION);
    } else {
      setOperationState(STATE_STARTING_FAN);
    }
    return;
  }

  // Check for operation timeout
  if (millis() - _ductOperationTimer >= DUCT_OPERATION_TIMEOUT_MS) {
    triggerError(ERR_DUCT_OPEN_TIMEOUT);
    return;
  }

  // If user changed mind to OFF during opening: abort and close
  if (!_desiredPower && !_servo.isBusy()) {
    setOperationState(STATE_CLOSING_DUCT);
    _ductOperationTimer = millis();
    _ductPosition = DUCT_CLOSING;
    _servo.startPulls(2);
  }
}

void ExhaustFanFSM::handleClosingDuct() {
  // SAFETY: Fan MUST be OFF while closing
  if (_relays.isPowerOn()) {
    _relays.setPower(false);
  }

  DuctPosition pos = _limitSwitch.readPosition();
  if (pos == DUCT_CLOSED) {
    Serial.println("[FSM] Duct CLOSED verified (Switch pressed)!");
    _ductPosition = DUCT_CLOSED;
    _servo.stop();
    setOperationState(STATE_IDLE);
    return;
  }

  // Check for operation timeout
  if (millis() - _ductOperationTimer >= DUCT_OPERATION_TIMEOUT_MS) {
    triggerError(ERR_DUCT_CLOSE_TIMEOUT);
    return;
  }

  // If user changed mind to ON during closing: wait until servo idle then reopen
  if (_desiredPower && !_servo.isBusy()) {
    setOperationState(STATE_OPENING_DUCT);
    _ductOperationTimer = millis();
    _ductPosition = DUCT_OPENING;
    _servo.startPulls(1);
  }
}

void ExhaustFanFSM::handleStoppingFan() {
  // 1. Immediately turn OFF fan power relay
  _relays.setPower(false);
  // 2. Transition to waiting motor inertia to stop
  setOperationState(STATE_WAITING_MOTOR_STOP);
}

void ExhaustFanFSM::handleWaitingMotorStop() {
  // SAFETY: Fan MUST remain OFF
  if (_relays.isPowerOn()) {
    _relays.setPower(false);
  }

  // Wait for MOTOR_STOP_DELAY_MS (e.g. 3000ms) before touching direction relay or closing duct
  if (millis() - _stateTimer >= MOTOR_STOP_DELAY_MS) {
    Serial.println("[FSM] Motor inertia stop delay elapsed. Motor stopped.");

    if (!_desiredPower) {
      // User wanted fan OFF -> now proceed to close duct
      setOperationState(STATE_CLOSING_DUCT);
      _ductOperationTimer = millis();
      _ductPosition = DUCT_CLOSING;
      _servo.startPulls(2);
    } else {
      // User requested direction change while fan was running
      if (_relays.getDirection() != _desiredDirection) {
        setOperationState(STATE_CHANGING_DIRECTION);
      } else {
        setOperationState(STATE_STARTING_FAN);
      }
    }
  }
}

void ExhaustFanFSM::handleChangingDirection() {
  // SAFETY INTERLOCK 1: Direction relay MUST NEVER switch when fan is ON
  if (_relays.isPowerOn()) {
    _relays.setPower(false);
    setOperationState(STATE_WAITING_MOTOR_STOP);
    return;
  }

  // Switch Direction Relay
  _relays.setDirection(_desiredDirection);

  // Transition to waiting relay settle
  setOperationState(STATE_WAITING_RELAY_SETTLE);
}

void ExhaustFanFSM::handleWaitingRelaySettle() {
  // Wait RELAY_SETTLE_DELAY_MS (e.g. 500ms) for contacts to settle
  if (millis() - _stateTimer >= RELAY_SETTLE_DELAY_MS) {
    Serial.println("[FSM] Relay settled.");

    if (_desiredPower) {
      setOperationState(STATE_STARTING_FAN);
    } else {
      setOperationState(STATE_IDLE);
    }
  }
}

void ExhaustFanFSM::handleStartingFan() {
  // SAFETY INTERLOCK 2: Fan CANNOT turn ON unless duct is verified OPEN
  DuctPosition pos = _limitSwitch.readPosition();
  if (pos != DUCT_OPEN) {
    Serial.println("[FSM] Safety Warning: Cannot start fan because duct is not OPEN. Re-opening...");
    setOperationState(STATE_OPENING_DUCT);
    _ductOperationTimer = millis();
    _ductPosition = DUCT_OPENING;
    _servo.startPulls(1);
    return;
  }

  // SAFETY INTERLOCK 3: Direction must match target
  if (_relays.getDirection() != _desiredDirection) {
    setOperationState(STATE_CHANGING_DIRECTION);
    return;
  }

  // Turn ON Fan Power Relay
  _relays.setPower(true);
  setOperationState(STATE_RUNNING);
}

void ExhaustFanFSM::handleRunning() {
  // 1. Verify Duct remains OPEN during run
  DuctPosition pos = _limitSwitch.readPosition();
  if (pos != DUCT_OPEN) {
    Serial.println("[FSM][SAFETY] Duct is no longer OPEN while running! Stopping fan immediately.");
    setOperationState(STATE_STOPPING_FAN);
    return;
  }

  // 2. Check if user requested OFF
  if (!_desiredPower) {
    Serial.println("[FSM] User requested Fan OFF. Initiating safe stop sequence...");
    setOperationState(STATE_STOPPING_FAN);
    return;
  }

  // 3. Check if user requested Direction change while running
  if (_desiredDirection != _relays.getDirection()) {
    Serial.println("[FSM] Direction change requested while fan running. Initiating safe stop sequence...");
    setOperationState(STATE_STOPPING_FAN);
    return;
  }
}

void ExhaustFanFSM::handleError() {
  // SAFETY: Always enforce fan power OFF in ERROR state
  if (_relays.isPowerOn()) {
    _relays.setPower(false);
  }
  _servo.stop();
}
