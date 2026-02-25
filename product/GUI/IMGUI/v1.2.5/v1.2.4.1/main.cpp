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

void HandleWaitingCardState(AppContext& ctx, float delta_time) {
    // Poll for RFID card
    RFIDData rfid_data = ctx.rfid_reader.Poll();
    
    if (rfid_data.valid) {
        printf("🔵 RFID Card: %s\n", rfid_data.uid.c_str());
        
        // Send to API
        ScanResponse response = ctx.api_client.SendScan(rfid_data.uid);
        
        if (response.success) {
            ctx.user_name = response.user_name;
            ctx.user_department = response.user_department;
            ctx.action = response.action;
            ctx.message = response.message;
            
            printf("✅ %s - %s\n", ctx.action.c_str(), ctx.user_name.c_str());
            
            if (ctx.action == "clock_in") {
                // Clock in requires signature
                ctx.ChangeState(STATE_SIGNATURE);
            } else {
                // Clock out goes directly to success
                ctx.ChangeState(STATE_SUCCESS);
            }
        } else {
            ctx.message = response.message;
            ctx.ChangeState(STATE_ERROR);
        }
    }
}

void HandleSignatureState(AppContext& ctx, float delta_time) {
    // Handle touch input for signature
    bool clear_pressed = false;
    bool submit_pressed = false;  // ADD THIS
    ctx.touch_handler.ProcessInput(
        ctx.signature_strokes, 
        ctx.current_stroke, 
        ctx.is_drawing, 
        clear_pressed,
        submit_pressed  // ADD THIS
    );
    
    if (clear_pressed) {
        ctx.ClearSignature();
        printf("🗑️ Signature cleared\n");
    }
    
    // ADD THIS BLOCK
    if (submit_pressed) {
        if (!ctx.signature_strokes.empty() || !ctx.current_stroke.empty()) {
            printf("✅ Signature submitted\n");
            // Here you could send the signature to the API if needed
            ctx.ChangeState(STATE_SUCCESS);
        } else {
            printf("⚠️ No signature to submit\n");
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