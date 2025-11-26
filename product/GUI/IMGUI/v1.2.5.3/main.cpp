// main.cpp
// RFID Attendance System with Signature for Clock-In
// Clean architecture with state management

#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"
#include <GLFW/glfw3.h>
#include <stdio.h>
#include <string>
#include <vector>
#include <curl/curl.h>
#include "rfid_reader.h"
#include "touch_handler.h"
#include "api_client.h"
#include "ui_renderer.h"
#include <sstream>
#include <iomanip>
#include <algorithm>

// ====================================================
// APPLICATION STATE
// ====================================================

enum AppState {
    STATE_WAITING_CARD,      // Waiting for RFID card
    STATE_SIGNATURE,         // Drawing signature (clock in only)
    STATE_SUCCESS,           // Show success message
    STATE_ERROR              // Show error message
};

struct AppContext {
    AppState current_state;
    AppState next_state;
    
    RFIDReader rfid_reader;
    TouchHandler touch_handler;
    APIClient api_client;
    UIRenderer ui_renderer;
    
    // User data
    std::string pending_rfid_uid;
    std::string user_name;
    std::string user_department;
    std::string action;  // "clock_in" or "clock_out"
    std::string message;
    
    // Signature data
    std::vector<std::vector<ImVec2>> signature_strokes;
    std::vector<ImVec2> current_stroke;
    bool is_drawing;
    
    // Timing
    float state_timer;
    float message_duration;
    
    AppContext() : 
        current_state(STATE_WAITING_CARD),
        next_state(STATE_WAITING_CARD),
        is_drawing(false),
        state_timer(0.0f),
        message_duration(3.0f) {}
    
    void ChangeState(AppState new_state) {
        next_state = new_state;
        state_timer = 0.0f;
    }
    
    void ClearSignature() {
        signature_strokes.clear();
        current_stroke.clear();
        is_drawing = false;
    }
    
    void Reset() {
        user_name.clear();
        user_department.clear();
        action.clear();
        message.clear();
        ClearSignature();
    }
};

// ====================================================
// STATE HANDLERS
// ====================================================


std::string SignatureToBase64PNG(const std::vector<std::vector<ImVec2>>& strokes, int width, int height) {
    // Signature area bounds from ui_renderer.h
    const float SIG_MIN_X = 50;
    const float SIG_MIN_Y = 150;
    const float SIG_WIDTH = 550;
    const float SIG_HEIGHT = 270;
    
    // Create SVG with normalized coordinates
    std::stringstream svg;
    svg << "<svg width=\"" << width << "\" height=\"" << height 
        << "\" xmlns=\"http://www.w3.org/2000/svg\">";
    svg << "<rect width=\"100%\" height=\"100%\" fill=\"white\"/>";
    
    for (const auto& stroke : strokes) {
        if (stroke.size() < 2) continue;
        
        svg << "<polyline points=\"";
        for (size_t i = 0; i < stroke.size(); i++) {
            // Normalize coordinates relative to signature box
            float normalized_x = ((stroke[i].x - SIG_MIN_X) / SIG_WIDTH) * width;
            float normalized_y = ((stroke[i].y - SIG_MIN_Y) / SIG_HEIGHT) * height;
            
            // Clamp to bounds
            normalized_x = std::max(0.0f, std::min((float)width, normalized_x));
            normalized_y = std::max(0.0f, std::min((float)height, normalized_y));
            
            svg << normalized_x << "," << normalized_y;
            if (i < stroke.size() - 1) svg << " ";
        }
        svg << "\" stroke=\"black\" stroke-width=\"3\" fill=\"none\"/>";
    }
    
    svg << "</svg>";
    
    return svg.str();
}

void HandleWaitingCardState(AppContext& ctx, float delta_time) {
    RFIDData rfid_data = ctx.rfid_reader.Poll();
    
    if (rfid_data.valid) {
        printf("🔵 RFID Card: %s\n", rfid_data.uid.c_str());
        
        // Send to API to check user
        ScanResponse response = ctx.api_client.SendScan(rfid_data.uid);
        
        if (response.success) {
            ctx.user_name = response.user_name;
            ctx.user_department = response.user_department;
            ctx.action = response.action;
            ctx.message = response.message;
            ctx.pending_rfid_uid = rfid_data.uid;  // ADD THIS
            
            printf("✅ %s - %s\n", ctx.action.c_str(), ctx.user_name.c_str());
            
            if (ctx.action == "clock_in") {
                ctx.ChangeState(STATE_SIGNATURE);
            } else {
                ctx.ChangeState(STATE_SUCCESS);
            }
        } else {
            ctx.message = response.message;
            ctx.ChangeState(STATE_ERROR);
        }
    }
}

void HandleSignatureState(AppContext& ctx, float delta_time) {
    bool clear_pressed = false;
    bool submit_pressed = false;
    ctx.touch_handler.ProcessInput(
        ctx.signature_strokes, 
        ctx.current_stroke, 
        ctx.is_drawing, 
        clear_pressed,
        submit_pressed
    );
    
    if (clear_pressed) {
        ctx.ClearSignature();
        printf("🗑️ Signature cleared\n");
    }
    
    if (submit_pressed) {
        if (!ctx.signature_strokes.empty()) {
            printf("📝 Submitting signature...\n");
            
            // Convert signature to SVG string
            std::string signature_svg = SignatureToBase64PNG(ctx.signature_strokes, 550, 270);
            
            // Send to API
            if (ctx.api_client.SendClockInWithSignature(ctx.pending_rfid_uid, signature_svg)) {
                printf("✅ Clock-in with signature successful\n");
                ctx.ChangeState(STATE_SUCCESS);
            } else {
                printf("❌ Failed to submit signature\n");
                ctx.message = "Failed to submit signature";
                ctx.ChangeState(STATE_ERROR);
            }
        } else {
            printf("⚠️ No signature to submit\n");
            ctx.message = "Please draw your signature";
            ctx.ChangeState(STATE_ERROR);
        }
    }
}

void HandleSuccessState(AppContext& ctx, float delta_time) {
    ctx.state_timer += delta_time;
    
    if (ctx.state_timer >= ctx.message_duration) {
        ctx.Reset();
        ctx.ChangeState(STATE_WAITING_CARD);
    }
}

void HandleErrorState(AppContext& ctx, float delta_time) {
    ctx.state_timer += delta_time;
    
    if (ctx.state_timer >= ctx.message_duration) {
        ctx.Reset();
        ctx.ChangeState(STATE_WAITING_CARD);
    }
}



// ====================================================
// MAIN LOOP
// ====================================================

void UpdateApp(AppContext& ctx, float delta_time) {
    // State transition
    if (ctx.next_state != ctx.current_state) {
        ctx.current_state = ctx.next_state;
    }
    
    // Handle current state
    switch (ctx.current_state) {
        case STATE_WAITING_CARD:
            HandleWaitingCardState(ctx, delta_time);
            break;
            
        case STATE_SIGNATURE:
            HandleSignatureState(ctx, delta_time);
            break;
            
        case STATE_SUCCESS:
            HandleSuccessState(ctx, delta_time);
            break;
            
        case STATE_ERROR:
            HandleErrorState(ctx, delta_time);
            break;
    }
}

void RenderApp(AppContext& ctx) {
    ImDrawList* draw_list = ImGui::GetBackgroundDrawList();
    
    switch (ctx.current_state) {
        case STATE_WAITING_CARD:
            ctx.ui_renderer.RenderWaitingScreen(draw_list);
            break;
            
        case STATE_SIGNATURE:
            ctx.ui_renderer.RenderSignatureScreen(
                draw_list,
                ctx.user_name,
                ctx.signature_strokes,
                ctx.current_stroke
            );
            break;
            
        case STATE_SUCCESS:
            ctx.ui_renderer.RenderSuccessScreen(
                draw_list,
                ctx.user_name,
                ctx.action
            );
            break;
            
        case STATE_ERROR:
            ctx.ui_renderer.RenderErrorScreen(
                draw_list,
                ctx.message
            );
            break;
    }
}

// ====================================================
// MAIN
// ====================================================

int main(int, char**) {
    // Initialize CURL
    curl_global_init(CURL_GLOBAL_DEFAULT);
    
    printf("================================================\n");
    printf("🚀 RFID Attendance System\n");
    printf("================================================\n");
    
    // Initialize context
    AppContext ctx;
    
    // Initialize RFID reader FIRST
    if (!ctx.rfid_reader.Open()) {
        printf("❌ Failed to open RFID reader!\n");
        curl_global_cleanup();
        return 1;
    }
    
    // NOW connect the API client to the RFID reader
    ctx.api_client.SetRFIDReader(&ctx.rfid_reader);

    // Test API connection
    if (!ctx.api_client.TestConnection()) {
        printf("⚠️  Warning: API connection failed. System may not work properly.\n");
    }
    
    // Initialize RFID reader
    if (!ctx.rfid_reader.Open()) {
        printf("❌ Failed to open RFID reader!\n");
        curl_global_cleanup();
        return 1;
    }
    
    // Initialize GLFW
    if (!glfwInit()) {
        printf("❌ Failed to initialize GLFW!\n");
        curl_global_cleanup();
        return 1;
    }
    
    const char* glsl_version = "#version 100";
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 2);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
    glfwWindowHint(GLFW_CLIENT_API, GLFW_OPENGL_ES_API);
    
    GLFWwindow* window = glfwCreateWindow(800, 480, "RFID Attendance", glfwGetPrimaryMonitor(), NULL);
    if (!window) {
        printf("❌ Failed to create window!\n");
        glfwTerminate();
        curl_global_cleanup();
        return 1;
    }
    
    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);
    
    // Initialize ImGui
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.MouseDrawCursor = false;
    
    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init(glsl_version);
    
    printf("✅ System ready\n");
    printf("================================================\n\n");
    
    // Main loop
    float last_time = glfwGetTime();
    
    while (!glfwWindowShouldClose(window)) {
        glfwPollEvents();
        
        // Calculate delta time
        float current_time = glfwGetTime();
        float delta_time = current_time - last_time;
        last_time = current_time;
        
        // Update application logic
        UpdateApp(ctx, delta_time);
        
        // Render
        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();
        
        RenderApp(ctx);
        
        ImGui::Render();
        int display_w, display_h;
        glfwGetFramebufferSize(window, &display_w, &display_h);
        glViewport(0, 0, display_w, display_h);
        glClearColor(1.0f, 1.0f, 1.0f, 1.0f);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(window);
    }
    
    // Cleanup
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    glfwDestroyWindow(window);
    glfwTerminate();
    ctx.rfid_reader.Close();
    curl_global_cleanup();
    
    return 0;
}