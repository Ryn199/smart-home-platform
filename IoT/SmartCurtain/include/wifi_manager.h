#pragma once

#include <Arduino.h>

/**
 * @brief Initialize WiFi connection
 */
void setupWiFi();

/**
 * @brief Get the hardware MAC address of the device
 * @return String MAC Address
 */
String getDeviceMac();

/**
 * @brief Check if WiFi is currently connected
 * @return true if connected, false otherwise
 */
bool isWiFiConnected();

/**
 * @brief Trigger WiFi reconnection
 */
void reconnectWiFi();
