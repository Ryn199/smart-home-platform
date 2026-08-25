# Dokumentasi Hardware & Pinout ESP - Smart Curtain Node

Dokumen ini berisi panduan skema perkabelan (*wiring pinout*) untuk node IoT **Smart Curtain** (Roller Blind) menggunakan microcontroller **ESP32** atau **ESP8266 (NodeMCU v2)**, modul driver stepper motor (A4988 / DRV8825 / TMC2208 / L298N), dan 2 buah sensor IR limit switch.

---

## 📌 Tabel Pinout Hardware

### 1. ESP32 Dev Module

| Komponen / Fungsi | Name di `config.h` | Pin ESP32 | GPIO ESP32 | Keterangan Sambungan Hardware |
| :--- | :--- | :--- | :--- | :--- |
| **Stepper Driver STEP** | `STEP_PIN` | **D2** | **GPIO 2** | Sambungkan ke pin `STEP` / `PUL` Modul Driver |
| **Stepper Driver DIR** | `DIR_PIN` | **D4** | **GPIO 4** | Sambungkan ke pin `DIR` / `CW` Modul Driver |
| **Stepper Driver ENABLE**| `EN_PIN` | **D5** | **GPIO 5** | Sambungkan ke pin `EN` / `ENABLE` Driver (`LOW` = Active) |
| **Sensor IR Atas (Limit 100%)** | `IR_TOP_PIN` | **D19** | **GPIO 19** | Sambungkan ke pin Signal / `OUT` Sensor IR Atas |
| **Sensor IR Bawah (Limit 0%)** | `IR_BOTTOM_PIN` | **D21** | **GPIO 21** | Sambungkan ke pin Signal / `OUT` Sensor IR Bawah |
| **Tombol Web Config** | `TRIGGER_PIN` | **D22** | **GPIO 22** | Saklar eksternal ke GND (Trigger Web Config) |
| **LED Indikator Status** | `LED_INDICATOR_PIN` | **D23** | **GPIO 23** | Kaki Anoda (+) LED status eksternal dengan resistor |

---

### 2. ESP8266 NodeMCU v2

| Komponen / Fungsi | Name di `config.h` | Pin NodeMCU | GPIO ESP8266 | Keterangan Sambungan Hardware |
| :--- | :--- | :--- | :--- | :--- |
| **Stepper Driver STEP** | `STEP_PIN` | **D6** | **GPIO 12** | Pin `STEP` / `PUL` Modul Driver Stepper |
| **Stepper Driver DIR** | `DIR_PIN` | **D7** | **GPIO 13** | Pin `DIR` / `CW` Modul Driver Stepper |
| **Stepper Driver ENABLE**| `EN_PIN` | **D8** | **GPIO 15** | Pin `EN` Modul Driver Stepper (`LOW` = Active) |
| **Sensor IR Atas (Limit 100%)** | `IR_TOP_PIN` | **D2** | **GPIO 4** | Pin Signal `OUT` Sensor IR Atas Jendela |
| **Sensor IR Bawah (Limit 0%)** | `IR_BOTTOM_PIN` | **D1** | **GPIO 5** | Pin Signal `OUT` Sensor IR Bawah Jendela |
| **Tombol Web Config** | `TRIGGER_PIN` | **D3** | **GPIO 0** | Tombol `FLASH` bawaan NodeMCU (atau saklar ke GND) |
| **LED Indikator Status** | `LED_INDICATOR_PIN` | **D5** | **GPIO 14** | Anoda (+) LED Eksternal (Status/Portal) |

---

## ⚡ Skema Daya & Driver Stepper

1. **Power Supply Motor**: Gunakan Catu Daya Terpisah (misal Adapter 12V 2A DC) untuk memberi daya ke pin `VMOT` & `GND` pada Driver Motor (A4988 / DRV8825 / L298N). **Jangan memberi daya motor langsung dari pin 3.3V/5V ESP**.
2. **Common Ground**: **Wajib menyambungkan GND ESP dengan GND Driver Motor / Power Supply 12V** agar sinyal digital `STEP`, `DIR`, dan `EN` memiliki referensi ground yang sama.
3. **Sensor IR (FC-51 / Obstacle Sensor)**:
   - `VCC` $\rightarrow$ Connect to **3.3V** or **5V** ESP.
   - `GND` $\rightarrow$ Connect to **GND** ESP.
   - `OUT` $\rightarrow$ Connect to `IR_TOP_PIN` & `IR_BOTTOM_PIN` masing-masing.

---

## 🔍 Logika Optik Sensor IR Roller Blind

| Posisi Kain Gorden | Status IR Atas (`IR_TOP`) | Status IR Bawah (`IR_BOTTOM`) | Keterangan Sistem |
| :--- | :--- | :--- | :--- |
| **Terbuka Penuh (100%)** | **BERSIH / CLEAR** | **BERSIH / CLEAR** | Kain tergulung habis di atas sensor IR atas. |
| **Transisi / Sebagian (1–99%)** | **TERTUTUP / COVERED** | **BERSIH / CLEAR** | Kain menutup jendela atas, bagian bawah kosong. |
| **Tertutup Penuh (0%)** | **TERTUTUP / COVERED** | **TERTUTUP / COVERED** | Kain menjuntai penuh menyentuh sensor IR bawah. |

---

## 🛠️ Parameter Konfigurasi Software (`config.h`)

```cpp
#define TOTAL_STEPS_RANGE    4000    // Estimasi jumlah step total dari 0% ke 100%
#define STEP_INTERVAL_US      1000   // Interval mikrosekon per pulsa (kecepatan stepper)
#define IR_ACTIVE_LEVEL       LOW    // Sinyal aktif sensor IR (LOW jika terhalang)
#define DRIVER_ENABLE_LEVEL   LOW    // Logika enable driver A4988/DRV8825 (LOW = Aktif)
#define DRIVER_DISABLE_LEVEL  HIGH   // Logika disable driver (HIGH = Mati/Hemat Daya)
```
