#include "imgui.h"
#include "imgui_impl_glfw.h"
#include "imgui_impl_opengl3.h"
#include <GLFW/glfw3.h>
#include <stdio.h>

int main(int, char**)
{
    // Initialize GLFW
    if (!glfwInit())
        return 1;

    // GL ES 2.0 + GLSL 100
    const char* glsl_version = "#version 100";
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 2);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 0);
    glfwWindowHint(GLFW_CLIENT_API, GLFW_OPENGL_ES_API);

    // Create window
    GLFWwindow* window = glfwCreateWindow(800, 480, "Touch Demo", NULL, NULL);
    if (window == NULL)
        return 1;
    glfwMakeContextCurrent(window);
    glfwSwapInterval(1);

    // Setup Dear ImGui
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO();
    
    // Touch configuration
    io.ConfigFlags |= ImGuiConfigFlags_IsTouchScreen;
    io.MouseDrawCursor = false;
    
    // Larger UI for touch
    ImGuiStyle& style = ImGui::GetStyle();
    style.TouchExtraPadding = ImVec2(4, 4);
    style.FramePadding = ImVec2(12, 8);
    style.ItemSpacing = ImVec2(16, 12);
    io.FontGlobalScale = 1.8f;
    
    ImGui::StyleColorsDark();
    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init(glsl_version);

    // App state
    int counter = 0;
    float slider_value = 0.5f;
    bool checkbox = false;
    ImVec4 clear_color = ImVec4(0.1f, 0.1f, 0.15f, 1.0f);

    // Main loop
    while (!glfwWindowShouldClose(window))
    {
        glfwPollEvents();

        ImGui_ImplOpenGL3_NewFrame();
        ImGui_ImplGlfw_NewFrame();
        ImGui::NewFrame();

        // Main window (centered, large)
        ImGui::SetNextWindowPos(ImVec2(100, 60), ImGuiCond_FirstUseEver);
        ImGui::SetNextWindowSize(ImVec2(600, 360), ImGuiCond_FirstUseEver);
        
        ImGui::Begin("Touch Test");
        
        ImGui::Text("FPS: %.1f", io.Framerate);
        ImGui::Spacing();
        
        // Show touch status
        if (io.MouseDown[0]) {
            ImGui::TextColored(ImVec4(0.2f, 1.0f, 0.2f, 1.0f), 
                              "TOUCHING at (%.0f, %.0f)", 
                              io.MousePos.x, io.MousePos.y);
        } else {
            ImGui::Text("Tap the screen...");
        }
        
        ImGui::Spacing();
        ImGui::Separator();
        ImGui::Spacing();
        
        // Big button
        if (ImGui::Button("TAP ME!", ImVec2(400, 80))) {
            counter++;
            printf("Button tapped! Count: %d\n", counter);
        }
        ImGui::Text("Taps: %d", counter);
        
        ImGui::Spacing();
        
        // Slider
        ImGui::SliderFloat("Slide", &slider_value, 0.0f, 1.0f);
        
        ImGui::Spacing();
        
        // Checkbox
        ImGui::Checkbox("Check me", &checkbox);
        
        ImGui::End();

        // Rendering
        ImGui::Render();
        int display_w, display_h;
        glfwGetFramebufferSize(window, &display_w, &display_h);
        glViewport(0, 0, display_w, display_h);
        glClearColor(clear_color.x, clear_color.y, clear_color.z, clear_color.w);
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

    return 0;
}