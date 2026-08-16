#include "exhaust_fan_fsm.h"

ExhaustFanFSM::ExhaustFanFSM()
  : _pinRelayPower(PIN_RELAY_POWER),
    _pinRelayDirection(PIN_RELAY_DIRECTION),
    _pinServo(PIN_SERVO),
    _pinLimitOpen(PIN_LIMIT_OPEN),
    _pinLimitClose(PIN_LIMIT_CLOSE),
    _servoSubState(SERVO_SUB_IDLE),
    _servoPullsTarget(0),
    _servoPullsCompleted(0),
    _servoStepTimer(0),
    _desiredPower(false),
    _desiredDirection(DIR_EXHAUST),
    _actualPower(false),
    _actualDirection(DIR_EXHAUST),
    _ductPosition(DUCT_UNKNOWN),
    _operationState(STATE_BOOTING),
    _errorCode(ERR_NONE),
    _stateTimer(0),
    _ductOperationTimer(0),
    _stateChanged(true) {
}

void ExhaustFanFSM::begin() {
  Serial.println("[FSM] Initializing Smart Exhaust Fan Hardware & FSM...");

  // 1. Configure Relay Outputs (SAFE DEFAULT: BOTH INACTIVE)
  pinMode(_pinRelayPower, OUTPUT);
  pinMode(_pinRelayDirection, OUTPUT);
  setRelayPower(false);
  setRelayDirection(DIR_EXHAUST);

  // 2. Configure Limit Switch Inputs with internal Pullups
  pinMode(_pinLimitOpen, INPUT_PULLUP);
  pinMode(_pinLimitClose, INPUT_PULLUP);

  // 3. Attach Servo & move to initial Rest position
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

  // 4. Initial Hardware Limit Switch Read
  _ductPosition = readRawLimitSwitches();
  Serial.print("[FSM] Boot Limit Detection: Duct Position is ");
  Serial.println(ductPositionToString(_ductPosition));

  // 5. Initial state: BOOTING
  _operationState = STATE_BOOTING;
  _stateTimer = millis();
  _stateChanged = true;
}

DuctPosition ExhaustFanFSM::readRawLimitSwitches() {
  bool openActive = (digitalRead(_pinLimitOpen) == LIMIT_ACTIVE_LEVEL);
  bool closeActive = (digitalRead(_pinLimitClose) == LIMIT_ACTIVE_LEVEL);

  if (openActive && closeActive) {
    return DUCT_ERROR;
  }
  if (openActive) {
    return DUCT_OPEN;
  }
  if (closeActive) {
    return DUCT_CLOSED;
  }
  return DUCT_UNKNOWN;
}

void ExhaustFanFSM::setRelayPower(bool on) {
  _actualPower = on;
  digitalWrite(_pinRelayPower, on ? RELAY_ACTIVE_LEVEL : RELAY_INACTIVE_LEVEL);
  Serial.print("[HARDWARE] Relay Power -> ");
  Serial.println(on ? "ON" : "OFF");
}

void ExhaustFanFSM::setRelayDirection(FanDirection dir) {
  _actualDirection = dir;
  digitalWrite(_pinRelayDirection, (dir == DIR_INTAKE) ? RELAY_DIR_INTAKE_LEVEL : RELAY_DIR_EXHAUST_LEVEL);
  Serial.print("[HARDWARE] Relay Direction -> ");
  Serial.println(directionToString(dir));
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
  setRelayPower(false);
  stopServo();

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
// SERVO SUB-FSM FOR CORD PULLING
// ============================================================
void ExhaustFanFSM::startServoPulls(uint8_t targetPulls) {
  _servoPullsTarget = targetPulls;
  _servoPullsCompleted = 0;
  _servoSubState = SERVO_SUB_PULLING;
  _servoStepTimer = millis();

  if (!_servo.attached()) {
    _servo.attach(_pinServo);
  }
  _servo.write(SERVO_PULL_ANGLE);
  Serial.print("[SERVO] Starting pull cycle (1 of ");
  Serial.print(_servoPullsTarget);
  Serial.println(")...");
}

void ExhaustFanFSM::stopServo() {
  _servoSubState = SERVO_SUB_IDLE;
  if (_servo.attached()) {
    _servo.write(SERVO_REST_ANGLE);
  }
}

void ExhaustFanFSM::updateServoSubFSM() {
  if (_servoSubState == SERVO_SUB_IDLE) return;

  unsigned long now = millis();

  switch (_servoSubState) {
    case SERVO_SUB_PULLING:
      if (now - _servoStepTimer >= SERVO_STROKE_HOLD_MS) {
        _servo.write(SERVO_REST_ANGLE);
        _servoSubState = SERVO_SUB_RETURNING;
        _servoStepTimer = now;
      }
      break;

    case SERVO_SUB_RETURNING:
      if (now - _servoStepTimer >= SERVO_STROKE_PAUSE_MS) {
        _servoPullsCompleted++;
        if (_servoPullsCompleted < _servoPullsTarget) {
          // Trigger next stroke
          _servo.write(SERVO_PULL_ANGLE);
          _servoSubState = SERVO_SUB_PULLING;
          _servoStepTimer = now;
          Serial.print("[SERVO] Next stroke (");
          Serial.print(_servoPullsCompleted + 1);
          Serial.print(" of ");
          Serial.print(_servoPullsTarget);
          Serial.println(")...");
        } else {
          // Completed all strokes
          _servoSubState = SERVO_SUB_IDLE;
          Serial.println("[SERVO] Pull strokes completed.");
        }
      }
      break;

    default:
      _servoSubState = SERVO_SUB_IDLE;
      break;
  }
}

// ============================================================
// MAIN STATE MACHINE UPDATE LOOP
// ============================================================
void ExhaustFanFSM::update() {
  // 1. Always service non-blocking servo movement
  updateServoSubFSM();

  // 2. Read live Limit Switches
  DuctPosition rawPos = readRawLimitSwitches();

  // 3. Safety Interlock: Dual limit switches active at the same time is an invalid state
  if (rawPos == DUCT_ERROR) {
    if (_operationState != STATE_ERROR) {
      triggerError(ERR_DUCT_POSITION_INVALID);
    }
    return;
  }

  // Update duct position unless currently in transit
  if (_operationState != STATE_OPENING_DUCT && _operationState != STATE_CLOSING_DUCT) {
    if (_ductPosition != rawPos) {
      _ductPosition = rawPos;
      _stateChanged = true;
    }
  }

  // 4. State Dispatcher
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
  setRelayPower(false);

  DuctPosition pos = readRawLimitSwitches();
  _ductPosition = pos;

  if (millis() - _stateTimer >= 1000) {
    if (_desiredPower) {
      // User wanted power ON: Move towards OPENING_DUCT or STARTING
      if (_ductPosition == DUCT_OPEN) {
        if (_actualDirection != _desiredDirection) {
          setOperationState(STATE_CHANGING_DIRECTION);
        } else {
          setOperationState(STATE_STARTING_FAN);
        }
      } else {
        setOperationState(STATE_OPENING_DUCT);
        _ductOperationTimer = millis();
        _ductPosition = DUCT_OPENING;
        startServoPulls(1); // 1 pull to open
      }
    } else {
      // Desired power is OFF: Settle in IDLE
      setOperationState(STATE_IDLE);
    }
  }
}

void ExhaustFanFSM::handleIdle() {
  // In IDLE: Fan is OFF.
  if (_actualPower) {
    setRelayPower(false);
  }

  // Check if user requested ON
  if (_desiredPower) {
    DuctPosition pos = readRawLimitSwitches();
    if (pos == DUCT_OPEN) {
      // Duct already open: check direction or start
      if (_actualDirection != _desiredDirection) {
        setOperationState(STATE_CHANGING_DIRECTION);
      } else {
        setOperationState(STATE_STARTING_FAN);
      }
    } else {
      // Duct is closed or unknown: initiate OPENING
      setOperationState(STATE_OPENING_DUCT);
      _ductOperationTimer = millis();
      _ductPosition = DUCT_OPENING;
      startServoPulls(1); // 1 pull cycle to OPEN duct
    }
  } else {
    // If duct is not CLOSED and user wants OFF, close duct
    DuctPosition pos = readRawLimitSwitches();
    if (pos == DUCT_OPEN || pos == DUCT_UNKNOWN) {
      setOperationState(STATE_CLOSING_DUCT);
      _ductOperationTimer = millis();
      _ductPosition = DUCT_CLOSING;
      startServoPulls(2); // 2 pull cycles to CLOSE duct
    }
  }
}

void ExhaustFanFSM::handleOpeningDuct() {
  // SAFETY: Fan MUST be OFF while duct is opening
  if (_actualPower) {
    setRelayPower(false);
  }

  DuctPosition pos = readRawLimitSwitches();
  if (pos == DUCT_OPEN) {
    Serial.println("[FSM] Duct OPEN limit switch verified!");
    _ductPosition = DUCT_OPEN;
    stopServo();

    // Check if direction needs changing before start
    if (_actualDirection != _desiredDirection) {
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
  if (!_desiredPower && _servoSubState == SERVO_SUB_IDLE) {
    setOperationState(STATE_CLOSING_DUCT);
    _ductOperationTimer = millis();
    _ductPosition = DUCT_CLOSING;
    startServoPulls(2);
  }
}

void ExhaustFanFSM::handleClosingDuct() {
  // SAFETY: Fan MUST be OFF while closing
  if (_actualPower) {
    setRelayPower(false);
  }

  DuctPosition pos = readRawLimitSwitches();
  if (pos == DUCT_CLOSED) {
    Serial.println("[FSM] Duct CLOSED limit switch verified!");
    _ductPosition = DUCT_CLOSED;
    stopServo();
    setOperationState(STATE_IDLE);
    return;
  }

  // Check for operation timeout
  if (millis() - _ductOperationTimer >= DUCT_OPERATION_TIMEOUT_MS) {
    triggerError(ERR_DUCT_CLOSE_TIMEOUT);
    return;
  }

  // If user changed mind to ON during closing: wait until servo idle then reopen
  if (_desiredPower && _servoSubState == SERVO_SUB_IDLE) {
    setOperationState(STATE_OPENING_DUCT);
    _ductOperationTimer = millis();
    _ductPosition = DUCT_OPENING;
    startServoPulls(1);
  }
}

void ExhaustFanFSM::handleStoppingFan() {
  // 1. Immediately turn OFF fan power relay
  setRelayPower(false);
  // 2. Transition to waiting motor inertia to stop
  setOperationState(STATE_WAITING_MOTOR_STOP);
}

void ExhaustFanFSM::handleWaitingMotorStop() {
  // SAFETY: Fan MUST remain OFF
  if (_actualPower) {
    setRelayPower(false);
  }

  // Wait for MOTOR_STOP_DELAY_MS (e.g. 3000ms) before touching direction relay or closing duct
  if (millis() - _stateTimer >= MOTOR_STOP_DELAY_MS) {
    Serial.println("[FSM] Motor inertia stop delay elapsed. Motor stopped.");

    if (!_desiredPower) {
      // User wanted fan OFF -> now proceed to close duct
      setOperationState(STATE_CLOSING_DUCT);
      _ductOperationTimer = millis();
      _ductPosition = DUCT_CLOSING;
      startServoPulls(2);
    } else {
      // User requested direction change while fan was running
      if (_actualDirection != _desiredDirection) {
        setOperationState(STATE_CHANGING_DIRECTION);
      } else {
        setOperationState(STATE_STARTING_FAN);
      }
    }
  }
}

void ExhaustFanFSM::handleChangingDirection() {
  // SAFETY INTERLOCK 1: Direction relay MUST NEVER switch when fan is ON
  if (_actualPower) {
    setRelayPower(false);
    setOperationState(STATE_WAITING_MOTOR_STOP);
    return;
  }

  // Switch Direction Relay
  setRelayDirection(_desiredDirection);

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
  DuctPosition pos = readRawLimitSwitches();
  if (pos != DUCT_OPEN) {
    Serial.println("[FSM] Safety Warning: Cannot start fan because duct is not OPEN. Re-opening...");
    setOperationState(STATE_OPENING_DUCT);
    _ductOperationTimer = millis();
    _ductPosition = DUCT_OPENING;
    startServoPulls(1);
    return;
  }

  // SAFETY INTERLOCK 3: Direction must match target
  if (_actualDirection != _desiredDirection) {
    setOperationState(STATE_CHANGING_DIRECTION);
    return;
  }

  // Turn ON Fan Power Relay
  setRelayPower(true);
  setOperationState(STATE_RUNNING);
}

void ExhaustFanFSM::handleRunning() {
  // 1. Verify Duct remains OPEN during run
  DuctPosition pos = readRawLimitSwitches();
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
  if (_desiredDirection != _actualDirection) {
    Serial.println("[FSM] Direction change requested while fan running. Initiating safe stop sequence...");
    setOperationState(STATE_STOPPING_FAN);
    return;
  }
}

void ExhaustFanFSM::handleError() {
  // SAFETY: Always enforce fan power OFF in ERROR state
  if (_actualPower) {
    setRelayPower(false);
  }
  stopServo();
}
