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
#include <sstream>
#include <iomanip>
#include <algorithm>
#include <fcntl.h>
#include <unistd.h>
#include <linux/input.h>

// Numeric keypad touch areas (password screen) - MUST BE BEFORE ui_renderer.h
#define KEYPAD_BUTTON_W 100
#define KEYPAD_BUTTON_H 60
#define KEYPAD_START_X 200  // Centered for 3 buttons: 200, 320, 440 (800/2 - 150 = 250 for center)
#define KEYPAD_START_Y 210  // Moved up from 250
#define KEYPAD_SPACING_X 130  // Total width: 3*100 + 2*30 = 360, centered at 400
#define KEYPAD_SPACING_Y 75

// RFID removal detection: number of consecutive empty polls to consider the card removed
#define RFID_REMOVE_FRAMES 10

#include "ui_renderer.h"

// ====================================================
// APPLICATION STATE
// ====================================================

enum AppState {
    STATE_WAITING_CARD,      // Waiting for RFID card
    STATE_SIGNATURE,         // Drawing signature (clock in only)
    STATE_SUCCESS,           // Show success message
    STATE_ERROR,             // Show error message
    STATE_ADMIN_PASSWORD,    // Prompt for admin password
    STATE_ADMIN              // Admin menu
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
    // Admin
    std::string admin_password_buffer;  // For PIN entry (numeric)
    bool admin_submit_requested;
    char admin_input_buf[128];
    std::string admin_displayed_rfid;
    ImVec2 admin_touch_start_pos;  // Track start position for button detection
    bool admin_was_touching;       // Track if touch was active
    // RFID debouncing - only poll on waiting screen
    std::string last_processed_rfid_uid;  // Track the card UID that was just processed to prevent duplicates while held
    bool rfid_card_present;               // True while the same card remains in the field
    int rfid_no_data_frames;              // Consecutive empty polls used to detect card removal
    
    AppContext() : 
        current_state(STATE_WAITING_CARD),
        next_state(STATE_WAITING_CARD),
        is_drawing(false),
        state_timer(0.0f),
        message_duration(3.0f),
        admin_submit_requested(false),
        admin_was_touching(false),
        rfid_card_present(false),
        rfid_no_data_frames(0) {
            admin_input_buf[0] = '\0';
        }
    
    void ChangeState(AppState new_state) {
        next_state = new_state;
        state_timer = 0.0f;
        
        // Clear RFID debounce when entering WAITING state (fresh start for new card reads)
        if (new_state == STATE_WAITING_CARD) {
            // Drain any buffered RFID data so we don't process stale reads
            rfid_reader.Flush();
            // Start removal detection fresh; keep last_processed_rfid_uid until card is removed
            rfid_no_data_frames = 0;
        }
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
        admin_password_buffer.clear();
        admin_submit_requested = false;
        admin_displayed_rfid.clear();
        admin_input_buf[0] = '\0';
        // NOTE: DO NOT clear last_processed_rfid_uid or rfid_cooldown_timer here!
        // These must persist across state transitions to protect against duplicate card processing
        // They are ONLY cleared when manually entering a new flow or explicitly wanted
    }
};

// Hardcoded admin PIN (numeric)
static const std::string ADMIN_PASSWORD = "1111";

// Helper to get keypad button area for digit (1-9)
bool IsInKeypadButton(float x, float y, int digit) {
    if (digit < 1 || digit > 9) return false;
    int row = (digit - 1) / 3;
    int col = (digit - 1) % 3;
    float btn_x = KEYPAD_START_X + col * KEYPAD_SPACING_X;
    float btn_y = KEYPAD_START_Y + row * KEYPAD_SPACING_Y;
    return (x >= btn_x && x <= btn_x + KEYPAD_BUTTON_W && 
            y >= btn_y && y <= btn_y + KEYPAD_BUTTON_H);
}

// Back button area on password screen
bool IsInPasswordBackButton(float x, float y) {
    return (x >= 650 && x <= 790 && y >= 10 && y <= 70);
}

// Back button area on admin screen (same location)
bool IsInAdminBackButton(float x, float y) {
    return (x >= 650 && x <= 790 && y >= 10 && y <= 70);
}

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
    // Check for admin button tap (top-right area = clear button area) using touch handler
    bool clear_pressed = false;
    bool submit_pressed = false;
    bool cancel_pressed = false;
    std::vector<std::vector<ImVec2>> dummy_strokes;
    std::vector<ImVec2> dummy_current;
    bool dummy_drawing = false;
    ctx.touch_handler.ProcessInput(dummy_strokes, dummy_current, dummy_drawing, clear_pressed, submit_pressed, cancel_pressed);
    
    if (clear_pressed) {
        ctx.admin_password_buffer.clear();
        ctx.admin_submit_requested = false;
        ctx.admin_input_buf[0] = '\0';
        ctx.ChangeState(STATE_ADMIN_PASSWORD);
        return;
    }

    RFIDData rfid_data = ctx.rfid_reader.Poll();

    // If no valid data, use consecutive empty polls to detect card removal
    if (!rfid_data.valid) {
        if (ctx.rfid_card_present) {
            ctx.rfid_no_data_frames++;
            if (ctx.rfid_no_data_frames >= RFID_REMOVE_FRAMES) {
                ctx.rfid_card_present = false;
                ctx.last_processed_rfid_uid.clear();
                ctx.rfid_no_data_frames = 0;
            }
        }
        return;
    }

    // Valid data received; reset removal counter
    ctx.rfid_no_data_frames = 0;

    // If the same card is still present, ignore it until removed
    if (ctx.rfid_card_present && rfid_data.uid == ctx.last_processed_rfid_uid) {
        return;
    }

    printf("🔵 RFID Card: %s\n", rfid_data.uid.c_str());
    
    // Store this UID as processed and mark card as present
    ctx.last_processed_rfid_uid = rfid_data.uid;
    ctx.rfid_card_present = true;
        
        // Send to API to check user
        ScanResponse response = ctx.api_client.SendScan(rfid_data.uid);
        
        if (response.success) {
            ctx.user_name = response.user_name;
            ctx.user_department = response.user_department;
            ctx.action = response.action;
            ctx.message = response.message;
            ctx.pending_rfid_uid = rfid_data.uid;
            
            printf("✅ %s - %s\n", ctx.action.c_str(), ctx.user_name.c_str());
            
            if (ctx.action == "clock_in") {
                // Going to signature screen - turn LED RED
                ctx.api_client.SendDirectCommand("buzz");
                usleep(200000);
                ctx.api_client.SendDirectCommand("red_on");
                usleep(200000);  // 200ms - increased from 50ms
                ctx.api_client.SendDirectCommand("green_off");
                ctx.ChangeState(STATE_SIGNATURE);
            } else {
                // Clock out - keep LED GREEN, just buzz
                ctx.api_client.SendDirectCommand("beep");
                ctx.ChangeState(STATE_SUCCESS);
            }
        } else {
            ctx.message = response.message;
            ctx.ChangeState(STATE_ERROR);
        }
}

void HandleAdminPasswordState(AppContext& ctx, float delta_time) {
    // Use touch handler to poll touch events, similar to signature screen
    bool clear_pressed = false;
    bool submit_pressed = false;
    std::vector<std::vector<ImVec2>> dummy_strokes;
    std::vector<ImVec2> dummy_current;
    bool dummy_drawing = false;
    
    // Reuse touch handler's existing touch reading infrastructure
    // We'll track touch position ourselves for keypad detection
    int fd = -1;
    if (ctx.touch_handler.fd < 0) {
        fd = open(TOUCH_DEV_PATH, O_RDONLY | O_NONBLOCK);
        if (fd < 0) return;
    } else {
        fd = ctx.touch_handler.fd;
    }
    
    struct input_event ev;
    bool is_touching = false;
    ImVec2 touch_pos = ImVec2(0, 0);
    
    while (read(fd, &ev, sizeof(ev)) > 0) {
        if (ev.type == EV_ABS) {
            if (ev.code == ABS_MT_TRACKING_ID && ev.value >= 0) {
                is_touching = true;
            } else if (ev.code == ABS_MT_POSITION_X) {
                touch_pos.y = ev.value;
            } else if (ev.code == ABS_MT_POSITION_Y) {
                touch_pos.x = ev.value;
            }
        }
    }
    
    // Normalize coordinates like touch handler does
    if (is_touching) {
        ImVec2 normalized_pos = ImVec2(SCREEN_WIDTH - touch_pos.x, touch_pos.y);
        
        if (!ctx.admin_was_touching) {
            ctx.admin_touch_start_pos = normalized_pos;
        }
    } else {
        // Touch released - check if it was on a button
        if (ctx.admin_was_touching) {
            ImVec2 start_pos = ctx.admin_touch_start_pos;
            
            // Check back button
            if (IsInPasswordBackButton(start_pos.x, start_pos.y)) {
                ctx.admin_password_buffer.clear();
                ctx.ChangeState(STATE_WAITING_CARD);
                ctx.admin_was_touching = false;
                return;
            }
            
            // Check keypad buttons (1-9)
            for (int digit = 1; digit <= 9; digit++) {
                if (IsInKeypadButton(start_pos.x, start_pos.y, digit)) {
                    if (ctx.admin_password_buffer.length() < 10) {
                        ctx.admin_password_buffer += std::to_string(digit);
                        printf("🔐 PIN: %s\n", ctx.admin_password_buffer.c_str());
                    }
                    
                    // Auto-validate when correct number of digits
                    if (ctx.admin_password_buffer.length() == ADMIN_PASSWORD.length()) {
                        if (ctx.admin_password_buffer == ADMIN_PASSWORD) {
                            ctx.admin_displayed_rfid.clear();
                            ctx.ChangeState(STATE_ADMIN);
                        } else {
                            ctx.message = "Wrong PIN";
                            ctx.admin_password_buffer.clear();
                            ctx.ChangeState(STATE_ERROR);
                        }
                    }
                    ctx.admin_was_touching = false;
                    return;
                }
            }
        }
    }
    
    ctx.admin_was_touching = is_touching;
}

void HandleAdminState(AppContext& ctx, float delta_time) {
    // Poll RFID reader and show UID when card is presented
    RFIDData rfid_data = ctx.rfid_reader.Poll();
    if (rfid_data.valid) {
        ctx.admin_displayed_rfid = rfid_data.uid;
        // Treat card as present so waiting screen doesn't auto-process while it's held
        ctx.last_processed_rfid_uid = rfid_data.uid;
        ctx.rfid_card_present = true;
        ctx.rfid_no_data_frames = 0;
    }

    // Detect back button using same pattern as admin password
    int fd = -1;
    if (ctx.touch_handler.fd < 0) {
        fd = open(TOUCH_DEV_PATH, O_RDONLY | O_NONBLOCK);
        if (fd < 0) return;
    } else {
        fd = ctx.touch_handler.fd;
    }
    
    struct input_event ev;
    bool is_touching = false;
    ImVec2 touch_pos = ImVec2(0, 0);
    
    while (read(fd, &ev, sizeof(ev)) > 0) {
        if (ev.type == EV_ABS) {
            if (ev.code == ABS_MT_TRACKING_ID && ev.value >= 0) {
                is_touching = true;
            } else if (ev.code == ABS_MT_POSITION_X) {
                touch_pos.y = ev.value;
            } else if (ev.code == ABS_MT_POSITION_Y) {
                touch_pos.x = ev.value;
            }
        }
    }
    
    if (is_touching) {
        ImVec2 normalized_pos = ImVec2(SCREEN_WIDTH - touch_pos.x, touch_pos.y);
        if (!ctx.admin_was_touching) {
            ctx.admin_touch_start_pos = normalized_pos;
        }
    } else {
        if (ctx.admin_was_touching) {
            // Check back button
            if (IsInAdminBackButton(ctx.admin_touch_start_pos.x, ctx.admin_touch_start_pos.y)) {
                ctx.ChangeState(STATE_WAITING_CARD);
            }
        }
    }
    
    ctx.admin_was_touching = is_touching;
}

void HandleSignatureState(AppContext& ctx, float delta_time) {
    bool clear_pressed = false;
    bool submit_pressed = false;
    bool cancel_pressed = false;
    ctx.touch_handler.ProcessInput(
        ctx.signature_strokes, 
        ctx.current_stroke, 
        ctx.is_drawing, 
        clear_pressed,
        submit_pressed,
        cancel_pressed
    );
    
    if (clear_pressed) {
        ctx.ClearSignature();
        printf("🗑️ Signature cleared\n");
    }
    
    if (submit_pressed) {
        if (!ctx.signature_strokes.empty()) {
            printf("📝 Submitting signature...\n");
            
            // CRITICAL: Store the UID before sending, then clear pending_rfid_uid
            // to prevent any duplicate processing if the card is still in range
            std::string uid_to_send = ctx.pending_rfid_uid;
            ctx.pending_rfid_uid.clear();  // Clear immediately - this UID is now being processed
            
            // Convert signature to SVG string
            std::string signature_svg = SignatureToBase64PNG(ctx.signature_strokes, 550, 270);
            
            // Send to API
            if (ctx.api_client.SendClockInWithSignature(uid_to_send, signature_svg)) {
                printf("✅ Clock-in with signature successful\n");
                
                // Success! Turn LED back to GREEN
                ctx.api_client.SendDirectCommand("buzz");
                usleep(200000);
                ctx.api_client.SendDirectCommand("red_off");
                usleep(200000);
                ctx.api_client.SendDirectCommand("green_on");
                
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

    if (cancel_pressed) {
        printf("↩️ Signature cancelled\n");
        ctx.pending_rfid_uid.clear();
        ctx.Reset();
        // Return to waiting state and restore LED
        ctx.api_client.SendDirectCommand("green_on");
        usleep(50000);
        ctx.api_client.SendDirectCommand("red_off");
        ctx.ChangeState(STATE_WAITING_CARD);
    }
}

void HandleSuccessState(AppContext& ctx, float delta_time) {
    ctx.state_timer += delta_time;
    
    if (ctx.state_timer >= ctx.message_duration) {
        // CRITICAL: Clear pending UID BEFORE returning to waiting state
        // This ensures no duplicate transactions if card is still in range
        ctx.pending_rfid_uid.clear();
        
        ctx.Reset();
        
        // Returning to waiting state - ensure GREEN is on
        ctx.api_client.SendDirectCommand("green_on");
        usleep(50000);
        ctx.api_client.SendDirectCommand("red_off");
        
        ctx.ChangeState(STATE_WAITING_CARD);
    }
}

void HandleErrorState(AppContext& ctx, float delta_time) {
    ctx.state_timer += delta_time;
    
    if (ctx.state_timer >= ctx.message_duration) {
        // CRITICAL: Clear pending UID BEFORE returning to waiting state
        ctx.pending_rfid_uid.clear();
        
        ctx.Reset();
        
        // Returning to waiting state - ensure GREEN is on
        ctx.api_client.SendDirectCommand("green_on");
        usleep(50000);
        ctx.api_client.SendDirectCommand("red_off");
        
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
            
        case STATE_ADMIN_PASSWORD:
            HandleAdminPasswordState(ctx, delta_time);
            break;

        case STATE_ADMIN:
            HandleAdminState(ctx, delta_time);
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

        case STATE_ADMIN_PASSWORD:
            ctx.ui_renderer.RenderAdminPasswordScreen(draw_list, ctx.admin_password_buffer);
            break;

        case STATE_ADMIN:
            ctx.ui_renderer.RenderAdminScreen(draw_list, ctx.admin_displayed_rfid);
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
// default is green
    ctx.api_client.SendDirectCommand("green_on");
    usleep(50000);
    ctx.api_client.SendDirectCommand("red_off");


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