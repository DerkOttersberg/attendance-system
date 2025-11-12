# Product Backlog Database Tables

## Table 1: Epics
| epic_id | epic_name | description | priority | status |
|---------|-----------|-------------|----------|--------|
| 1 | Hardware Development | Core hardware components and connectivity | Must | In Progress |
| 2 | User Interface | Display, input, and user interaction | Must | In Progress |
| 3 | Data Management | Database, storage, and data handling | Must | In Progress |
| 4 | System Integration | Server communication and sync | Must | In Progress |
| 5 | Administrative Features | Reporting and management tools | Must | In Progress |
| 6 | Quality & Reliability | Error handling, testing, validation | Should | Not Started |
| 7 | Enhancement Features | Additional functionality and improvements | Could | Not Started |

## Table 2: User Stories 
| story_id | epic_id | title | description | priority | story_points | status |
|:---------|:--------|:--------------------------|:---------------------------------------------------------------------------------------|:----------|:--------------|:--------|
| 1 | 1 | The Hub | System consisting of main hub, sensors, display | Must | 5 | In Progress |
| 2 | 1 | Encasing | Physical encasing for the product | Must | 5 | Not Started |
| 3 | 2 | RFID Check in | Clock in with RFID card for automatic attendance | Must | 3 | DONE |
| 4 | 2 | RFID Check out | Clock out with same RFID card | Must | 1 | DONE |
| 5 | 2 | Touchscreen Signature | Sign in on touchscreen for legal confirmation | Must | 8 | DONE |
| 6 | 3 | Points Awarding | Automatic points assignment to existing website | Must | 4 | Not Started |
| 7 | 3 | Dayparts Calculation | Group attendance into morning/afternoon dayparts | Must | 3 | Not Started |
| 8 | 5 | Attendance Overview | Export attendance records with signatures to PDF | Must | 8 | DONE |
| 9 | 6 | Error Feedback | Visual (LED) and audio (buzzer) feedback for failures | Must | 4 | Not Started |
| 10 | 6 | System Reset | Reset button for device reboot without unplugging | Must | 2 | Not Started |
| 11 | 7 | Hardware Refinement | Custom PCB design for compact, reliable system | Could | 15 | Not Started |
| 12 | 4 | Network Communication | Reliable server communication for time entries | Must | 6 | DONE |
| 13 | 4 | Offline Mode Handling | Clock in/out when network unavailable | Must | 8 | Not Started |
| 14 | 2 | User Status Display | Show user information | Should | 4 | In Progress |
| 15 | 2 | Multi-language Support | Interface in preferred language (Dutch/English) | Could | 3 | Not Started |
| 16 | 4 | Server API Development | Backend endpoints for device communication | Must | 8 | DONE |
| 17 | 3 | Database Schema | Design and implement time tracking database | Must | 5 | DONE |
| 18 | 5 | Admin Web Interface | Web dashboard for attendance management | Must | 10 | DONE |
| 19 | 6 | Security Implementation | Authentication, encryption, secure communication | Must | 6 | Not Started |
| 20 | 6 | Device Configuration | Remote configuration and settings management | Should | 5 | Not Started |
| 21 | 6 | System Monitoring | Health monitoring and alerts for device issues | Should | 4 | Not Started |
| 22 | 7 | Backup & Recovery | Data backup and disaster recovery procedures | Should | 6 | Not Started |
| 23 | 2 | Visual Feedback (Success) | Display a large, personalized success message (e.g., "Welcome, [User Name]! Clocked In.") after successful check-in/out. | Must | 2 | DONE |
| 24 | 2 | GUI Screen Restriction | The GUI must be the only screen available on the device, users can't go into Linux | Must | 4 | Not Started |
| 25 | 2 | User Look-up Interface | As a user without an RFID card, I want a manual touch interface to find and check in/out using my employee ID/name. | Should | 5 | Not Started |
| 26 | 4 | Automatic Reconnect | The device must automatically re-establish connection with the server/database after a network failure is resolved, resuming normal operation. | Must | 3 | DONE |
| 27 | 5 | Admin User Management | The Admin must be able to easily add new users to the GUI | Must | 4 | Not Started |

## Table 3: Tasks (Breakdown of User Stories)
| task_id | story_id | task_description | estimated_hours | status  | dependencies |
|---------|----------|------------------|-----------------|--------|--------------|
| 1 | 1 | Set up STM32 base developing environment | 3 | DONE  | - |
| 2 | 1 | Install Linux on STM32 and verify boot functionality | 5 | DONE  | 1 |
| 3 | 1 | Configure SPI communication between STM32 and touchscreen | 5 | DONE  | 2 |
| 4 | 1 | Write custom drivers for touchscreen SPI data reading | 8 | DONE  | 3 |
| 5 | 1 | Install correct libraries and dependencies for touchscreen | 3 | DONE  | 4 |
| 6 | 1 | Verify touchscreen hardware works (draw test) | 3 | DONE  | 5 |
| 7 | 1 | Research suitable IDE, tools, and programming setup | 2 | DONE  | 1 |
| 8 | 1 | Configure Device Tree for touchscreen functionality | 5 | Not Started  | 2 |
| 9 | 1 | Implement touch signature input in GUI | 5 | DONE  | 6 |
| 10 | 1 | Create GUI to display signature data visually | 3 | DONE  | 9 |
| 11 | 1 | Write basic driver to communicate with RFID module | 5 | DONE  | 2 |
| 12 | 1 | Verify RFID hardware and connection (read tag UID) | 3 | DONE  | 11 |
| 13 | 1 | Connect STM32 (M4 chip) with A7 chip for data forwarding via shared memory | 5 | DONE  | 2 |
| 14 | 2 | Design 3D printed encasing | 8 | Not Started  | - |
| 15 | 2 | Create openable/closable mechanism | 8 | Not Started  | 14 |
| 16 | 2 | Ensure proper part fitting | 6 | Not Started  | 14 |
| 17 | 2 | Design wire management | 4 | Not Started  | 14 |
| 18 | 2 | Plan button placement | 2 | Not Started  | 14 |
| 19 | 2 | Plan display integration | 4 | Not Started  | 14 |
| 20 | 2 | Design RFID reader placement | 3 | Not Started  | 14 |
| 21 | 2 | Create RFID location indicators | 2 | Not Started  | 14 |
| 22 | 2 | Design and 3D print physical encasing | 8 | Not Started  | 21 |
| 23 | 2 | Assemble encasing and fit components securely | 2 | Not Started  | 22 |
| 24 | 3 | Implement clock-in logic using RFID tag | 3 | DONE  | 12 |
| 25 | 3 | Show user feedback (success message) after check-in/out | 2 | DONE  | 24 |
| 26 | 4 | Implement clock-out logic using same RFID tag | 2 | DONE  | 24 |
| 27 | 5 | Setup touchscreen hardware and wiring | 8 | DONE  | 6 |
| 28 | 5 | Research and install Linux touchscreen drivers | 12 | DONE  | 27 |
| 29 | 5 | Configure touchscreen calibration | 4 | DONE  | 28 |
| 30 | 5 | Implement touchscreen input handling | 8 | DONE  | 29 |
| 31 | 5 | Setup signature database | 8 | DONE  | 52 |
| 32 | 5 | Implement signature storage | 8 | DONE  | 31 |
| 33 | 6 | Connect to existing points website database | 12 | Not Started  | 52 |
| 34 | 6 | Implement points assignment logic | 8 | Not Started  | 33 |
| 35 | 6 | Create live data display for website | 10 | DONE  | 34 |
| 36 | 7 | Setup attendance database | 6 | DONE  | 52 |
| 37 | 7 | Implement morning/afternoon split | 8 | Not Started  | 36 |
| 38 | 7 | Link signatures to dayparts | 6 | Not Started  | 37 |
| 39 | 7 | Implement daypart calculation logic | 10 | Not Started  | 38 |
| 40 | 8 | Create PDF generation system | 16 | DONE  | 36 |
| 41 | 8 | Design attendance report template | 8 | In Progress  | - |
| 42 | 8 | Implement signature embedding in PDF | 8 | DONE  | 40 |
| 43 | 8 | Create PDF export of attendance data with signatures | 5 | DONE  | 42 |
| 44 | 9 | Implement LED indicator system | 4 | Not Started  | 1 |
| 45 | 9 | Add buzzer success feedback | 3 | Not Started  | 1 |
| 46 | 9 | Implement visual LED feedback for system status | 3 | Not Started  | 44 |
| 47 | 9 | Implement buzzer feedback for errors | 2 | Not Started  | 45 |
| 48 | 10 | Install and wire reset button | 2 | Not Started  | 1 |
| 49 | 10 | Implement reset functionality | 4 | Not Started  | 48 |
| 50 | 10 | Add system reset button for safe reboot | 2 | Not Started  | 49 |
| 51 | 11 | Research standalone microcontroller requirements | 16 | Not Started  | - |
| 52 | 11 | Create PCB schematic | 20 | Not Started  | 51 |
| 53 | 11 | Design PCB layout | 16 | Not Started  | 52 |
| 54 | 11 | Order and test PCB | 12 | Not Started  | 53 |
| 55 | 12 | Implement WiFi connectivity | 12 | Not Started  | 2 |
| 56 | 12 | Create HTTP/HTTPS communication | 10 | Not Started  | 55 |
| 57 | 12 | Implement network error handling | 8 | Not Started  | 56 |
| 58 | 12 | Add SSL certificate handling | 6 | Not Started  | 56 |
| 59 | 13 | Create local storage system | 12 | Not Started  | 2 |
| 60 | 13 | Implement queue management | 8 | Not Started  | 59 |
| 61 | 13 | Add automatic sync functionality | 10 | Not Started  | 60 |
| 62 | 13 | Create offline mode indicator | 4 | Not Started  | 59 |
| 63 | 13 | Implement offline clock-in/out with queueing | 5 | Not Started  | 61 |
| 64 | 14 | Develop GUI that integrates RFID data and display | 5 | DONE  | 12 |
| 65 | 14 | Display live user status on touchscreen | 4 | Not Started  | 64 |
| 66 | 15 | Add multi-language interface (Dutch/English) | 3 | Not Started  | 64 |
| 67 | 16 | Design API endpoints | 12 | DONE | 52 |
| 68 | 16 | Implement user validation | 8 | DONE | 67 |
| 69 | 16 | Create clock in/out logic | 12 | DONE | 68 |
| 70 | 16 | Add signature processing | 6 | DONE | 69 |
| 71 | 16 | Implement simple API for RFID data submission | 5 | Not Started  | 67 |
| 72 | 17 | Design database schema | 8 | DONE  | - |
| 73 | 17 | Create database tables | 4 | DONE | 72 |
| 74 | 17 | Setup database indexes | 3 | DONE | 73 |
| 75 | 17 | Implement data validation | 6 | Not Started  | 73 |
| 76 | 17 | Create database schema for time tracking | 3 | Not Started  | 72 |
| 77 | 17 | Store RFID check-in/out events in database | 3 | Not Started  | 76 |
| 78 | 18 | Develop admin dashboard for overview of check-ins | 5 | Not Started  | 77 |
| 79 | 19 | Setup security for the dashboard, database | 6 | Not Started  | 78 |
| 80 | 20 | Allow remote configuration of device settings | 4 | Not Started  | 56 |
| 81 | 21 | Add health monitoring for device connection | 3 | Not Started  | 56 |
| 82 | 22 | Backup and recovery system for attendance data | 4 | Not Started  | 77 |
| 83 | 23 | Implement personalized success message display | 2 | Not Started  | 64 |
| 84 | 24 | Configure GUI as only available screen (restrict Linux access) | 3 | Not Started  | 64 |
| 85 | 25 | Add ability to manually check in/out via name or ID | 4 | Not Started  | 64 |
| 86 | 26 | Implement automatic reconnect after network failure | 3 | Not Started  | 61 |
| 87 | 26 | Set up communication between STM32 and local database | 5 | Not Started  | 13 |
| 88 | 27 | The Admin must be able to easily add new users to the GUI | 3 | Not Started  | 78 |
| 89 | 1 | Develop error logging for hardware and server communication | 3 | Not Started  | 56 |
| 90 | 6 | Points must automatically be assigned to the Users based on their attendance, in the points website | 4 | Not Started  | 35 |
| 91 | 16 | Test entire flow: RFID → Database → Display feedback | 5 | Not Started  | 69 |
| 92 | 18 | Finalize documentation of setup, drivers, and dataflow | 3 | Not Started  | 91 |

## Table 4: Acceptance Criteria
| criteria_id | story_id | criteria_description | test_method |
|-------------|----------|---------------------|-------------|
| 1 | 3 | RFID card successfully communicates with microcontroller | Manual Test |
| 2 | 3 | Client data is correctly parsed and stored | Unit Test |
| 3 | 3 | Clock-in time is accurately recorded | Integration Test |
| 4 | 4 | Same RFID card triggers clock-out when user is clocked in | Manual Test |
| 5 | 4 | End time is correctly set and stored | Unit Test |
| 6 | 5 | Touchscreen accepts signature input | Manual Test |
| 7 | 5 | Touchscreen drivers are properly installed in Linux | Manual Test |
| 8 | 5 | Touchscreen calibration is accurate | Manual Test |
| 9 | 5 | Touch coordinates are correctly mapped | Unit Test |
| 10 | 5 | Signatures are stored in database | Integration Test |
| 11 | 5 | Signature data is retrievable and displayable | Unit Test |
| 12 | 9 | LED lights up when RFID card is detected | Manual Test |
| 13 | 9 | Buzzer sounds on successful clock-in | Manual Test |
| 14 | 9 | Different feedback for successful vs failed operations | Manual Test |
| 15 | 12 | Device connects to WiFi network | Manual Test |
| 16 | 12 | HTTP requests successfully sent to server | Integration Test |
| 17 | 12 | Network errors are handled gracefully | Unit Test |
| 18 | 13 | Clock-in/out works without network connection | Manual Test |
| 19 | 13 | Offline entries sync when connection restored | Integration Test |
| 20 | 13 | User is notified of offline mode | Manual Test |
| 21 | 24 | Users cannot access Linux interface from device | Manual Test |
| 22 | 24 | GUI remains the only accessible interface after reboot | Manual Test |
| 23 | 25 | Users can search and find themselves by name or ID | Manual Test |
| 24 | 25 | Manual check-in/out records correctly in database | Integration Test |
| 25 | 26 | Device automatically reconnects after network restoration | Manual Test |
| 26 | 26 | Queued data syncs successfully after reconnection | Integration Test |
| 27 | 27 | Admin can add new users through web interface | Manual Test |
| 28 | 27 | New users appear immediately in device GUI | Integration Test |

## Table 5: Dependencies
| dependency_id | story_id | depends_on_story_id | dependency_type | notes |
|---------------|----------|---------------------|-----------------|-------|
| 1 | 5 | 17 | Technical | Signature storage requires database |
| 2 | 6 | 17 | Technical | Points system needs database schema |
| 3 | 7 | 17 | Technical | Dayparts calculation requires database |
| 4 | 8 | 7 | Functional | PDF export needs dayparts data |
| 5 | 8 | 5 | Functional | PDF export needs signatures |
| 6 | 12 | 1 | Technical | Network requires hardware foundation |
| 7 | 13 | 12 | Technical | Offline mode builds on network functionality |
| 8 | 16 | 17 | Technical | API needs database structure |
| 9 | 18 | 16 | Technical | Admin interface needs API |
| 10 | 19 | 12 | Technical | Security requires network communication |
| 11 | 5 | 1 | Technical | Touchscreen needs hardware foundation |
| 12 | 24 | 14 | Technical | GUI restriction needs user status display |
| 13 | 25 | 14 | Technical | Manual lookup needs display system |
| 14 | 26 | 13 | Technical | Auto-reconnect builds on offline mode |
| 15 | 27 | 18 | Technical | User management needs admin interface |

## Table 6: Risk Assessment
| risk_id | story_id | risk_description | probability | impact | mitigation_strategy |
|---------|----------|------------------|-------------|--------|-------------------|
| 1 | 1 | Microcontroller shortage or compatibility issues | Medium | High | Research multiple options, order early |
| 2 | 12 | WiFi connectivity reliability in industrial environment | High | Medium | Implement robust retry logic and offline mode |
| 3 | 5 | Touchscreen signature quality for legal requirements | Medium | High | Test with legal team, implement validation |
| 4 | 5 | Linux touchscreen drivers compatibility issues | Medium | Medium | Research multiple touchscreen options, test drivers early |
| 5 | 11 | Custom PCB manufacturing delays | Medium | Medium | Plan for longer lead times, have backup plan |
| 6 | 6 | Integration with existing website database | High | Medium | Early prototyping and testing with existing system |
| 7 | 19 | Security vulnerabilities in device communication | Low | High | Security audit and penetration testing |
| 8 | 2 | Encasing design may not fit all components | Medium | Medium | Create detailed measurements early, prototype |
| 9 | 24 | Users may attempt to access Linux shell | Medium | Medium | Implement proper kiosk mode and access restrictions |
| 10 | 26 | Network reconnection may fail or cause data loss | Medium | High | Implement robust queue management and retry logic |