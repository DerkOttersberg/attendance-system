#ifndef API_CLIENT_H
#define API_CLIENT_H

#include <string>
#include <curl/curl.h>
#include <stdio.h>
#include <algorithm> // Required for std::remove_if
#include <cctype>    // Required for std::isspace

#define API_BASE_URL "http://192.168.11.242:5000"

struct ScanResponse {
    bool success;
    std::string action;  // "clock_in" or "clock_out"
    std::string message;
    std::string user_name;
    std::string user_department;
};

class APIClient {
private:
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
        ((std::string*)userp)->append((char*)contents, size * nmemb);
        return size * nmemb;
    }
    
    // Simple JSON parser helpers (omitted for brevity, assume they work)
    std::string ParseJSON(const std::string& json, const std::string& key) {
        // ... (Original ParseJSON implementation) ...
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
    /**
     * @brief Removes all whitespace characters from an RFID UID string.
     * @param rfid_uid_with_spaces The raw UID string, possibly with spaces.
     * @return The cleaned UID string (e.g., "11 F3 EF 12" -> "11F3EF12").
     */
    static std::string clean_rfid_uid(std::string rfid_uid_with_spaces) {
        // Use the erase-remove idiom to efficiently remove all space characters
        rfid_uid_with_spaces.erase(
            std::remove_if(rfid_uid_with_spaces.begin(), rfid_uid_with_spaces.end(), [](char c) {
                return std::isspace(static_cast<unsigned char>(c));
            }),
            rfid_uid_with_spaces.end()
        );
        return rfid_uid_with_spaces;
    }

    bool TestConnection() {
        // ... (Original TestConnection implementation) ...
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
            printf("? API connection successful\n");
            return true;
        }
        
        printf("? API connection failed\n");
        return false;
    }
    
    ScanResponse SendScan(const std::string& raw_rfid_uid) {
        ScanResponse response;
        response.success = false;
        
        // 1. Clean the UID before use
        std::string cleaned_rfid_uid = clean_rfid_uid(raw_rfid_uid);

        CURL* curl = curl_easy_init();
        if (!curl) return response;
        
        char url[256];
        snprintf(url, sizeof(url), "%s/api/scan", API_BASE_URL);
        
        // 2. Build JSON payload using the CLEANED UID
        char json[256];
        snprintf(json, sizeof(json), "{\"rfid_uid\":\"%s\"}", cleaned_rfid_uid.c_str());
        
        std::string response_data;
        struct curl_slist* headers = NULL;
        headers = curl_slist_append(headers, "Content-Type: application/json");
        
        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &response_data);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
        
        CURLcode res = curl_easy_perform(curl);
        long response_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &response_code);
        
        if (res == CURLE_OK && response_code == 200) {
            response.success = ParseBool(response_data, "success");
            response.action = ParseJSON(response_data, "action");
            response.message = ParseJSON(response_data, "message");
            
            // Parse nested user object
            size_t user_pos = response_data.find("\"user\"");
            if (user_pos != std::string::npos) {
                std::string user_section = response_data.substr(user_pos);
                response.user_name = ParseJSON(user_section, "name");
                response.user_department = ParseJSON(user_section, "department");
            }
        } else {
            response.message = "Connection failed or card not registered";
        }
        
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        
        return response;
    }
};

#endif