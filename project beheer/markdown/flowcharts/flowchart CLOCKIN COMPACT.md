# RFID Attendance System

## System Flow
```mermaid
flowchart LR
    A[👤 Scan RFID] --> B[M4: Read Card]
    B --> C[Send via RPMSG]
    C --> D[A7: Parse UID]
    D --> E{API Check}
    E -->|Fail| F[❌ Error]
    E -->|OK| G{User Exists?}
    G -->|No| F
    G -->|Yes| H{Status?}
    
    H -->|Already In| I[Clock Out]
    I --> J[Update DB]
    J --> K[✅ Success]
    
    H -->|Out/New| L[✏️ Signature]
    L --> M{Action?}
    M -->|Timeout| A
    M -->|Clear| L
    M -->|Submit| N[Clock In]
    N --> O[Save to DB]
    O --> K
    
    K --> A
    F --> A
    
    style A fill:#e1f5ff
    style F fill:#ffebee
    style K fill:#e8f5e9
    style L fill:#fff9c4
