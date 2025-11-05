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

void ProcessTouchInput(ImGuiIO& io, std::vector<ImVec2>& drawPoints, bool& isDrawing)
{
    static int fd = -1;
    static TouchState touch;

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
                    touch.slots[touch.current_slot].y = ev.value; // swapped axes
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

if (active_slot >= 0)
{
    // Map raw touchscreen to screen pixels (as in your printf)
    int draw_x = SCREEN_WIDTH - touch.slots[active_slot].x; // flipped X
    int draw_y = touch.slots[active_slot].y;              // raw Y

    io.MousePos = ImVec2(draw_x, draw_y);
    io.MouseDown[0] = true;

    if (updated)
    {
        drawPoints.push_back(ImVec2(draw_x, draw_y)); // add point using flipped coords
        isDrawing = true;

        printf("📍 Touch[%d] pos=(%d,%d)\n",
               active_slot,
               draw_x,
               draw_y);
    }
}
    else
    {
        io.MouseDown[0] = false;
        isDrawing = false;
    }
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

    GLFWwindow* window = glfwCreateWindow(SCREEN_WIDTH, SCREEN_HEIGHT, "STM32MP1 Touch Draw", NULL, NULL);
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
    ImGui::StyleColorsDark();

    ImGui_ImplGlfw_InitForOpenGL(window, false);
    ImGui_ImplOpenGL3_Init(glsl_version);

    std::vector<ImVec2> drawPoints;
    bool isDrawing = false;
    int tap_count = 0;
    ImVec4 clear_color = ImVec4(0.1f, 0.1f, 0.15f, 1.0f);

    while (!glfwWindowShouldClose(window))
    {
        glfwPollEvents();

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();

        // Update touchscreen input
        ProcessTouchInput(io, drawPoints, isDrawing);

        // Draw points
        ImGui::GetBackgroundDrawList()->AddPolyline(drawPoints.data(), drawPoints.size(), IM_COL32(255,255,0,255), false, 4.0f);

        ImGui::Begin("Touch Debug");
        ImGui::Text("Touchscreen test - STM32MP1");
        ImGui::Separator();
        ImGui::Text("Pos: (%.1f, %.1f)", io.MousePos.x, io.MousePos.y);
        ImGui::Text("Touch: %s", io.MouseDown[0] ? "DOWN" : "UP");
        ImGui::Spacing();

        if (ImGui::Button("TAP ME!", ImVec2(300, 80)))
        {
            tap_count++;
            printf("🟢 Button tapped (%d)\n", tap_count);
        }
        ImGui::Text("Tap count: %d", tap_count);
        ImGui::End();

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
