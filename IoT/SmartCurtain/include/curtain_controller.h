#pragma once

#include <Arduino.h>

enum CurtainState {
  CURTAIN_STOPPED = 0,
  CURTAIN_OPENING = 1,
  CURTAIN_CLOSING = 2
};

/**
 * @brief Initialize stepper motor driver pins (STEP, DIR, EN) and IR limit sensors (Top, Bottom)
 */
void initCurtainController();

/**
 * @brief Non-blocking loop function to process step pulses and monitor IR limit sensors
 */
void updateCurtainController();

/**
 * @brief Roll curtain UP until Top IR sensor becomes CLEAR (Position = 100%)
 */
void openCurtain();

/**
 * @brief Roll curtain DOWN until Bottom IR sensor becomes COVERED (Position = 0%)
 */
void closeCurtain();

/**
 * @brief Immediately stop stepper motor pulse generation and disable driver output
 */
void stopCurtain();

/**
 * @brief Command curtain to open (>= 50%) or close (< 50%) using IR limit sensor stopping
 * @param targetPosition Target percentage (0 = close, 100 = open)
 */
void setCurtainPosition(int targetPosition);

/**
 * @brief Get current curtain position percentage
 * @return int position (0-100)
 */
int getCurtainPosition();

/**
 * @brief Get current motor movement state enum
 */
CurtainState getCurtainState();

/**
 * @brief Get string representation of curtain state ("opening", "closing", "stopped")
 */
const char* getCurtainStateString();

/**
 * @brief Check if Top IR sensor is currently triggered (Opened Limit)
 */
bool isTopLimitReached();

/**
 * @brief Check if Bottom IR sensor is currently triggered (Closed Limit)
 */
bool isBottomLimitReached();
