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
#define TOUCH_X_MIN 0
#define TOUCH_X_MAX 4095
#define TOUCH_Y_MIN 0
#define TOUCH_Y_MAX 4095

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

// ====================================================
// TOUCH PROCESSING
// ====================================================

void ProcessTouchInput(ImGuiIO& io, std::vector<std::vector<ImVec2>>& strokes, std::vector<ImVec2>& currentStroke, bool& isDrawing, bool& blockDrawing)
{
    static int fd = -1;
    static TouchState touch;
    static bool was_touching = false;
    static ImVec2 last_touch_pos = ImVec2(0, 0);

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

        last_touch_pos = ImVec2(draw_x, draw_y);

        // Only draw if not blocked by UI
        if (updated && !blockDrawing)
        {
            currentStroke.push_back(ImVec2(draw_x, draw_y));
            isDrawing = true;
        }
    }
    else
    {
        // Finger lifted - save the stroke
        if (isDrawing && !currentStroke.empty())
        {
            strokes.push_back(currentStroke);
            currentStroke.clear();
            printf("✂️ Stroke saved (%zu total strokes)\n", strokes.size());
        }
        isDrawing = false;
    }

    io.MousePos = last_touch_pos;
    io.MouseDown[0] = is_touching;
    
    if (was_touching && !is_touching)
    {
        io.MouseReleased[0] = true;
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
    io.ConfigFlags |= ImGuiConfigFlags_IsTouchScreen;
    io.MouseDrawCursor = false;

    ImGui_ImplGlfw_InitForOpenGL(window, false);
    ImGui_ImplOpenGL3_Init(glsl_version);

    std::vector<std::vector<ImVec2>> strokes;
    std::vector<ImVec2> currentStroke;
    bool isDrawing = false;
    bool blockDrawing = false;
    ImVec4 clear_color = ImVec4(1.0f, 1.0f, 1.0f, 1.0f);

    while (!glfwWindowShouldClose(window))
    {
        glfwPollEvents();

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();

        // Process touch before UI
        ProcessTouchInput(io, strokes, currentStroke, isDrawing, blockDrawing);

        // Clear button window
        ImGui::SetNextWindowPos(ImVec2(SCREEN_WIDTH - 130, 10));
        ImGui::SetNextWindowSize(ImVec2(120, 70));
        ImGui::Begin("Controls", nullptr, 
                     ImGuiWindowFlags_NoTitleBar | 
                     ImGuiWindowFlags_NoResize | 
                     ImGuiWindowFlags_NoMove | 
                     ImGuiWindowFlags_NoScrollbar |
                     ImGuiWindowFlags_NoCollapse);

        if (ImGui::Button("Clear", ImVec2(110, 50)))
        {
            strokes.clear();
            currentStroke.clear();
            printf("🗑️ Drawing cleared\n");
        }

        // Check if mouse is over the button window
        blockDrawing = ImGui::IsWindowHovered(ImGuiHoveredFlags_AllowWhenBlockedByActiveItem | 
                                               ImGuiHoveredFlags_ChildWindows);

        ImGui::End();

        // Draw all strokes
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