#pragma once

#include <Arduino.h>

/**
 * @brief Initialize MQTT configuration
 */
void setupMQTT();

/**
 * @brief Maintain MQTT connection and process MQTT client loop
 */
void maintainMQTT();

/**
 * @brief Publish current Smart Curtain state payload to MQTT broker
 * Matches NestJS backend SmartCurtainStateDto schema: { pairingCode, macAddress, position, state }
 * 
 * @param position Position percentage (0-100)
 * @param state State string ("opening", "closing", "stopped")
 * @return true if publish succeeded
 */
bool publishCurtainState(int position, const char* state);

/**
 * @brief Publish internal ESP system diagnostics payload to MQTT broker
 * @return true if publish succeeded, false otherwise
 */
bool publishDiagnostics();

/**
 * @brief Publish OTA firmware update status report to MQTT broker
 * @param status Status string ("DOWNLOADING", "FAILED", "SUCCESS_REBOOTING")
 * @param version Target firmware version string
 * @param errorMsg Optional error message if failed
 * @return true if publish succeeded
 */
bool publishOTAStatus(const char* status, const char* version, const char* errorMsg = nullptr);
