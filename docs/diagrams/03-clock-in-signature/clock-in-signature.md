sequenceDiagram
  participant User
  participant RFID as RFID Scanner
  participant M4 as M4 Firmware
  participant A7 as A7 ImGui App
  participant API as Flask API
  participant DB as MySQL
  
  User->>RFID: Holds card in front of scanner
  
  loop RFID Poll (100ms)
    M4->>RFID: ExecuteScanOnce()
    RFID-->>M4: No card / Invalid read
  end
  
  RFID-->>M4: Card detected (UID)
  M4->>A7: "=== Card Detected ===\nUID..."
  A7->>API: POST /api/scan {rfid_uid}
  API->>DB: SELECT user + today's attendance
  DB-->>API: user + last status
  API-->>A7: action=clock_in + user
  A7->>User: Display signature screen
  A7->>M4: "beep"/"red_on"/"green_off"
  User->>A7: Draws signature
  A7->>API: POST /api/clock_in_with_signature {rfid_uid, signature}
  API->>DB: INSERT attendance + log_scan
  DB-->>API: OK
  API-->>A7: success
  A7->>M4: "beep"/"red_off"/"green_on"
  A7->>User: Display success screen