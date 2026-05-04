/*
 * Smart Electricity Meter - ESP32-CAM Firmware
 * 
 * Reads electricity meter using:
 * 1. ESP32-CAM: Captures images → sends to server via MQTT for OCR
 * 2. IR Photodiode: Counts meter disk pulses → calculates kWh
 * 
 * MQTT Topics:
 *   smart-meter/{DEVICE_ID}/image   → Base64-encoded JPEG image
 *   smart-meter/{DEVICE_ID}/pulse   → Pulse count + kWh data
 *   smart-meter/{DEVICE_ID}/status  → Device heartbeat
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include "esp_camera.h"
#include "base64.h"
#include <ArduinoJson.h>

// ═══════════════════════════════════════════
// CONFIGURATION - Edit these values
// ═══════════════════════════════════════════

// WiFi
#define WIFI_SSID       "YOUR_WIFI_SSID"
#define WIFI_PASSWORD   "YOUR_WIFI_PASSWORD"

// MQTT
#define MQTT_BROKER     "broker.hivemq.com"
#define MQTT_PORT       1883
#define MQTT_USERNAME   ""
#define MQTT_PASSWORD   ""

// Device ID (unique per meter)
#define DEVICE_ID       "meter-001"

// Timing (milliseconds)
#define CAPTURE_INTERVAL_MS    21600000UL  // 6 hours
#define PULSE_REPORT_INTERVAL  300000UL    // 5 minutes
#define STATUS_INTERVAL        60000UL     // 1 minute heartbeat
#define WIFI_RETRY_DELAY       5000

// Pulse sensor
#define PULSE_SENSOR_PIN       13     // IR photodiode GPIO
#define PULSE_PER_KWH          1600   // Pulses per kWh (check your meter)
#define DEBOUNCE_MS            50     // Pulse debounce time

// Status LED
#define LED_PIN                4      // Built-in flash LED

// ═══════════════════════════════════════════
// ESP32-CAM Pin Configuration (AI-Thinker)
// ═══════════════════════════════════════════
#define PWDN_GPIO_NUM    32
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM     0
#define SIOD_GPIO_NUM    26
#define SIOC_GPIO_NUM    27
#define Y9_GPIO_NUM      35
#define Y8_GPIO_NUM      34
#define Y7_GPIO_NUM      39
#define Y6_GPIO_NUM      36
#define Y5_GPIO_NUM      21
#define Y4_GPIO_NUM      19
#define Y3_GPIO_NUM      18
#define Y2_GPIO_NUM       5
#define VSYNC_GPIO_NUM   25
#define HREF_GPIO_NUM    23
#define PCLK_GPIO_NUM    22

// ═══════════════════════════════════════════
// GLOBAL VARIABLES
// ═══════════════════════════════════════════

WiFiClient espClient;
PubSubClient mqtt(espClient);

// MQTT topics
char topicImage[64];
char topicPulse[64];
char topicStatus[64];

// Timing
unsigned long lastCapture = 0;
unsigned long lastPulseReport = 0;
unsigned long lastStatus = 0;

// Pulse counter (volatile for ISR)
volatile unsigned long pulseCount = 0;
volatile unsigned long lastPulseTime = 0;
unsigned long reportedPulseCount = 0;

// ═══════════════════════════════════════════
// INTERRUPT SERVICE ROUTINE - Pulse Counter
// ═══════════════════════════════════════════

void IRAM_ATTR pulseISR() {
    unsigned long now = millis();
    if (now - lastPulseTime > DEBOUNCE_MS) {
        pulseCount++;
        lastPulseTime = now;
    }
}

// ═══════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════

void setup() {
    Serial.begin(115200);
    Serial.println("\n=== Smart Electricity Meter ===");

    // LED
    pinMode(LED_PIN, OUTPUT);
    digitalWrite(LED_PIN, LOW);

    // Build MQTT topics
    snprintf(topicImage,  sizeof(topicImage),  "smart-meter/%s/image",  DEVICE_ID);
    snprintf(topicPulse,  sizeof(topicPulse),  "smart-meter/%s/pulse",  DEVICE_ID);
    snprintf(topicStatus, sizeof(topicStatus), "smart-meter/%s/status", DEVICE_ID);

    // Init camera
    initCamera();

    // Init pulse sensor
    pinMode(PULSE_SENSOR_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(PULSE_SENSOR_PIN), pulseISR, FALLING);

    // Connect WiFi
    connectWiFi();

    // Setup MQTT
    mqtt.setServer(MQTT_BROKER, MQTT_PORT);
    mqtt.setBufferSize(50000); // Large buffer for base64 images
    connectMQTT();

    Serial.println("Setup complete. Running...");
    blinkLED(3, 200);
}

// ═══════════════════════════════════════════
// MAIN LOOP
// ═══════════════════════════════════════════

void loop() {
    // Maintain connections
    if (WiFi.status() != WL_CONNECTED) {
        connectWiFi();
    }
    if (!mqtt.connected()) {
        connectMQTT();
    }
    mqtt.loop();

    unsigned long now = millis();

    // Capture image at interval
    if (now - lastCapture >= CAPTURE_INTERVAL_MS || lastCapture == 0) {
        captureAndSendImage();
        lastCapture = now;
    }

    // Report pulse data at interval
    if (now - lastPulseReport >= PULSE_REPORT_INTERVAL) {
        sendPulseData();
        lastPulseReport = now;
    }

    // Send status heartbeat
    if (now - lastStatus >= STATUS_INTERVAL) {
        sendStatus();
        lastStatus = now;
    }

    delay(100);
}

// ═══════════════════════════════════════════
// CAMERA
// ═══════════════════════════════════════════

void initCamera() {
    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer   = LEDC_TIMER_0;
    config.pin_d0       = Y2_GPIO_NUM;
    config.pin_d1       = Y3_GPIO_NUM;
    config.pin_d2       = Y4_GPIO_NUM;
    config.pin_d3       = Y5_GPIO_NUM;
    config.pin_d4       = Y6_GPIO_NUM;
    config.pin_d5       = Y7_GPIO_NUM;
    config.pin_d6       = Y8_GPIO_NUM;
    config.pin_d7       = Y9_GPIO_NUM;
    config.pin_xclk     = XCLK_GPIO_NUM;
    config.pin_pclk     = PCLK_GPIO_NUM;
    config.pin_vsync    = VSYNC_GPIO_NUM;
    config.pin_href     = HREF_GPIO_NUM;
    config.pin_sccb_sda = SIOD_GPIO_NUM;
    config.pin_sccb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn     = PWDN_GPIO_NUM;
    config.pin_reset    = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;

    // Lower resolution for faster transfer
    config.frame_size   = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 12;
    config.fb_count     = 1;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("Camera init FAILED: 0x%x\n", err);
        return;
    }

    // Adjust camera settings for meter reading
    sensor_t *s = esp_camera_sensor_get();
    s->set_brightness(s, 1);
    s->set_contrast(s, 1);
    s->set_saturation(s, -1);
    s->set_whitebal(s, 1);

    Serial.println("Camera initialized OK");
}

void captureAndSendImage() {
    Serial.println("Capturing image...");

    // Turn on LED flash
    digitalWrite(LED_PIN, HIGH);
    delay(200);

    camera_fb_t *fb = esp_camera_fb_get();

    digitalWrite(LED_PIN, LOW);

    if (!fb) {
        Serial.println("Camera capture failed!");
        return;
    }

    Serial.printf("Image captured: %d bytes\n", fb->len);

    // Encode to base64
    String base64Image = base64::encode(fb->buf, fb->len);
    esp_camera_fb_return(fb);

    // Build JSON payload
    StaticJsonDocument<256> doc;
    doc["device_id"] = DEVICE_ID;
    doc["image"] = base64Image;
    doc["timestamp"] = millis();

    String payload;
    serializeJson(doc, payload);

    // Publish via MQTT (may need chunking for large images)
    if (mqtt.publish(topicImage, payload.c_str())) {
        Serial.println("Image sent via MQTT");
    } else {
        Serial.println("Image send FAILED (too large?)");
    }
}

// ═══════════════════════════════════════════
// PULSE SENSOR
// ═══════════════════════════════════════════

void sendPulseData() {
    unsigned long currentCount = pulseCount;
    unsigned long delta = currentCount - reportedPulseCount;
    reportedPulseCount = currentCount;

    float kwh = (float)delta / PULSE_PER_KWH;

    StaticJsonDocument<128> doc;
    doc["device_id"] = DEVICE_ID;
    doc["count"] = delta;
    doc["total_count"] = currentCount;
    doc["pulse_per_kwh"] = PULSE_PER_KWH;
    doc["kwh"] = kwh;

    String payload;
    serializeJson(doc, payload);

    if (mqtt.publish(topicPulse, payload.c_str())) {
        Serial.printf("Pulse data sent: %lu pulses (%.4f kWh)\n", delta, kwh);
    }
}

// ═══════════════════════════════════════════
// STATUS HEARTBEAT
// ═══════════════════════════════════════════

void sendStatus() {
    StaticJsonDocument<128> doc;
    doc["device_id"] = DEVICE_ID;
    doc["status"] = "active";
    doc["uptime_ms"] = millis();
    doc["wifi_rssi"] = WiFi.RSSI();
    doc["free_heap"] = ESP.getFreeHeap();
    doc["total_pulses"] = pulseCount;

    String payload;
    serializeJson(doc, payload);

    mqtt.publish(topicStatus, payload.c_str());
}

// ═══════════════════════════════════════════
// CONNECTIVITY
// ═══════════════════════════════════════════

void connectWiFi() {
    Serial.printf("Connecting to WiFi: %s", WIFI_SSID);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && retries < 20) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\nWiFi connected! IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\nWiFi FAILED. Will retry...");
    }
}

void connectMQTT() {
    int retries = 0;
    while (!mqtt.connected() && retries < 5) {
        Serial.printf("Connecting to MQTT %s:%d...\n", MQTT_BROKER, MQTT_PORT);

        bool connected;
        if (strlen(MQTT_USERNAME) > 0) {
            connected = mqtt.connect(DEVICE_ID, MQTT_USERNAME, MQTT_PASSWORD);
        } else {
            connected = mqtt.connect(DEVICE_ID);
        }

        if (connected) {
            Serial.println("MQTT connected!");
            return;
        }

        Serial.printf("MQTT failed (rc=%d). Retrying...\n", mqtt.state());
        delay(WIFI_RETRY_DELAY);
        retries++;
    }
}

// ═══════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════

void blinkLED(int times, int delayMs) {
    for (int i = 0; i < times; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(delayMs);
        digitalWrite(LED_PIN, LOW);
        delay(delayMs);
    }
}
