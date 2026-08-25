#include "web_portal.h"
#include "config.h"
#include "storage_manager.h"
#include "wifi_manager.h"

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266WebServer.h>
  #include <DNSServer.h>
  static ESP8266WebServer server(80);
#elif defined(ESP32)
  #include <WiFi.h>
  #include <WebServer.h>
  #include <DNSServer.h>
  static WebServer server(80);
#endif

static DNSServer dnsServer;
static const byte DNS_PORT = 53;
static IPAddress apIP(192, 168, 4, 1);
static IPAddress netMsk(255, 255, 255, 0);

static bool portalRunning = false;
static bool shouldRestart = false;
static unsigned long restartTimer = 0;

void initPortalHardware() {
  pinMode(TRIGGER_PIN, INPUT_PULLUP);
  pinMode(LED_INDICATOR_PIN, OUTPUT);
  digitalWrite(LED_INDICATOR_PIN, LOW);
}

bool isTriggerPressed() {
  if (digitalRead(TRIGGER_PIN) == LOW) {
    delay(50); // Debounce delay
    if (digitalRead(TRIGGER_PIN) == LOW) {
      return true;
    }
  }
  return false;
}

static const char HTML_HEADER[] PROGMEM = 
"<!DOCTYPE html><html lang='en'><head>"
"<meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1.0'>"
"<title>Smart Home IoT - Smart Curtain Config</title>"
"<style>"
"*{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}"
"body{background:radial-gradient(circle at top right,#1e1e38,#0f1016);color:#f1f5f9;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}"
".card{background:rgba(255,255,255,0.05);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;box-shadow:0 20px 40px rgba(0,0,0,0.5);width:100%;max-width:460px;padding:32px}"
".header{text-align:center;margin-bottom:28px}"
".icon{width:56px;height:56px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;margin-bottom:12px;box-shadow:0 8px 20px rgba(59,130,246,0.4)}"
"h1{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}"
".badge{display:inline-block;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);font-size:12px;padding:4px 10px;border-radius:20px;margin-top:6px;font-weight:500}"
".section-title{font-size:13px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin:20px 0 10px;font-weight:600;display:flex;align-items:center;gap:6px}"
".section-title::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.08)}"
".form-group{margin-bottom:14px}"
"label{display:block;font-size:13px;font-weight:500;margin-bottom:6px;color:#cbd5e1}"
"input,select{width:100%;padding:12px 14px;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.12);border-radius:10px;color:#f8fafc;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}"
"input:focus,select:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,0.25)}"
".input-row{display:grid;grid-template-columns:2fr 1fr;gap:10px}"
".pass-wrapper{position:relative;display:flex;align-items:center}"
".pass-wrapper input{padding-right:44px}"
".toggle-btn{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:transparent;border:none;color:#94a3b8;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;border-radius:6px;transition:color .2s,background .2s}"
".toggle-btn:hover{color:#f8fafc;background:rgba(255,255,255,0.08)}"
".toggle-btn:focus{outline:none;color:#60a5fa}"
".btn{width:100%;padding:13px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;border:none;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px}"
".btn-primary{background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;box-shadow:0 4px 14px rgba(59,130,246,0.4);margin-top:22px}"
".btn-primary:hover{opacity:0.95;transform:translateY(-1px)}"
".btn-secondary{background:rgba(255,255,255,0.06);color:#cbd5e1;border:1px solid rgba(255,255,255,0.1);margin-top:10px}"
".btn-secondary:hover{background:rgba(255,255,255,0.1)}"
".scan-btn{background:transparent;border:1px dashed #3b82f6;color:#60a5fa;padding:8px;font-size:12px;border-radius:8px;cursor:pointer;width:100%;margin-bottom:8px;font-weight:500}"
".scan-btn:hover{background:rgba(59,130,246,0.1)}"
".footer{text-align:center;margin-top:20px;font-size:11px;color:#64748b}"
"</style></head><body><div class='card'>"
"<div class='header'>"
"<div class='icon'>🪟</div>"
"<h1>Smart Curtain Node</h1>"
"<span class='badge'>Node: Smart Curtain</span>"
"</div>"
"<form method='POST' action='/save'>";

static void handleRoot() {
  const AppConfig& config = getConfig();
  String mac = getDeviceMac();

  String html = FPSTR(HTML_HEADER);

  html += "<div class='section-title'>📡 WiFi Network</div>";
  html += "<button type='button' class='scan-btn' onclick='scanWiFi()'>🔍 Scan Nearby WiFi</button>";
  html += "<div class='form-group'>";
  html += "<label for='ssid'>WiFi SSID</label>";
  html += "<input type='text' id='ssid' name='ssid' value='" + String(config.wifiSsid) + "' placeholder='Enter WiFi Name' required maxlength='32'>";
  html += "</div>";

  html += "<div class='form-group'>";
  html += "<label for='password'>WiFi Password</label>";
  html += "<div class='pass-wrapper'>";
  html += "<input type='password' id='password' name='password' value='" + String(config.wifiPassword) + "' placeholder='Enter WiFi Password' maxlength='64'>";
  html += "<button type='button' class='toggle-btn' onclick=\"togglePass('password',this)\" title='Show Password'>"
          "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>"
          "</button>";
  html += "</div>";
  html += "</div>";

  html += "<div class='section-title'>☁️ MQTT Broker</div>";
  html += "<div class='form-group input-row'>";
  html += "<div><label for='broker'>Broker IP / Host</label>";
  html += "<input type='text' id='broker' name='broker' value='" + String(config.mqttBroker) + "' placeholder='e.g. 192.168.1.100' required maxlength='64'></div>";
  html += "<div><label for='port'>Port</label>";
  html += "<input type='number' id='port' name='port' value='" + String(config.mqttPort) + "' min='1' max='65535' required></div>";
  html += "</div>";

  html += "<div class='form-group'>";
  html += "<label for='user'>MQTT Username (Optional)</label>";
  html += "<input type='text' id='user' name='user' value='" + String(config.mqttUser) + "' placeholder='Leave blank if none' maxlength='32'>";
  html += "</div>";

  html += "<div class='form-group'>";
  html += "<label for='mqtt_pass'>MQTT Password (Optional)</label>";
  html += "<div class='pass-wrapper'>";
  html += "<input type='password' id='mqtt_pass' name='mqtt_pass' value='" + String(config.mqttPassword) + "' placeholder='Leave blank if none' maxlength='32'>";
  html += "<button type='button' class='toggle-btn' onclick=\"togglePass('mqtt_pass',this)\" title='Show Password'>"
          "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>"
          "</button>";
  html += "</div>";
  html += "</div>";

  html += "<div class='section-title'>🔑 Device Authentication</div>";
  html += "<div class='form-group'>";
  html += "<label for='pairing_code'>Pairing Code (Web Admin)</label>";
  html += "<input type='text' id='pairing_code' name='pairing_code' value='" + String(config.pairingCode) + "' placeholder='e.g. CURTAIN-001' required maxlength='64'>";
  html += "</div>";

  html += "<button type='submit' class='btn btn-primary'>💾 Save &amp; Restart Device</button>";
  html += "<button type='button' class='btn btn-secondary' onclick=\"location.href='/exit'\">❌ Exit Without Saving</button>";
  html += "</form>";

  html += "<div class='footer'>Hardware MAC: " + mac + "<br>Config Portal Active &bull; Motor Operations Paused</div>";

  html += "<script>"
  "const eyeSvg=\"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z'/><circle cx='12' cy='12' r='3'/></svg>\";"
  "const eyeOffSvg=\"<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24'/><line x1='1' y1='1' x2='23' y2='23'/></svg>\";"
  "function togglePass(id,btn){"
  "  const el=document.getElementById(id);"
  "  if(el.type==='password'){"
  "    el.type='text';"
  "    btn.innerHTML=eyeOffSvg;"
  "    btn.title='Hide Password';"
  "  }else{"
  "    el.type='password';"
  "    btn.innerHTML=eyeSvg;"
  "    btn.title='Show Password';"
  "  }"
  "}"
  "function scanWiFi(){"
  "  const btn=document.querySelector('.scan-btn');"
  "  btn.innerText='⏳ Scanning...';"
  "  fetch('/scan').then(r=>r.json()).then(nets=>{"
  "    btn.innerText='🔍 Scan Nearby WiFi';"
  "    if(nets.length===0){alert('No networks found.');return;}"
  "    let choice=prompt('Select WiFi from list:\\n'+nets.map((n,i)=>`${i+1}. ${n.ssid} (${n.rssi}dBm)`).join('\\n')+'\\nEnter number:');"
  "    if(choice && nets[choice-1]){ document.getElementById('ssid').value=nets[choice-1].ssid; }"
  "  }).catch(e=>{ btn.innerText='🔍 Scan Nearby WiFi'; alert('Scan failed.'); });"
  "}"
  "</script>";

  html += "</div></body></html>";

  server.send(200, "text/html", html);
}

static void handleSave() {
  AppConfig newConfig;
  memset(&newConfig, 0, sizeof(AppConfig));

  String ssid = server.arg("ssid");
  String password = server.arg("password");
  String broker = server.arg("broker");
  String portStr = server.arg("port");
  String user = server.arg("user");
  String mqttPass = server.arg("mqtt_pass");
  String pairingCode = server.arg("pairing_code");

  strncpy(newConfig.wifiSsid, ssid.c_str(), sizeof(newConfig.wifiSsid) - 1);
  strncpy(newConfig.wifiPassword, password.c_str(), sizeof(newConfig.wifiPassword) - 1);
  strncpy(newConfig.mqttBroker, broker.c_str(), sizeof(newConfig.mqttBroker) - 1);
  newConfig.mqttPort = portStr.toInt() > 0 ? portStr.toInt() : 1883;
  strncpy(newConfig.mqttUser, user.c_str(), sizeof(newConfig.mqttUser) - 1);
  strncpy(newConfig.mqttPassword, mqttPass.c_str(), sizeof(newConfig.mqttPassword) - 1);
  strncpy(newConfig.pairingCode, pairingCode.c_str(), sizeof(newConfig.pairingCode) - 1);

  saveConfig(newConfig);

  String html = "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width,initial-scale=1.0'>"
  "<title>Settings Saved</title>"
  "<style>"
  "body{background:#0f1016;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center}"
  ".card{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:40px;max-width:400px;box-shadow:0 20px 40px rgba(0,0,0,0.5)}"
  "h1{color:#10b981;font-size:24px;margin-bottom:12px}"
  "p{color:#94a3b8;font-size:14px;line-height:1.6}"
  ".spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,0.1);border-top:3px solid #10b981;border-radius:50%;margin:20px auto;animation:spin 1s linear infinite}"
  "@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}"
  "</style></head><body><div class='card'>"
  "<div style='font-size:48px;margin-bottom:10px;'>✅</div>"
  "<h1>Settings Saved!</h1>"
  "<p>Configuration has been saved to EEPROM memory.</p>"
  "<p>The Smart Curtain node is rebooting now and connecting with new credentials...</p>"
  "<div class='spinner'></div>"
  "</div></body></html>";

  server.send(200, "text/html", html);

  shouldRestart = true;
  restartTimer = millis();
}

static void handleScan() {
  int n = WiFi.scanNetworks();
  String json = "[";
  for (int i = 0; i < n; ++i) {
    if (i > 0) json += ",";
    json += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + "}";
  }
  json += "]";
  server.send(200, "application/json", json);
}

static void handleExit() {
  String html = "<!DOCTYPE html><html><body style='background:#0f1016;color:#fff;font-family:sans-serif;text-align:center;padding:50px;'>"
  "<h2>Exiting Configuration Portal</h2><p>Rebooting back into normal operating mode...</p></body></html>";
  server.send(200, "text/html", html);

  shouldRestart = true;
  restartTimer = millis();
}

static void handleNotFound() {
  // Captive portal redirect
  server.sendHeader("Location", "http://192.168.4.1/", true);
  server.send(302, "text/plain", "");
}

void startConfigPortal() {
  Serial.println();
  Serial.println("==================================================");
  Serial.println("[ConfigPortal] TRIGGER ACTIVATED: Entering Web Configuration Mode...");
  Serial.println("==================================================");

  // Disconnect from existing WiFi network & stop normal functions
  WiFi.disconnect();
  delay(100);

  // Start Access Point
  String cleanMac = getDeviceMac();
  cleanMac.replace(":", "");
  String apName = String("SmartCurtain-Node-") + cleanMac.substring(cleanMac.length() > 4 ? cleanMac.length() - 4 : 0);

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, netMsk);
  WiFi.softAP(apName.c_str());

  Serial.print("[ConfigPortal] Access Point Started: ");
  Serial.println(apName);
  Serial.print("[ConfigPortal] Open Browser at: http://");
  Serial.println(WiFi.softAPIP());
  Serial.println("[ConfigPortal] External LED blinking active. All normal node tasks PAUSED.");

  // Start Captive Portal DNS
  dnsServer.setErrorReplyCode(DNSReplyCode::NoError);
  dnsServer.start(DNS_PORT, "*", apIP);

  // Setup Web Server Routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.on("/scan", HTTP_GET, handleScan);
  server.on("/exit", HTTP_GET, handleExit);
  server.onNotFound(handleNotFound);
  server.begin();

  portalRunning = true;
  shouldRestart = false;

  unsigned long lastBlink = 0;
  bool ledState = false;

  // Dedicated blocking loop for configuration portal
  while (portalRunning) {
    // Non-blocking external LED Blink (200ms ON / 200ms OFF)
    unsigned long currentMillis = millis();
    if (currentMillis - lastBlink >= 200) {
      lastBlink = currentMillis;
      ledState = !ledState;
      digitalWrite(LED_INDICATOR_PIN, ledState ? HIGH : LOW);
    }

    dnsServer.processNextRequest();
    server.handleClient();

    // Check if restart was requested by save or exit
    if (shouldRestart && (currentMillis - restartTimer >= 1500)) {
      digitalWrite(LED_INDICATOR_PIN, LOW);
      Serial.println("[ConfigPortal] Restarting ESP device now...");
      delay(200);
      ESP.restart();
    }

    delay(5);
  }

  // Restore LED state when portal finishes
  digitalWrite(LED_INDICATOR_PIN, LOW);
}
