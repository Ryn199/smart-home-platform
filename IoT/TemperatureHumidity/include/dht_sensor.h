#pragma once

#include <Arduino.h>

/**
 * @brief Initialize the DHT sensor
 */
void setupDHT();

/**
 * @brief Read temperature and humidity from DHT sensor
 * @param temperature Reference to store temperature in Celsius
 * @param humidity Reference to store humidity percentage
 * @return true if reading succeeded, false otherwise
 */
bool readDHT(float &temperature, float &humidity);
