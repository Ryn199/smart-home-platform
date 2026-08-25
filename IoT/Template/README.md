# Dokumentasi Hardware & Pinout ESP - Base IoT Node Template

Dokumen ini berisi panduan pinout dasar untuk project **Base IoT Template** pada **ESP32** dan **ESP8266 (NodeMCU v2)**.

---

## 📌 Tabel Pinout Base Template

### 1. ESP32 Dev Module

| Komponen / Fungsi | Name di `config.h` | Pin ESP32 GPIO | Keterangan Sambungan Hardware |
| :--- | :--- | :--- | :--- |
| **Tombol Web Config** | `TRIGGER_PIN` | **GPIO 0** | Gunakan Tombol `BOOT` bawaan ESP32 (atau saklar ke GND) |
| **LED Indikator Status** | `LED_INDICATOR_PIN` | **GPIO 18** | Sambungkan ke kaki Anoda (+) LED eksternal dengan resistor |

---

### 2. ESP8266 NodeMCU v2

| Komponen / Fungsi | Name di `config.h` | Pin NodeMCU | GPIO ESP8266 | Keterangan Sambungan Hardware |
| :--- | :--- | :--- | :--- | :--- |
| **Tombol Web Config** | `TRIGGER_PIN` | **D3** | **GPIO 0** | Tombol `FLASH` bawaan NodeMCU (atau saklar ke GND) |
| **LED Indikator Status** | `LED_INDICATOR_PIN` | **D5** | **GPIO 14** | Anoda (+) LED Eksternal (Status/Portal) |

---

## ⚙️ Fitur Utama Template
1. **EEPROM Storage**: Menyimpan WiFi SSID, Password, MQTT Broker IP/Port, Pairing Code, dan Version.
2. **Web Config Captive Portal**: Akses AP `SmartHome-Node-XXXX` di IP `192.168.4.1` saat tombol trigger ditekan.
3. **MQTT Telemetry & Commands**: Mendukung diagnostik internal (`iot/diagnostics`) dan perintah sistem (`restart`, `ping`, `open_config`, `ota_update`).
4. **OTA Firmware Update**: Update firmware Over-The-Air secara otomatis melalui HTTP download dari server backend.
