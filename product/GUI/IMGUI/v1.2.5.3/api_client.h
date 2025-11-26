#ifndef API_CLIENT_H
#define API_CLIENT_H

#include <string>
#include <curl/curl.h>
#include <stdio.h>
#include <algorithm>
#include <cctype>
#include <sstream>
#include "rfid_reader.h"  // Add this include

#define API_BASE_URL "https://clockinbackend.bitsenbytes.net"

struct ScanResponse {
    bool success;
    std::string action;
    std::string message;
    std::string user_name;
    std::string user_department;
};

class APIClient {
private:
    RFIDReader* rfid_reader;  // Add pointer to RFIDReader
    
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
        ((std::string*)userp)->append((char*)contents, size * nmemb);
        return size * nmemb;
    }
    
    // Helper function to escape JSON strings
    std::string EscapeJSON(const std::string& input) {
        std::ostringstream escaped;
        for (char c : input) {
            switch (c) {
                case '"':  escaped << "\\\""; break;
                case '\\': escaped << "\\\\"; break;
                case '\b': escaped << "\\b"; break;
                case '\f': escaped << "\\f"; break;
                case '\n': escaped << "\\n"; break;
                case '\r': escaped << "\\r"; break;
                case '\t': escaped << "\\t"; break;
                default:
                    if (c < 32) {
                        // Escape control characters
                        char buf[8];
                        snprintf(buf, sizeof(buf), "\\u%04x", (unsigned char)c);
                        escaped << buf;
                    } else {
                        escaped << c;
                    }
            }
        }
        return escaped.str();
    }
    
    std::string ParseJSON(const std::string& json, const std::string& key) {
        std::string search = "\"" + key + "\":";
        size_t pos = json.find(search);
        if (pos == std::string::npos) return "";
        
        pos += search.length();
        while (pos < json.length() && (json[pos] == ' ' || json[pos] == '"')) pos++;
        
        size_t end = pos;
        while (end < json.length() && json[end] != '"' && json[end] != ',' && json[end] != '}') end++;
        
        return json.substr(pos, end - pos);
    }
    
    bool ParseBool(const std::string& json, const std::string& key) {
        std::string value = ParseJSON(json, key);
        return (value == "true" || value == "True");
    }

public:
    // Constructor that accepts RFIDReader pointer
    APIClient(RFIDReader* reader = nullptr) : rfid_reader(reader) {}
    
    // Set the RFID reader (if not set in constructor)
    void SetRFIDReader(RFIDReader* reader) {
        rfid_reader = reader;
    }
    
    static std::string clean_rfid_uid(std::string rfid_uid_with_spaces) {
        rfid_uid_with_spaces.erase(
            std::remove_if(rfid_uid_with_spaces.begin(), rfid_uid_with_spaces.end(), [](char c) {
                return std::isspace(static_cast<unsigned char>(c));
            }),
            rfid_uid_with_spaces.end()
        );
        return rfid_uid_with_spaces;
    }

    bool TestConnection() {
        CURL* curl = curl_easy_init();
        if (!curl) return false;
        
        std::string response;
        char url[256];
        snprintf(url, sizeof(url), "%s/health", API_BASE_URL);
        
        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
        
        CURLcode res = curl_easy_perform(curl);
        long response_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
        curl_easy_cleanup(curl);
        
        if (res == CURLE_OK && response_code == 200) {
            printf("✅ API connection successful\n");
            return true;
        }
        
        printf("❌ API connection failed\n");
        return false;
    }

    bool SendClockInWithSignature(const std::string& raw_rfid_uid, const std::string& signature_data) {
        std::string cleaned_rfid_uid = clean_rfid_uid(raw_rfid_uid);
        
        CURL* curl = curl_easy_init();
        if (!curl) return false;
        
        char url[256];
        snprintf(url, sizeof(url), "%s/api/clock_in_with_signature", API_BASE_URL);
        
        // Build JSON with properly escaped signature data
        std::string escaped_signature = EscapeJSON(signature_data);
        std::string json = "{\"rfid_uid\":\"" + cleaned_rfid_uid + "\",\"signature\":\"" + escaped_signature + "\"}";
        
        printf("📤 Sending JSON (first 200 chars): %.200s...\n", json.c_str());
        
        // Trigger buzzer if RFID reader is available
        if (rfid_reader) {
            rfid_reader->SendBuzzCommand();
        }
        
        std::string response_data;
        struct curl_slist* headers = NULL;
        headers = curl_slist_append(headers, "Content-Type: application/json");
        
        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json.c_str());
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_data);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 10L);
        
        CURLcode res = curl_easy_perform(curl);
        long response_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
        
        printf("📥 Response code: %ld\n", response_code);
        if (!response_data.empty()) {
            printf("📥 Response: %s\n", response_data.c_str());
        }
        
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        
        return (res == CURLE_OK && response_code == 200);
    }
    
    ScanResponse SendScan(const std::string& raw_rfid_uid) {
        ScanResponse response;
        response.success = false;
        
        std::string cleaned_rfid_uid = clean_rfid_uid(raw_rfid_uid);
        
        char url[256];
        snprintf(url, sizeof(url), "%s/api/scan", API_BASE_URL);
        
        char json[256];
        snprintf(json, sizeof(json), "{\"rfid_uid\":\"%s\"}", cleaned_rfid_uid.c_str());
        
        // Retry up to 3 times
        for (int retry = 0; retry < 3; retry++) {
            if (retry > 0) {
                printf("⚠️ Retry %d/3...\n", retry + 1);
                usleep(1000000);
            }
            
            // Create fresh CURL handle each time
            CURL* curl = curl_easy_init();
            if (!curl) continue;
            
            std::string response_data;
            struct curl_slist* headers = NULL;
            headers = curl_slist_append(headers, "Content-Type: application/json");
            
            curl_easy_setopt(curl, CURLOPT_URL, url);
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json);
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
            curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
            curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_data);
            curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
            curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 3L);
            
            CURLcode res = curl_easy_perform(curl);
            long response_code = 0;
            curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
            
            // Check if we got ANY response from server (even error codes)
            if (res == CURLE_OK) {
                if (response_code == 200) {
                    response.success = ParseBool(response_data, "success");
                    response.action = ParseJSON(response_data, "action");
                    response.message = ParseJSON(response_data, "message");
                    
                    size_t user_pos = response_data.find("\"user\"");
                    if (user_pos != std::string::npos) {
                        std::string user_section = response_data.substr(user_pos);
                        response.user_name = ParseJSON(user_section, "name");
                        response.user_department = ParseJSON(user_section, "department");
                    }
                    curl_slist_free_all(headers);
                    curl_easy_cleanup(curl);
                    return response;  // Success!
                } else if (response_code == 404) {
                    // Card not found - don't retry, return error immediately
                    response.message = "Card not registered";
                    printf("❌ Card not found in database\n");
                    curl_slist_free_all(headers);
                    curl_easy_cleanup(curl);
                    return response;
                } else {
                    // Other HTTP error - retry
                    printf("❌ HTTP error: %ld\n", response_code);
                }
            } else {
                // Connection failed - retry
                printf("❌ Connection error: %s\n", curl_easy_strerror(res));
            }
            
            curl_slist_free_all(headers);
            curl_easy_cleanup(curl);
        }
        
        // All retries failed
        response.message = "API connection failed";
        printf("❌ API unavailable after retries\n");
        return response;
    }
};

#endif