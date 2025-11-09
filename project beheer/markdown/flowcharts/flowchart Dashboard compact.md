
# RFID Attendance System

## System Flow
```mermaid
graph LR
    subgraph Frontend/App
        A[User Request] --> B(API Endpoint);
    end

    B --> C{Database Access};

    subgraph Backend/Database Layer
        C --> D[SQL: SELECT * FROM Table];
        D --> E[Raw Result Set];
    end

    E --> F(Filter Records);
    F --> G(Sort/Order Data);
    G --> H[Return Final Data];