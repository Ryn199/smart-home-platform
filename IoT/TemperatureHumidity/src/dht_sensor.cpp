#include "dht_sensor.h"
#include "config.h"
#include <DHT.h>

static DHT dht(DHTPIN, DHTTYPE);

void setupDHT() {
  dht.begin();
  delay(1000); // Allow DHT sensor time to stabilize on startup
}

bool readDHT(float &temperature, float &humidity) {
  // Attempt read with retries for timing resilience
  for (int attempt = 1; attempt <= 3; attempt++) {
    temperature = dht.readTemperature(); // Read Celsius
    humidity    = dht.readHumidity();    // Read Relative Humidity %

    // If both readings are valid, exit loop
    if (!isnan(temperature) && !isnan(humidity)) {
      break;
    }

    // If failed on earlier attempts, wait briefly and retry
    if (attempt < 3) {
      delay(200);
    }
  }

  // Check if reads still failed after retries
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[DHT] Error: Failed to read from sensor!");
    Serial.print("      - Target Pin: GPIO");
    Serial.println(DHTPIN);
    return false;
  }

  Serial.println("--------------------------------------------------");
  Serial.print("[DHT] Suhu: ");
  Serial.print(temperature, 1);
  Serial.print(" °C | Kelembaban: ");
  Serial.print(humidity, 1);
  Serial.println(" %");

  return true;
}
