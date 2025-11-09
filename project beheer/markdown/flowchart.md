flowchart TD
    Start([User Scans RFID Card])
    Start --> ReadRFID[M4 Core: Read RFID via PN532]
    ReadRFID --> SendRPMSG[M4: Send UID via ttyRPMSG0]
    SendRPMSG --> A7Read[A7 Linux: Read from /dev/ttyRPMSG0]
    
    A7Read --> Parse[Parse RFID UID<br/>Remove spaces]
    Parse --> CheckAPI{API Available?}
    
    CheckAPI -->|Yes| SendScan[POST /api/scan<br/>JSON: rfid_uid]
    CheckAPI -->|No - Retry| Wait1[Wait 1s]
    Wait1 --> CheckAPI
    CheckAPI -->|Failed 3x| ShowError[Show Error Screen<br/>3 seconds]
    ShowError --> WaitCard
    
    SendScan --> FlaskAPI[Flask API Server<br/>192.168.11.242:5000]
    FlaskAPI --> QueryDB[(MySQL Database<br/>Check users table)]
    
    QueryDB -->|Not Found| Return404[HTTP 404<br/>Card not registered]
    Return404 --> ShowError
    
    QueryDB -->|Found| CheckAttendance[(Check attendance table<br/>for today)]
    
    CheckAttendance -->|No record<br/>or clocked_out| ClockInPrep[Prepare Clock In<br/>action: clock_in]
    CheckAttendance -->|clocked_in| ClockOutDB[Update attendance<br/>SET clock_out=NOW]
    
    ClockOutDB --> CalcDuration[Calculate work_duration<br/>TIMESTAMPDIFF minutes]
    CalcDuration --> LogClockOut[Insert scan_log<br/>action: clock_out]
    LogClockOut --> Return200Out[HTTP 200<br/>JSON: success, action, user]
    Return200Out --> ShowSuccess[Show Success Screen<br/>Clocked Out!<br/>3 seconds]
    ShowSuccess --> WaitCard
    
    ClockInPrep --> Return200In[HTTP 200<br/>JSON: success, action, user]
    Return200In --> ShowSignature[Show Signature Screen<br/>Welcome user_name!]
    
    ShowSignature --> TouchInput{Touch Input?}
    TouchInput -->|Draw in box| AddStroke[Add stroke to signature]
    AddStroke --> ResetTimer[Reset 30s timeout]
    ResetTimer --> TouchInput
    
    TouchInput -->|Clear button| ClearSig[Clear signature strokes]
    ClearSig --> ResetTimer
    
    TouchInput -->|30s timeout| TimeoutReset[Reset to waiting]
    TimeoutReset --> WaitCard
    
    TouchInput -->|Submit button| SendClockIn[POST /api/clock_in_with_signature<br/>JSON: rfid_uid, signature]
    SendClockIn --> FlaskClockIn[Flask: Insert attendance<br/>clock_in=NOW, status=clocked_in]
    FlaskClockIn --> SaveSig[Save signature to DB/file<br/>Optional]
    SaveSig --> LogClockIn[Insert scan_log<br/>action: clock_in]
    LogClockIn --> ShowSuccessIn[Show Success Screen<br/>Clocked In!<br/>3 seconds]
    ShowSuccessIn --> WaitCard
    
    WaitCard([Wait for Card Screen<br/>Animated circle])
    WaitCard --> Start

    style Start fill:#e1f5ff
    style WaitCard fill:#e1f5ff
    style FlaskAPI fill:#fff4e1
    style QueryDB fill:#f0f0f0
    style CheckAttendance fill:#f0f0f0
    style ShowSignature fill:#e8f5e9
    style ShowSuccess fill:#e8f5e9
    style ShowError fill:#ffebee