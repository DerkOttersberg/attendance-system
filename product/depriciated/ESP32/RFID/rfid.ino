#include <SPI.h>
#include <MFRC522.h>

#define SS_PIN D2
#define RST_PIN D1

MFRC522 mfrc522(SS_PIN, RST_PIN);  

void setup() {
  Serial.begin(115200);
  SPI.begin();           
  mfrc522.PCD_Init();   
  Serial.println("Scan an RFID tag...");
}

void loop() {

  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }

  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  Serial.print("Tag UID: ");
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    Serial.print(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
    Serial.print(mfrc522.uid.uidByte[i], HEX);
    Serial.print(" ");
  }
  Serial.println();
  mfrc522.PICC_HaltA();
}
