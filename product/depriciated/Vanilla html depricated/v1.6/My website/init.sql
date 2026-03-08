-- Database schema for RFID clock-in/out system

CREATE DATABASE IF NOT EXISTS rfid_attendance;
USE rfid_attendance;

-- Grant privileges to rfid_user on the database (recreate user to ensure correct password)
DROP USER IF EXISTS 'rfid_user'@'%';
DROP USER IF EXISTS 'rfid_user'@'localhost';
CREATE USER 'rfid_user'@'%' IDENTIFIED BY 'rfid_pass';
CREATE USER 'rfid_user'@'localhost' IDENTIFIED BY 'rfid_pass';
GRANT ALL PRIVILEGES ON rfid_attendance.* TO 'rfid_user'@'%';
GRANT ALL PRIVILEGES ON rfid_attendance.* TO 'rfid_user'@'localhost';
FLUSH PRIVILEGES;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfid_uid VARCHAR(32) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    department VARCHAR(50),
    product VARCHAR(50),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rfid (rfid_uid)
);

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    clock_in TIMESTAMP NOT NULL,
    clock_out TIMESTAMP NULL,
    work_duration INT NULL COMMENT 'Duration in minutes',
    date DATE NOT NULL,
    status ENUM('clocked_in', 'clocked_out') DEFAULT 'clocked_in',
    notes TEXT,
    signature_data MEDIUMTEXT NULL COMMENT 'SVG signature data',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_date (user_id, date),
    INDEX idx_date (date),
    INDEX idx_status (status)
);

-- Audit log for all RFID scans
CREATE TABLE IF NOT EXISTS scan_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfid_uid VARCHAR(32) NOT NULL,
    scan_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(50),  -- INCREASED FROM 20 TO 50
    success BOOLEAN,
    message TEXT,
    INDEX idx_rfid_time (rfid_uid, scan_time)
);

-- Sample data (only insert if not exists)
INSERT IGNORE INTO users (rfid_uid, name, email, department) VALUES
('8144EE19', 'Jamey Lee Stone', 'john.doe@company.com', 'WMO'),
('11F3EF12', 'Derk Ottersberg', 'jane.smith@company.com', 'Marketing'),
('53C991A6', 'Bob Wilson', 'bob.wilson@company.com', 'Engineering'),
('12A7F9B1', 'Silas', 'silas@company.com', 'Engineering'),
('14C2E8F5', 'Vincent', 'vincent@company.com', 'Engineering'),
('15B6A1E3', 'Tobias', 'tobias@company.com', 'IT'),
('16D9E2C7', 'Karkau', 'karkau@company.com', 'IT'),
('17F4B3A2', 'Bryan', 'bryan@company.com', 'Sales'),
('18E1C4D9', 'Bas', 'bas@company.com', 'Finance'),
('19A5E6F8', 'Lisa', 'lisa@company.com', 'HR'),
('20C7B2D1', 'Melvin', 'melvin@company.com', 'Engineering'),
('21D8E3F9', 'Michael', 'michael@company.com', 'IT'),
('22A9C4B5', 'Niek', 'niek@company.com', 'Engineering'),
('23B7E5D3', 'Patrick', 'patrick@company.com', 'Marketing'),
('24F2A8E6', 'Martin', 'martin@company.com', 'Operations'),
('25E6D7B1', 'Bryan Brugman', 'bryan.brugman@company.com', 'Sales'),
('26A4C9E3', 'Patrick Houtsma', 'patrick.houtsma@company.com', 'Engineering'),
('27B5F8A2', 'Sebastien', 'sebastien@company.com', 'Design'),
('28D3C6E9', 'Elwin L', 'elwin.l@company.com', 'IT'),
('29E9F7C4', 'Melvin Z', 'melvin.z@company.com', 'Engineering'),
('30C1A2B5', 'Gerrit', 'gerrit@company.com', 'Engineering'),
('31F8E2D7', 'George', 'george@company.com', 'Engineering'),
('32D6A5F3', 'Marijn', 'marijn@company.com', 'Marketing'),
('33A7C8E2', 'Nikki', 'nikki@company.com', 'HR'),
('34B9D5F1', 'Roel', 'roel@company.com', 'Engineering'),
('35E2C4A8', 'Rowin', 'rowin@company.com', 'IT'),
('36F7D9E5', 'Jaimy', 'jaimy@company.com', 'Engineering'),
('37A1B6C9', 'Niels', 'niels@company.com', 'Finance'),
('38E5D2F3', 'Alwin', 'alwin@company.com', 'IT'),
('39B8C7D4', 'Jordy Jongmans', 'jordy.jongmans@company.com', 'Engineering'),
('40C9A5E1', 'Yorick', 'yorick@company.com', 'Marketing'),
('41D2B8F6', 'Jelle', 'jelle@company.com', 'Engineering');


-- View for current status
CREATE OR REPLACE VIEW current_status AS
SELECT 
    u.id,
    u.name,
    u.rfid_uid,
    a.clock_in,
    a.clock_out,
    a.status,
    CASE 
        WHEN a.status = 'clocked_in' THEN TIMESTAMPDIFF(MINUTE, a.clock_in, NOW())
        ELSE a.work_duration
    END as minutes_worked
FROM users u
LEFT JOIN attendance a ON u.id = a.user_id 
    AND a.date = CURDATE()
WHERE u.active = TRUE;

-- Floorplan layout storage (shared across all users)
CREATE TABLE IF NOT EXISTS floorplan_layout (
    id INT PRIMARY KEY,
    data LONGTEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO floorplan_layout (id, data) VALUES (1, '{}');