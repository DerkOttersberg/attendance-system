# Product Backlog Database Tables

## Table 1: Epics
| epic_id | epic_name | description | priority | status |
|---------|-----------|-------------|----------|--------|
| 1 | Hardware Development | Core hardware components and connectivity | Must | In Progress |
| 2 | User Interface | Display, input, and user interaction | Must | Not Started |
| 3 | Data Management | Database, storage, and data handling | Must | Not Started |
| 4 | System Integration | Server communication and sync | Must | Not Started |
| 5 | Administrative Features | Reporting and management tools | Must | Not Started |
| 6 | Quality & Reliability | Error handling, testing, validation | Should | Not Started |
| 7 | Enhancement Features | Additional functionality and improvements | Could | Not Started |

## Table 2: User Stories
| story_id | epic_id | title | description | priority | story_points | status | sprint |
|----------|---------|-------|-------------|----------|--------------|--------|--------|
| 1 | 1 | The Hub | System consisting of main hub, sensors, display | Must | 5 | In Progress | 1 |
| 2 | 1 | Encasing | Physical encasing for the product | Must | 5 | Not Started | 2 |
| 3 | 2 | RFID Check in | Clock in with RFID card for automatic attendance | Must | 3 | Not Started | 1 |
| 4 | 2 | RFID Check out | Clock out with same RFID card | Must | 1 | Not Started | 1 |
| 5 | 2 | Touchscreen Signature | Sign in on touchscreen for legal confirmation | Must | 5 | Not Started | 2 |
| 6 | 3 | Points Awarding | Automatic points assignment to existing website | Must | 4 | Not Started | 3 |
| 7 | 3 | Dayparts Calculation | Group attendance into morning/afternoon dayparts | Must | 3 | Not Started | 3 |
| 8 | 5 | Attendance Overview | Export attendance records with signatures to PDF | Must | 8 | Not Started | 4 |
| 9 | 6 | Error Feedback | Visual (LED) and audio (buzzer) feedback for failures | Must | 4 | Not Started | 2 |
| 10 | 6 | System Reset | Reset button for device reboot without unplugging | Must | 2 | Not Started | 2 |
| 11 | 7 | Hardware Refinement | Custom PCB design for compact, reliable system | Should | 15 | Not Started | 5 |
| 12 | 4 | Network Communication | Reliable server communication for time entries | Must | 6 | Not Started | 2 |
| 13 | 4 | Offline Mode Handling | Clock in/out when network unavailable | Must | 8 | Not Started | 3 |
| 14 | 2 | User Status Display | Show current clock status and user information | Should | 4 | Not Started | 3 |
| 15 | 2 | Multi-language Support | Interface in preferred language (Dutch/English) | Could | 3 | Not Started | 4 |
| 16 | 6 | Accessibility Features | High contrast, audio prompts for disabled users | Should | 5 | Not Started | 4 |
| 17 | 4 | Server API Development | Backend endpoints for device communication | Must | 8 | Not Started | 2 |
| 18 | 3 | Database Schema | Design and implement time tracking database | Must | 5 | Not Started | 1 |
| 19 | 5 | Admin Web Interface | Web dashboard for attendance management | Must | 10 | Not Started | 4 |
| 20 | 6 | Security Implementation | Authentication, encryption, secure communication | Must | 6 | Not Started | 3 |
| 21 | 6 | Device Configuration | Remote configuration and settings management | Should | 5 | Not Started | 4 |
| 22 | 6 | System Monitoring | Health monitoring and alerts for device issues | Should | 4 | Not Started | 5 |
| 23 | 7 | Backup & Recovery | Data backup and disaster recovery procedures | Should | 6 | Not Started | 5 |

## Table 3: Tasks (Breakdown of User Stories)
| task_id | story_id | task_description | estimated_hours | status | assignee | dependencies |
|---------|----------|------------------|-----------------|--------|----------|--------------|
| 1 | 1 | Research microcontroller options | 8 | In Progress | Developer | - |
| 2 | 1 | Research compatible parts | 4 | Not Started | Developer | 1 |
| 3 | 1 | Start development on devboard | 16 | Not Started | Developer | 2 |
| 4 | 2 | Design 3D printed encasing | 12 | Not Started | Designer | - |
| 5 | 2 | Create openable/closable mechanism | 8 | Not Started | Designer | 4 |
| 6 | 2 | Ensure proper part fitting | 6 | Not Started | Designer | 4 |
| 7 | 2 | Design wire management | 4 | Not Started | Designer | 4 |
| 8 | 2 | Plan button placement | 2 | Not Started | Designer | 4 |
| 9 | 2 | Plan display integration | 4 | Not Started | Designer | 4 |
| 10 | 2 | Design RFID reader placement | 3 | Not Started | Designer | 4 |
| 11 | 2 | Create RFID location indicators | 2 | Not Started | Designer | 4 |
| 12 | 3 | Implement RFID-microcontroller communication | 12 | Not Started | Developer | 3 |
| 13 | 3 | Parse RFID client data | 6 | Not Started | Developer | 12 |
| 14 | 3 | Implement time locking mechanism | 4 | Not Started | Developer | 13 |
| 15 | 4 | Implement RFID checkout communication | 6 | Not Started | Developer | 12 |
| 16 | 4 | Set end time functionality | 4 | Not Started | Developer | 15 |
| 17 | 5 | Setup signature database | 8 | Not Started | Developer | 18 |
| 18 | 5 | Implement signature storage | 8 | Not Started | Developer | 17 |
| 19 | 6 | Connect to existing website database | 12 | Not Started | Developer | 18 |
| 20 | 6 | Implement points assignment logic | 8 | Not Started | Developer | 19 |
| 21 | 6 | Create live data display for website | 10 | Not Started | Developer | 20 |
| 22 | 7 | Setup attendance database | 6 | Not Started | Developer | 18 |
| 23 | 7 | Implement morning/afternoon split | 8 | Not Started | Developer | 22 |
| 24 | 7 | Link signatures to dayparts | 6 | Not Started | Developer | 23 |
| 25 | 7 | Implement daypart calculation logic | 10 | Not Started | Developer | 24 |
| 26 | 8 | Create PDF generation system | 16 | Not Started | Developer | 22 |
| 27 | 8 | Design attendance report template | 8 | Not Started | Designer | - |
| 28 | 8 | Implement signature embedding in PDF | 8 | Not Started | Developer | 26 |
| 29 | 9 | Implement LED indicator system | 4 | Not Started | Developer | 3 |
| 30 | 9 | Add buzzer success feedback | 3 | Not Started | Developer | 3 |
| 31 | 10 | Install and wire reset button | 2 | Not Started | Developer | 3 |
| 32 | 10 | Implement reset functionality | 4 | Not Started | Developer | 31 |
| 33 | 11 | Research standalone microcontroller requirements | 16 | Not Started | Developer | - |
| 34 | 11 | Create PCB schematic | 20 | Not Started | Developer | 33 |
| 35 | 11 | Design PCB layout | 16 | Not Started | Developer | 34 |
| 36 | 11 | Order and test PCB | 12 | Not Started | Developer | 35 |
| 37 | 12 | Implement WiFi connectivity | 12 | Not Started | Developer | 3 |
| 38 | 12 | Create HTTP/HTTPS communication | 10 | Not Started | Developer | 37 |
| 39 | 12 | Implement network error handling | 8 | Not Started | Developer | 38 |
| 40 | 12 | Add SSL certificate handling | 6 | Not Started | Developer | 38 |
| 41 | 13 | Create local storage system | 12 | Not Started | Developer | 3 |
| 42 | 13 | Implement queue management | 8 | Not Started | Developer | 41 |
| 43 | 13 | Add automatic sync functionality | 10 | Not Started | Developer | 42 |
| 44 | 13 | Create offline mode indicator | 4 | Not Started | Developer | 41 |
| 45 | 17 | Design API endpoints | 12 | Not Started | Backend Dev | 18 |
| 46 | 17 | Implement user validation | 8 | Not Started | Backend Dev | 45 |
| 47 | 17 | Create clock in/out logic | 12 | Not Started | Backend Dev | 46 |
| 48 | 17 | Add signature processing | 6 | Not Started | Backend Dev | 47 |
| 49 | 18 | Design database schema | 8 | Not Started | Backend Dev | - |
| 50 | 18 | Create database tables | 4 | Not Started | Backend Dev | 49 |
| 51 | 18 | Setup database indexes | 3 | Not Started | Backend Dev | 50 |
| 52 | 18 | Implement data validation | 6 | Not Started | Backend Dev | 50 |

## Table 4: Acceptance Criteria
| criteria_id | story_id | criteria_description | test_method |
|-------------|----------|---------------------|-------------|
| 1 | 3 | RFID card successfully communicates with microcontroller | Manual Test |
| 2 | 3 | Client data is correctly parsed and stored | Unit Test |
| 3 | 3 | Clock-in time is accurately recorded | Integration Test |
| 4 | 4 | Same RFID card triggers clock-out when user is clocked in | Manual Test |
| 5 | 4 | End time is correctly set and stored | Unit Test |
| 6 | 5 | Touchscreen accepts signature input | Manual Test |
| 7 | 5 | Signatures are stored in database | Integration Test |
| 8 | 5 | Signature data is retrievable and displayable | Unit Test |
| 9 | 9 | LED lights up when RFID card is detected | Manual Test |
| 10 | 9 | Buzzer sounds on successful clock-in | Manual Test |
| 11 | 9 | Different feedback for successful vs failed operations | Manual Test |
| 12 | 12 | Device connects to WiFi network | Manual Test |
| 13 | 12 | HTTP requests successfully sent to server | Integration Test |
| 14 | 12 | Network errors are handled gracefully | Unit Test |
| 15 | 13 | Clock-in/out works without network connection | Manual Test |
| 16 | 13 | Offline entries sync when connection restored | Integration Test |
| 17 | 13 | User is notified of offline mode | Manual Test |

## Table 5: Sprint Planning
| sprint_id | sprint_name | start_date | end_date | story_ids | total_points |
|-----------|-------------|------------|----------|-----------|--------------|
| 1 | Hardware Foundation | 2024-01-01 | 2024-01-14 | 1, 3, 4, 18 | 14 |
| 2 | Core Functionality | 2024-01-15 | 2024-01-28 | 2, 5, 9, 10, 12, 17 | 29 |
| 3 | Data Processing | 2024-01-29 | 2024-02-11 | 6, 7, 13, 14, 20 | 28 |
| 4 | Admin Features | 2024-02-12 | 2024-02-25 | 8, 15, 16, 19, 21 | 30 |
| 5 | Polish & Refinement | 2024-02-26 | 2024-03-11 | 11, 22, 23 | 25 |

## Table 6: Dependencies
| dependency_id | story_id | depends_on_story_id | dependency_type | notes |
|---------------|----------|---------------------|-----------------|-------|
| 1 | 5 | 18 | Technical | Signature storage requires database |
| 2 | 6 | 18 | Technical | Points system needs database schema |
| 3 | 7 | 18 | Technical | Dayparts calculation requires database |
| 4 | 8 | 7 | Functional | PDF export needs dayparts data |
| 5 | 8 | 5 | Functional | PDF export needs signatures |
| 6 | 12 | 1 | Technical | Network requires hardware foundation |
| 7 | 13 | 12 | Technical | Offline mode builds on network functionality |
| 8 | 17 | 18 | Technical | API needs database structure |
| 9 | 19 | 17 | Technical | Admin interface needs API |
| 10 | 20 | 12 | Technical | Security requires network communication |

## Table 7: Risk Assessment
| risk_id | story_id | risk_description | probability | impact | mitigation_strategy |
|---------|----------|------------------|-------------|--------|-------------------|
| 1 | 1 | Microcontroller shortage or compatibility issues | Medium | High | Research multiple options, order early |
| 2 | 12 | WiFi connectivity reliability in industrial environment | High | Medium | Implement robust retry logic and offline mode |
| 3 | 5 | Touchscreen signature quality for legal requirements | Medium | High | Test with legal team, implement validation |
| 4 | 11 | Custom PCB manufacturing delays | Medium | Medium | Plan for longer lead times, have backup plan |
| 5 | 6 | Integration with existing website database | High | Medium | Early prototyping and testing with existing system |
| 6 | 20 | Security vulnerabilities in device communication | Low | High | Security audit and penetration testing |
| 7 | 2 | Encasing design may not fit all components | Medium | Medium | Create detailed measurements early, prototype |