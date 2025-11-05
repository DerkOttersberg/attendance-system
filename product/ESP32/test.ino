#include <SPI.h>
#include <XPT2046_Touchscreen.h>

// Pin definitions
#define CS_PIN 5    // TCS from TFT
#define TIRQ_PIN 4  // Touch IRQ from TFT

// Initialize touchscreen
XPT2046_Touchscreen ts(CS_PIN, TIRQ_PIN);

void setup() {
  Serial.begin(921600);
  SPI.begin(18, 19, 23, CS_PIN); // SCK, MISO, MOSI, CS

  ts.begin();
  ts.setRotation(1); // Adjust to match your screen orientation

  Serial.println("Touchscreen test ready");
}

void loop() {
  if (ts.touched()) {
    TS_Point p = ts.getPoint();
    Serial.print("X: "); Serial.print(p.x);
    Serial.print("\tY: "); Serial.println(p.y);
  }
  //delay(0.1);
}
