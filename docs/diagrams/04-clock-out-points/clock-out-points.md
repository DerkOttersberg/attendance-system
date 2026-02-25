sequenceDiagram
  participant User
  participant RFID as RFID Scanner
  participant M4 as M4 Firmware
  participant A7 as A7 ImGui App
  participant API as Flask API
  participant DB as MySQL
  participant Target as Target Website API
  
  User->>RFID: Holds card in front of scanner
  
  loop RFID Poll (100ms)
    M4->>RFID: ExecuteScanOnce()
    RFID-->>M4: No card / Invalid read
  end
  
  RFID-->>M4: Card detected (UID)
  M4->>A7: "=== Card Detected ===\nUID..."
  A7->>API: POST /api/scan {rfid_uid}
  API->>DB: SELECT today's attendance
  DB-->>API: last record (clocked_in)
  API->>DB: UPDATE clock_out + duration
  DB-->>API: OK (work_duration)
  API->>Target: POST /api/updatePunten {id, name, punten}
  Target-->>API: 200 OK
  API-->>A7: action=clock_out + message
  A7->>M4: "beep"/"red_off"/"green_on"
  A7->>User: Display goodbye screen