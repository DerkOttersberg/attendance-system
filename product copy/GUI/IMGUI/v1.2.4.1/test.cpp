// main.cpp
#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"
#include <GLFW/glfw3.h>
#include <stdio.h>
#include <string>
#include <vector>
#include <curl/curl.h>
#include <cmath>
#include <linux/input.h>
#include <fcntl.h>
#include <unistd.h>
#include <termios.h>
#include <errno.h>
#include <string.h>

#define RFID_DEV_PATH "/dev/ttyRPMSG0"
#define TOUCH_DEV_PATH "/dev/input/event1"
#define API_BASE_URL "http://192.168.11.242:5000"
#define SCREEN_WIDTH 800
#define SCREEN_HEIGHT 480

// Signature box area
#define SIG_X_MIN 50
#define SIG_Y_MIN 150
#define SIG_X_MAX 600
#define SIG_Y_MAX 420

// Buttons
#define CLEAR_BTN_X 650
#define CLEAR_BTN_Y 10
#define CLEAR_BTN_W 140
#define CLEAR_BTN_H 60

#define SUBMIT_BTN_X 650
#define SUBMIT_BTN_Y 400
#define SUBMIT_BTN_W 140
#define SUBMIT_BTN_H 60

#define TIMEOUT_DURATION 30.0f

// ========== RFID READER ==========
struct RFIDData {
    std::string uid;
    bool valid;
    RFIDData() : valid(false) {}
    void Reset() { uid.clear(); valid = false; }
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
        else if (in_card_block && trimmed.find("Card UID:") == 0) {
            current_data.uid = trimmed.substr(10);
        }
    }
    
public:
    RFIDReader() : fd(-1), in_card_block(false) {}
    
    bool Open() {
        if (fd >= 0) return true;
        fd = open(RFID_DEV_PATH, O_RDONLY | O_NONBLOCK | O_NOCTTY);
        if (fd < 0) {
            fprintf(stderr, "⚠️ Failed to open RFID: %s\n", strerror(errno));
            return false;
        }
        struct termios tty;
        if (tcgetattr(fd, &tty) == 0) {
            cfmakeraw(&tty);
            tty.c_cc[VMIN] = 0;
            tty.c_cc[VTIME] = 0;
            tcsetattr(fd, TCSANOW, &tty);
        }
        printf("✅ RFID ready\n");
        return true;
    }
    
    void Close() {
        if (fd >= 0) { close(fd); fd = -1; }
    }
    
    RFIDData Poll() {
        RFIDData result;
        if (fd < 0 && !Open()) return result;
        
        char buf[256];
        ssize_t n = read(fd, buf, sizeof(buf) - 1);
        if (n > 0) {
            buf[n] = '\0';
            buffer += buf;
            size_t pos;
            while ((pos = buffer.find('\n')) != std::string::npos) {
                ParseLine(buffer.substr(0, pos));
                buffer.erase(0, pos + 1);
            }
            if (current_data.valid) {
                result = current_data;
                current_data.Reset();
            }
        }
        return result;
    }
};

// ========== TOUCH HANDLER ==========
struct TouchSlot { int x = 0, y = 0; bool active = false; };
struct TouchState { TouchSlot slots[10]; int current_slot = 0; };

class TouchHandler {
private:
    int fd;
    TouchState touch;
    bool was_touching;
    ImVec2 touch_start;
    
    bool InRect(float x, float y, float x1, float y1, float x2, float y2) {
        return x >= x1 && x <= x2 && y >= y1 && y <= y2;
    }
    
public:
    TouchHandler() : fd(-1), was_touching(false), touch_start(0, 0) {}
    
    void Process(std::vector<std::vector<ImVec2>>& strokes, std::vector<ImVec2>& cur, 
                bool& drawing, bool& clear, bool& submit) {
        if (fd < 0) {
            fd = open(TOUCH_DEV_PATH, O_RDONLY | O_NONBLOCK);
            if (fd < 0) return;
            printf("✅ Touch ready\n");
        }
        
        struct input_event ev;
        bool updated = false;
        
        while (read(fd, &ev, sizeof(ev)) > 0) {
            if (ev.type == EV_ABS) {
                switch (ev.code) {
                    case ABS_MT_SLOT:
                        touch.current_slot = (ev.value >= 0 && ev.value < 10) ? ev.value : 0;
                        break;
                    case ABS_MT_TRACKING_ID:
                        touch.slots[touch.current_slot].active = (ev.value >= 0);
                        break;
                    case ABS_MT_POSITION_X:
                        touch.slots[touch.current_slot].y = ev.value;
                        updated = true;
                        break;
                    case ABS_MT_POSITION_Y:
                        touch.slots[touch.current_slot].x = ev.value;
                        updated = true;
                        break;
                }
            }
        }
        
        int active = -1;
        for (int i = 0; i < 10; i++) {
            if (touch.slots[i].active) { active = i; break; }
        }
        
        bool touching = (active >= 0);
        
        if (touching) {
            int x = SCREEN_WIDTH - touch.slots[active].x;
            int y = touch.slots[active].y;
            ImVec2 pos(x, y);
            
            if (!was_touching) touch_start = pos;
            
            // Only draw inside signature box
            if (updated && InRect(pos.x, pos.y, SIG_X_MIN, SIG_Y_MIN, SIG_X_MAX, SIG_Y_MAX)) {
                cur.push_back(pos);
                drawing = true;
            }
        } else if (was_touching) {
            // Check button taps
            if (InRect(touch_start.x, touch_start.y, CLEAR_BTN_X, CLEAR_BTN_Y, 
                      CLEAR_BTN_X + CLEAR_BTN_W, CLEAR_BTN_Y + CLEAR_BTN_H)) {
                clear = true;
            }
            else if (InRect(touch_start.x, touch_start.y, SUBMIT_BTN_X, SUBMIT_BTN_Y,
                           SUBMIT_BTN_X + SUBMIT_BTN_W, SUBMIT_BTN_Y + SUBMIT_BTN_H)) {
                submit = true;
            }
            
            if (drawing && !cur.empty()) {
                strokes.push_back(cur);
                cur.clear();
            }
            drawing = false;
        }
        
        was_touching = touching;
    }
};

// ========== API CLIENT ==========
struct ScanResponse {
    bool success;
    std::string action;
    std::string message;
    std::string user_name;
};

class APIClient {
private:
    static size_t WriteCallback(void* contents, size_t size, size_t nmemb, void* userp) {
        ((std::string*)userp)->append((char*)contents, size * nmemb);
        return size * nmemb;
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
    
public:
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
        long code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &code);
        curl_easy_cleanup(curl);
        if (res == CURLE_OK && code == 200) {
            printf("✅ API connected\n");
            return true;
        }
        return false;
    }
    
    ScanResponse SendScan(const std::string& uid) {
        ScanResponse resp;
        resp.success = false;
        CURL* curl = curl_easy_init();
        if (!curl) return resp;
        
        char url[256], json[256];
        snprintf(url, sizeof(url), "%s/api/scan", API_BASE_URL);
        snprintf(json, sizeof(json), "{\"rfid_uid\":\"%s\"}", uid.c_str());
        
        std::string data;
        struct curl_slist* headers = curl_slist_append(NULL, "Content-Type: application/json");
        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_POSTFIELDS, json);
        curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, WriteCallback);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, &data);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 5L);
        
        CURLcode res = curl_easy_perform(curl);
        long code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &code);
        
        if (res == CURLE_OK && code == 200) {
            resp.success = (ParseJSON(data, "success") == "true");
            resp.action = ParseJSON(data, "action");
            resp.message = ParseJSON(data, "message");
            size_t user_pos = data.find("\"user\"");
            if (user_pos != std::string::npos) {
                resp.user_name = ParseJSON(data.substr(user_pos), "name");
            }
        } else {
            resp.message = "Card not registered";
        }
        
        curl_slist_free_all(headers);
        curl_easy_cleanup(curl);
        return resp;
    }
    
    bool ConfirmClockIn(const std::string& uid) {
        // Just send scan again to confirm
        return SendScan(uid).success;
    }
};

// ========== UI RENDERER ==========
class UIRenderer {
public:
    void RenderWaiting(ImDrawList* dl) {
        const char* text = "Please scan your RFID card";
        ImVec2 ts = ImGui::CalcTextSize(text);
        ImVec2 center(400, 240);
        float radius = 80 + sin(ImGui::GetTime() * 2.0f) * 10.0f;
        dl->AddCircle(center, radius, IM_COL32(100, 150, 250, 255), 32, 3.0f);
        dl->AddText(ImGui::GetFont(), 32, ImVec2(center.x - ts.x/2, center.y - ts.y/2), 
                   IM_COL32(50, 50, 50, 255), text);
    }
    
    void RenderSignature(ImDrawList* dl, const std::string& name, 
                        const std::vector<std::vector<ImVec2>>& strokes,
                        const std::vector<ImVec2>& cur, float timeout) {
        // Header
        std::string header = "Welcome, " + name + "!";
        ImVec2 hs = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, header.c_str());
        dl->AddText(ImGui::GetFont(), 28, ImVec2(400 - hs.x/2, 30), 
                   IM_COL32(50, 50, 50, 255), header.c_str());
        
        const char* inst = "Sign below to clock in";
        ImVec2 is = ImGui::CalcTextSize(inst);
        dl->AddText(ImVec2(400 - is.x/2, 80), IM_COL32(100, 100, 100, 255), inst);
        
        // Timeout
        char timeout_txt[32];
        snprintf(timeout_txt, sizeof(timeout_txt), "%.0fs", timeout);
        ImVec2 tts = ImGui::CalcTextSize(timeout_txt);
        dl->AddText(ImVec2(400 - tts.x/2, 110), IM_COL32(200, 100, 100, 255), timeout_txt);
        
        // Signature box
        dl->AddRectFilled(ImVec2(SIG_X_MIN, SIG_Y_MIN), ImVec2(SIG_X_MAX, SIG_Y_MAX), 
                         IM_COL32(250, 250, 250, 255));
        dl->AddRect(ImVec2(SIG_X_MIN, SIG_Y_MIN), ImVec2(SIG_X_MAX, SIG_Y_MAX), 
                   IM_COL32(200, 200, 200, 255), 0, 0, 2);
        
        for (const auto& s : strokes) {
            if (s.size() > 1) dl->AddPolyline(s.data(), s.size(), IM_COL32(0, 0, 0, 255), false, 3);
        }
        if (cur.size() > 1) dl->AddPolyline(cur.data(), cur.size(), IM_COL32(0, 0, 0, 255), false, 3);
        
        // Clear button
        dl->AddRectFilled(ImVec2(CLEAR_BTN_X, CLEAR_BTN_Y), 
                         ImVec2(CLEAR_BTN_X + CLEAR_BTN_W, CLEAR_BTN_Y + CLEAR_BTN_H), 
                         IM_COL32(220, 220, 220, 255), 8);
        dl->AddRect(ImVec2(CLEAR_BTN_X, CLEAR_BTN_Y), 
                   ImVec2(CLEAR_BTN_X + CLEAR_BTN_W, CLEAR_BTN_Y + CLEAR_BTN_H), 
                   IM_COL32(100, 100, 100, 255), 8, 0, 2);
        ImVec2 ct = ImGui::CalcTextSize("CLEAR");
        dl->AddText(ImVec2(CLEAR_BTN_X + (CLEAR_BTN_W - ct.x)/2, CLEAR_BTN_Y + (CLEAR_BTN_H - ct.y)/2), 
                   IM_COL32(0, 0, 0, 255), "CLEAR");
        
        // Submit button
        dl->AddRectFilled(ImVec2(SUBMIT_BTN_X, SUBMIT_BTN_Y), 
                         ImVec2(SUBMIT_BTN_X + SUBMIT_BTN_W, SUBMIT_BTN_Y + SUBMIT_BTN_H), 
                         IM_COL32(100, 200, 100, 255), 8);
        dl->AddRect(ImVec2(SUBMIT_BTN_X, SUBMIT_BTN_Y), 
                   ImVec2(SUBMIT_BTN_X + SUBMIT_BTN_W, SUBMIT_BTN_Y + SUBMIT_BTN_H), 
                   IM_COL32(50, 150, 50, 255), 8, 0, 2);
        ImVec2 st = ImGui::CalcTextSize("SUBMIT");
        dl->AddText(ImVec2(SUBMIT_BTN_X + (SUBMIT_BTN_W - st.x)/2, SUBMIT_BTN_Y + (SUBMIT_BTN_H - st.y)/2), 
                   IM_COL32(255, 255, 255, 255), "SUBMIT");
    }
    
    void RenderSuccess(ImDrawList* dl, const std::string& name, const std::string& action) {
        ImVec2 center(400, 200);
        dl->AddCircleFilled(center, 60, IM_COL32(100, 200, 100, 255));
        ImVec2 cs = ImVec2(center.x - 25, center.y);
        ImVec2 cm = ImVec2(center.x - 5, center.y + 20);
        ImVec2 ce = ImVec2(center.x + 30, center.y - 25);
        dl->AddLine(cs, cm, IM_COL32(255, 255, 255, 255), 6);
        dl->AddLine(cm, ce, IM_COL32(255, 255, 255, 255), 6);
        
        std::string msg = (action == "clock_in") ? "Clocked In!" : "Clocked Out!";
        ImVec2 ms = ImGui::GetFont()->CalcTextSizeA(32, FLT_MAX, 0, msg.c_str());
        dl->AddText(ImGui::GetFont(), 32, ImVec2(400 - ms.x/2, 300), IM_COL32(50, 50, 50, 255), msg.c_str());
        
        ImVec2 ns = ImGui::GetFont()->CalcTextSizeA(24, FLT_MAX, 0, name.c_str());
        dl->AddText(ImGui::GetFont(), 24, ImVec2(400 - ns.x/2, 350), IM_COL32(100, 100, 100, 255), name.c_str());
    }
    
    void RenderError(ImDrawList* dl, const std::string& msg) {
        ImVec2 center(400, 200);
        dl->AddCircleFilled(center, 60, IM_COL32(220, 80, 80, 255));
        float xs = 40;
        dl->AddLine(ImVec2(center.x - xs/2, center.y - xs/2), ImVec2(center.x + xs/2, center.y + xs/2), 
                   IM_COL32(255, 255, 255, 255), 6);
        dl->AddLine(ImVec2(center.x + xs/2, center.y - xs/2), ImVec2(center.x - xs/2, center.y + xs/2), 
                   IM_COL32(255, 255, 255, 255), 6);
        
        ImVec2 ms = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0, msg.c_str());
        dl->AddText(ImGui::GetFont(), 28, ImVec2(400 - ms.x/2, 300), IM_COL32(220, 80, 80, 255), msg.c_str());
    }
};

// ========== APP STATE ==========
enum AppState { WAITING, SIGNATURE, SUCCESS, ERROR };

struct AppContext {
    AppState state, next;
    RFIDReader rfid;
    TouchHandler touch;
    APIClient api;
    UIRenderer ui;
    std::string user_name, action, message, pending_uid;
    std::vector<std::vector<ImVec2>> strokes;
    std::vector<ImVec2> cur_stroke;
    bool drawing;
    float timer;
    
    AppContext() : state(WAITING), next(WAITING), drawing(false), timer(0) {}
    
    void Change(AppState s) { next = s; timer = 0; }
    void Clear() { strokes.clear(); cur_stroke.clear(); drawing = false; user_name.clear(); action.clear(); message.clear(); pending_uid.clear(); }
};

void HandleWaiting(AppContext& ctx) {
    RFIDData rd = ctx.rfid.Poll();
    if (rd.valid) {
        printf("🔵 Card: %s\n", rd.uid.c_str());
        ScanResponse resp = ctx.api.SendScan(rd.uid);
        if (resp.success) {
            ctx.user_name = resp.user_name;
            ctx.action = resp.action;
            ctx.message = resp.message;
            ctx.pending_uid = rd.uid;
            printf("✅ %s - %s\n", resp.action.c_str(), resp.user_name.c_str());
            
            if (resp.action == "clock_in") {
                ctx.Change(SIGNATURE);
            } else {
                ctx.Change(SUCCESS);
            }
        } else {
            ctx.message = resp.message;
            ctx.Change(ERROR);
        }
    }
}

void HandleSignature(AppContext& ctx, float dt) {
    ctx.timer += dt;
    
    if (ctx.timer >= TIMEOUT_DURATION) {
        printf("⏱️ Timeout\n");
        ctx.Clear();
        ctx.Change(WAITING);
        return;
    }
    
    bool clear = false, submit = false;
    ctx.touch.Process(ctx.strokes, ctx.cur_stroke, ctx.drawing, clear, submit);
    
    if (clear) {
        ctx.strokes.clear();
        ctx.cur_stroke.clear();
        ctx.timer = 0;  // Reset timeout on activity
        printf("🗑️ Cleared\n");
    }
    
    if (submit) {
        printf("✅ Submitting signature\n");
        // Here you could save signature if needed
        ctx.Change(SUCCESS);
    }
    
    // Reset timeout on any drawing activity
    if (ctx.drawing) {
        ctx.timer = 0;
    }
}

void HandleSuccess(AppContext& ctx, float dt) {
    ctx.timer += dt;
    if (ctx.timer >= 3.0f) {
        ctx.Clear();
        ctx.Change(WAITING);
    }
}

void HandleError(AppContext& ctx, float dt) {
    ctx.timer += dt;
    if (ctx.timer >= 3.0f) {
        ctx.Clear();
        ctx.Change(WAITING);
    }
}

// ========== MAIN ==========
int main() {
    curl_global_init(CURL_GLOBAL_DEFAULT);
    printf("================================================\n");
    printf("🚀 RFID Attendance System\n");
    printf("================================================\n");
    
    AppContext ctx;
    ctx.api.TestConnection();
    ctx.rfid.Open();
    
    if (!glfwInit()) return 1;
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 2);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
    glfwWindowHint(GLFW_CLIENT_API, GLFW_OPENGL_ES_API);
    
    GLFWwindow* win = glfwCreateWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Attendance", glfwGetPrimaryMonitor(), NULL);
    if (!win) { glfwTerminate(); return 1; }
    
    glfwMakeContextCurrent(win);
    glfwSwapInterval(1);
    
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGui::GetIO().MouseDrawCursor = false;
    ImGui_ImplGlfw_InitForOpenGL(win, true);
    ImGui_ImplOpenGL3_Init("#version 100");
    
    printf("✅ Ready\n================================================\n");
    
    float last = glfwGetTime();
    while (!glfwWindowShouldClose(win)) {
        glfwPollEvents();
        float now = glfwGetTime();
        float dt = now - last;
        last = now;
        
        if (ctx.next != ctx.state) ctx.state = ctx.next;
        
        switch (ctx.state) {
            case WAITING: HandleWaiting(ctx); break;
            case SIGNATURE: HandleSignature(ctx, dt); break;
            case SUCCESS: HandleSuccess(ctx, dt); break;
            case ERROR: HandleError(ctx, dt); break;
        }
        
        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();
        
        ImDrawList* dl = ImGui::GetBackgroundDrawList();
        switch (ctx.state) {
            case WAITING: ctx.ui.RenderWaiting(dl); break;
            case SIGNATURE: ctx.ui.RenderSignature(dl, ctx.user_name, ctx.strokes, ctx.cur_stroke, TIMEOUT_DURATION - ctx.timer); break;
            case SUCCESS: ctx.ui.RenderSuccess(dl, ctx.user_name, ctx.action); break;
            case ERROR: ctx.ui.RenderError(dl, ctx.message); break;
        }
        
        ImGui::Render();
        int w, h;
        glfwGetFramebufferSize(win, &w, &h);
        glViewport(0, 0, w, h);
        glClearColor(1, 1, 1, 1);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(win);
    }
    
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    glfwDestroyWindow(win);
    glfwTerminate();
    ctx.rfid.Close();
    curl_global_cleanup();
    return 0;
}