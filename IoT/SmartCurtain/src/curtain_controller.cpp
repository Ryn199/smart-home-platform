#include "curtain_controller.h"
#include "config.h"
#include "storage_manager.h"
#include "mqtt_handler.h"

static CurtainState currentState = CURTAIN_STOPPED;
static int lastKnownPosition = 100; // 0 (Closed) or 100 (Open)
static int overtravelRemainingSteps = 0; // Steps to continue moving after IR limit triggers (~2cm)
static unsigned long lastStepMicros = 0;
static unsigned long lastMqttReportMs = 0;

// Returns true if Top IR sensor detects fabric (covered)
bool isTopLimitReached() {
  return digitalRead(IR_TOP_PIN) == IR_ACTIVE_LEVEL;
}

// Returns true if Bottom IR sensor detects fabric (covered)
bool isBottomLimitReached() {
  return digitalRead(IR_BOTTOM_PIN) == IR_ACTIVE_LEVEL;
}

void initCurtainController() {
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);
  pinMode(EN_PIN, OUTPUT);

  // Disable motor driver initially (saves power & prevents heating)
  digitalWrite(EN_PIN, DRIVER_DISABLE_LEVEL);
  digitalWrite(STEP_PIN, LOW);
  digitalWrite(DIR_PIN, DIR_UP_LEVEL);

  // Configure IR limit sensors
  pinMode(IR_TOP_PIN, INPUT_PULLUP);
  pinMode(IR_BOTTOM_PIN, INPUT_PULLUP);

  const AppConfig& config = getConfig();
  int savedPos = config.lastPosition;
  lastKnownPosition = (savedPos >= 50) ? 100 : 0;
  overtravelRemainingSteps = 0;

  bool topCovered = isTopLimitReached();
  bool bottomCovered = isBottomLimitReached();

  Serial.println("[CurtainController] Stepper hardware initialized (IR Sensor Limit Mode + 2cm Overtravel).");
  Serial.printf("[CurtainController] IR Sensors -> Top: %s | Bottom: %s\n",
    topCovered ? "COVERED" : "CLEAR",
    bottomCovered ? "COVERED" : "CLEAR"
  );

  // Optical Hardware Sanity Check on Boot (README.md):
  // 1. Both sensors CLEAR -> Roller blind is rolled all the way up (100% OPEN)
  if (!topCovered && !bottomCovered) {
    Serial.println("[CurtainController] Optical Check: Both IR sensors CLEAR -> Curtain is 100% OPEN.");
    lastKnownPosition = 100;
    saveCurtainPosition(100);
  } 
  // 2. Both sensors COVERED -> Roller blind is rolled all the way down (0% CLOSED)
  else if (topCovered && bottomCovered) {
    Serial.println("[CurtainController] Optical Check: Both IR sensors COVERED -> Curtain is 0% CLOSED.");
    lastKnownPosition = 0;
    saveCurtainPosition(0);
  }
}

void openCurtain() {
  // If Top IR is already CLEAR and we are already fully open (100%)
  if (!isTopLimitReached() && lastKnownPosition == 100) {
    Serial.println("[CurtainController] Open command ignored: Top IR Sensor is already CLEAR (100% OPEN).");
    publishCurtainState(100, "stopped");
    return;
  }

  overtravelRemainingSteps = 0;
  currentState = CURTAIN_OPENING;
  digitalWrite(DIR_PIN, DIR_UP_LEVEL);
  digitalWrite(EN_PIN, DRIVER_ENABLE_LEVEL); // Enable motor driver
  lastStepMicros = micros();
  lastMqttReportMs = millis();
  Serial.println("[CurtainController] ROLLING UP (OPENING) towards Top IR sensor...");
  publishCurtainState(getCurtainPosition(), getCurtainStateString());
}

void closeCurtain() {
  // If Bottom IR is already COVERED and we are already fully closed (0%)
  if (isBottomLimitReached() && lastKnownPosition == 0) {
    Serial.println("[CurtainController] Close command ignored: Bottom IR Sensor is already COVERED (0% CLOSED).");
    publishCurtainState(0, "stopped");
    return;
  }

  overtravelRemainingSteps = 0;
  currentState = CURTAIN_CLOSING;
  digitalWrite(DIR_PIN, DIR_DOWN_LEVEL);
  digitalWrite(EN_PIN, DRIVER_ENABLE_LEVEL); // Enable motor driver
  lastStepMicros = micros();
  lastMqttReportMs = millis();
  Serial.println("[CurtainController] ROLLING DOWN (CLOSING) towards Bottom IR sensor...");
  publishCurtainState(getCurtainPosition(), getCurtainStateString());
}

void stopCurtain() {
  if (currentState != CURTAIN_STOPPED) {
    currentState = CURTAIN_STOPPED;
    overtravelRemainingSteps = 0;
    digitalWrite(EN_PIN, DRIVER_DISABLE_LEVEL); // Disable driver output

    if (!isTopLimitReached()) {
      lastKnownPosition = 100;
    } else if (isBottomLimitReached()) {
      lastKnownPosition = 0;
    }

    saveCurtainPosition((uint8_t)lastKnownPosition);
    Serial.printf("[CurtainController] Motor STOPPED manually/limit reached at %d%%\n", lastKnownPosition);
    publishCurtainState(lastKnownPosition, getCurtainStateString());
  }
}

void setCurtainPosition(int targetPercent) {
  if (targetPercent >= 50) {
    openCurtain();
  } else {
    closeCurtain();
  }
}

void updateCurtainController() {
  if (currentState == CURTAIN_STOPPED) return;

  // 1. ROLLER BLIND OPTICAL IR LIMIT DETECTION & OVERTRAVEL TRIGGER
  // Check if IR limit is hit and we haven't started overtravel countdown yet
  if (overtravelRemainingSteps <= 0) {
    if (currentState == CURTAIN_OPENING && !isTopLimitReached()) {
      overtravelRemainingSteps = OVERTRAVEL_STEPS;
      Serial.printf("[CurtainController] IR LIMIT TRIGGERED: Top IR clear! Continuing ~2cm (%d steps) overtravel before stopping...\n", OVERTRAVEL_STEPS);
    } else if (currentState == CURTAIN_CLOSING && isBottomLimitReached()) {
      overtravelRemainingSteps = OVERTRAVEL_STEPS;
      Serial.printf("[CurtainController] IR LIMIT TRIGGERED: Bottom IR covered! Continuing ~2cm (%d steps) overtravel before stopping...\n", OVERTRAVEL_STEPS);
    }
  }

  // 2. STEPPER PULSE TIMING FOR CONTINUOUS MOTION & OVERTRAVEL COUNTDOWN
  unsigned long nowUs = micros();
  if (nowUs - lastStepMicros >= STEP_INTERVAL_US) {
    lastStepMicros = nowUs;

    // Generate single step pulse
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(3);
    digitalWrite(STEP_PIN, LOW);

    // If overtravel is active, count down remaining extra steps (~2cm)
    if (overtravelRemainingSteps > 0) {
      overtravelRemainingSteps--;
      if (overtravelRemainingSteps <= 0) {
        int finalPos = (currentState == CURTAIN_OPENING) ? 100 : 0;
        currentState = CURTAIN_STOPPED;
        digitalWrite(EN_PIN, DRIVER_DISABLE_LEVEL); // Disable driver output
        lastKnownPosition = finalPos;
        saveCurtainPosition((uint8_t)finalPos);
        Serial.printf("[CurtainController] Overtravel completed (~2cm)! Motor stopped at %d%%.\n", finalPos);
        publishCurtainState(finalPos, "stopped");
        return;
      }
    }

    // Periodic MQTT progress broadcast during continuous motion (every 1 second)
    unsigned long nowMs = millis();
    if (nowMs - lastMqttReportMs >= 1000) {
      lastMqttReportMs = nowMs;
      publishCurtainState(getCurtainPosition(), getCurtainStateString());
    }
  }
}

int getCurtainPosition() {
  if (!isTopLimitReached() && !isBottomLimitReached()) return 100;
  if (isBottomLimitReached()) return 0;
  return lastKnownPosition;
}

CurtainState getCurtainState() {
  return currentState;
}

const char* getCurtainStateString() {
  switch (currentState) {
    case CURTAIN_OPENING: return "opening";
    case CURTAIN_CLOSING: return "closing";
    case CURTAIN_STOPPED:
    default:              return "stopped";
  }
}
