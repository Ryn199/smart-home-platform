#pragma once

#include <Arduino.h>

/**
 * @brief Initialize hardware pins for Web Config Portal (Trigger button & External LED)
 */
void initPortalHardware();

/**
 * @brief Check if the hardware trigger button is currently pressed
 * @return true if button is pressed (debounced)
 */
bool isTriggerPressed();

/**
 * @brief Enter blocking Web Configuration Portal mode
 * Starts AP, DNS Captive Portal, Web Server, blinks external LED, and pauses normal operations
 */
void startConfigPortal();
