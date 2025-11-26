#ifndef RFID_READER_H
#define RFID_READER_H

#include <string>
#include <fcntl.h>
#include <unistd.h>
#include <termios.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>

#define RFID_DEV_PATH "/dev/ttyRPMSG0"

struct RFIDData {
    std::string uid;
    std::string card_type;
    std::string sak;
    bool auth_failed;
    bool valid;
    
    RFIDData() : auth_failed(false), valid(false) {}
    
    void Reset() {
        uid.clear();
        card_type.clear();
        sak.clear();
        auth_failed = false;
        valid = false;
    }
};

class RFIDReader {
private:
    int fd;
    std::string buffer;
    RFIDData current_data;
    bool in_card_block;
    
    void ParseLine(const std::string& line) {
        size_t start = line.find_first_not_of(" \t\r\n");
        size_t end = line.find_last_not_of(" \t\r\n");
        if (start == std::string::npos) return;
        
        std::string trimmed = line.substr(start, end - start + 1);
        
        if (trimmed == "=== Card Detected ===") {
            in_card_block = true;
            current_data.Reset();
        }
        else if (trimmed == "=== End ===") {
            if (in_card_block && !current_data.uid.empty()) {
                current_data.valid = true;
            }
            in_card_block = false;
        }
        else if (in_card_block) {
            if (trimmed.find("Card UID:") == 0) {
                current_data.uid = trimmed.substr(10);
            }
            else if (trimmed.find("Card Type:") == 0) {
                current_data.card_type = trimmed.substr(11);
            }
            else if (trimmed.find("SAK:") == 0) {
                current_data.sak = trimmed.substr(5);
            }
            else if (trimmed.find("Authentication failed!") == 0) {
                current_data.auth_failed = true;
            }
        }
    }
    
public:
    RFIDReader() : fd(-1), in_card_block(false) {}
    
    bool Open() {
        if (fd >= 0) return true;
        
        // Open with O_RDWR to allow both reading and writing
        fd = open(RFID_DEV_PATH, O_RDWR | O_NONBLOCK | O_NOCTTY);
        if (fd < 0) {
            fprintf(stderr, "⚠️ Failed to open %s: %s\n", RFID_DEV_PATH, strerror(errno));
            return false;
        }
        
        struct termios tty;
        if (tcgetattr(fd, &tty) == 0) {
            cfmakeraw(&tty);
            tty.c_cc[VMIN] = 0;
            tty.c_cc[VTIME] = 0;
            tcsetattr(fd, TCSANOW, &tty);
        }
        
        printf("✅ RFID reader ready\n");
        return true;
    }
    
    void Close() {
        if (fd >= 0) {
            close(fd);
            fd = -1;
        }
    }
    
    // Send a command to the M4 core
    bool SendCommand(const std::string& command) {
        if (fd < 0) {
            if (!Open()) {
                fprintf(stderr, "⚠️ Cannot send command: device not open\n");
                return false;
            }
        }
        
        // Add newline if not present
        std::string cmd = command;
        if (cmd.empty() || cmd.back() != '\n') {
            cmd += "\n";
        }
        
        ssize_t bytes_written = write(fd, cmd.c_str(), cmd.length());
        
        if (bytes_written < 0) {
            fprintf(stderr, "⚠️ Failed to send command: %s\n", strerror(errno));
            return false;
        }
        
        if ((size_t)bytes_written != cmd.length()) {
            fprintf(stderr, "⚠️ Incomplete write: %zd/%zu bytes\n", bytes_written, cmd.length());
            return false;
        }
        
        return true;
    }
    
    // Convenience functions for specific commands
    bool SendBuzzCommand() {
        return SendCommand("buzz");
    }
    
    bool SendScanCommand() {
        return SendCommand("scan");
    }
    
    bool SendStatusCommand() {
        return SendCommand("status");
    }
    
    bool SendReadBlockCommand(int blockNum) {
        char cmd[32];
        snprintf(cmd, sizeof(cmd), "read:%d", blockNum);
        return SendCommand(cmd);
    }
    
    bool SendWriteBlockCommand(int blockNum, const std::string& data) {
        std::string cmd = "write:" + std::to_string(blockNum) + ":" + data;
        return SendCommand(cmd);
    }
    
    RFIDData Poll() {
        RFIDData result;
        
        if (fd < 0) {
            if (!Open()) return result;
        }
        
        char read_buf[256];
        ssize_t bytes_read = read(fd, read_buf, sizeof(read_buf) - 1);
        
        if (bytes_read > 0) {
            read_buf[bytes_read] = '\0';
            buffer += read_buf;
            
            size_t pos;
            while ((pos = buffer.find('\n')) != std::string::npos) {
                std::string line = buffer.substr(0, pos);
                buffer.erase(0, pos + 1);
                ParseLine(line);
            }
            
            if (current_data.valid) {
                result = current_data;
                current_data.Reset();
            }
        }
        
        return result;
    }
};

#endif