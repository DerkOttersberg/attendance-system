//Signature working
// Clear button working

#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"

#include <GLFW/glfw3.h>
#include <stdio.h>
#include <linux/input.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <vector>

// ====================================================
// CONFIGURATION
// ====================================================

#define TOUCH_DEV_PATH "/dev/input/event1"
#define SCREEN_WIDTH  800
#define SCREEN_HEIGHT 480

// Button area (top-right corner)
#define BUTTON_X 650
#define BUTTON_Y 10
#define BUTTON_W 140
#define BUTTON_H 60

// ====================================================
// MULTITOUCH HANDLER
// ====================================================

struct TouchSlot {
    int x = 0;
    int y = 0;
    bool active = false;
};

struct TouchState {
    TouchSlot slots[10];
    int current_slot = 0;
};

bool isInButtonArea(float x, float y)
{
    return (x >= BUTTON_X && x <= BUTTON_X + BUTTON_W && 
            y >= BUTTON_Y && y <= BUTTON_Y + BUTTON_H);
}

// ====================================================
// TOUCH PROCESSING
// ====================================================

void ProcessTouchInput(std::vector<std::vector<ImVec2>>& strokes, std::vector<ImVec2>& currentStroke, bool& isDrawing, bool& clearPressed)
{
    static int fd = -1;
    static TouchState touch;
    static bool was_touching = false;
    static ImVec2 touch_start_pos = ImVec2(0, 0);

    if (fd < 0)
    {
        fd = open(TOUCH_DEV_PATH, O_RDONLY | O_NONBLOCK);
        if (fd < 0)
        {
            fprintf(stderr, "⚠️ Failed to open %s: %s\n", TOUCH_DEV_PATH, strerror(errno));
            return;
        }
        printf("✅ Touch device opened: %s\n", TOUCH_DEV_PATH);
    }

    struct input_event ev;
    bool updated = false;

    while (read(fd, &ev, sizeof(ev)) > 0)
    {
        if (ev.type == EV_ABS)
        {
            switch (ev.code)
            {
                case ABS_MT_SLOT:
                    touch.current_slot = ev.value;
                    if (touch.current_slot < 0 || touch.current_slot >= 10)
                        touch.current_slot = 0;
                    break;

                case ABS_MT_TRACKING_ID:
                    if (ev.value < 0)
                        touch.slots[touch.current_slot].active = false;
                    else
                        touch.slots[touch.current_slot].active = true;
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

    // Find first active finger
    int active_slot = -1;
    for (int i = 0; i < 10; i++)
    {
        if (touch.slots[i].active)
        {
            active_slot = i;
            break;
        }
    }

    bool is_touching = (active_slot >= 0);

    if (is_touching)
    {
        int draw_x = SCREEN_WIDTH - touch.slots[active_slot].x;
        int draw_y = touch.slots[active_slot].y;
        ImVec2 touch_pos = ImVec2(draw_x, draw_y);

        // New touch started
        if (!was_touching)
        {
            touch_start_pos = touch_pos;
            printf("🟢 Touch started at (%.0f, %.0f)\n", touch_pos.x, touch_pos.y);
        }

        // Only draw if NOT in button area
        if (updated && !isInButtonArea(touch_pos.x, touch_pos.y))
        {
            currentStroke.push_back(touch_pos);
            isDrawing = true;
        }
    }
    else
    {
        // Touch released
        if (was_touching)
        {
            // Check if it's a button tap (started and ended in button area)
            if (isInButtonArea(touch_start_pos.x, touch_start_pos.y))
            {
                clearPressed = true;
                printf("🔴 Clear button pressed!\n");
            }

            // Save stroke if we were drawing
            if (isDrawing && !currentStroke.empty())
            {
                strokes.push_back(currentStroke);
                currentStroke.clear();
                printf("✂️ Stroke saved (%zu total strokes)\n", strokes.size());
            }
            isDrawing = false;
        }
    }

    was_touching = is_touching;
}

// ====================================================
// MAIN
// ====================================================

int main(int, char**)
{
    if (!glfwInit())
    {
        fprintf(stderr, "Failed to initialize GLFW\n");
        return 1;
    }

    const char* glsl_version = "#version 100";
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 2);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
    glfwWindowHint(GLFW_CLIENT_API, GLFW_OPENGL_ES_API);

    GLFWwindow* window = glfwCreateWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "Touch Draw", glfwGetPrimaryMonitor(), NULL);
    if (!window)
    {
        fprintf(stderr, "Failed to create GLFW window\n");
        return 1;
    }

    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    io.MouseDrawCursor = false;

    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init(glsl_version);

    std::vector<std::vector<ImVec2>> strokes;
    std::vector<ImVec2> currentStroke;
    bool isDrawing = false;
    bool clearPressed = false;
    ImVec4 clear_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);

    while (!glfwWindowShouldClose(window))
    {
        glfwPollEvents();

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();

        // Process touch manually
        ProcessTouchInput(strokes, currentStroke, isDrawing, clearPressed);

        // Handle clear button press
        if (clearPressed)
        {
            strokes.clear();
            currentStroke.clear();
            printf("🗑️ Drawing cleared\n");
            clearPressed = false;
        }

        // Draw all strokes on background
        ImDrawList* draw_list = ImGui::GetBackgroundDrawList();
        
        for (const auto& stroke : strokes)
        {
            if (stroke.size() > 1)
            {
                draw_list->AddPolyline(stroke.data(), stroke.size(), 
                                       IM_COL32(0, 0, 0, 255), false, 3.0f);
            }
        }

        if (currentStroke.size() > 1)
        {
            draw_list->AddPolyline(currentStroke.data(), currentStroke.size(), 
                                   IM_COL32(0, 0, 0, 255), false, 3.0f);
        }

        // Draw clear button
        draw_list->AddRectFilled(ImVec2(BUTTON_X, BUTTON_Y), 
                                 ImVec2(BUTTON_X + BUTTON_W, BUTTON_Y + BUTTON_H), 
                                 IM_COL32(220, 220, 220, 255), 8.0f);
        draw_list->AddRect(ImVec2(BUTTON_X, BUTTON_Y), 
                          ImVec2(BUTTON_X + BUTTON_W, BUTTON_Y + BUTTON_H), 
                          IM_COL32(100, 100, 100, 255), 8.0f, 0, 2.0f);
        
        // Button text
        ImVec2 text_size = ImGui::CalcTextSize("CLEAR");
        ImVec2 text_pos = ImVec2(BUTTON_X + (BUTTON_W - text_size.x) / 2, 
                                 BUTTON_Y + (BUTTON_H - text_size.y) / 2);
        draw_list->AddText(text_pos, IM_COL32(0, 0, 0, 255), "CLEAR");

        ImGui::Render();
        int display_w, display_h;
        glfwGetFramebufferSize(window, &display_w, &display_h);
        glViewport(0, 0, display_w, display_h);
        glClearColor(clear_color.x, clear_color.y, clear_color.z, clear_color.w);
        glClear(GL_COLOR_BUFFER_BIT);
        ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
        glfwSwapBuffers(window);
    }

    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();
    glfwDestroyWindow(window);
    glfwTerminate();

    return 0;
}