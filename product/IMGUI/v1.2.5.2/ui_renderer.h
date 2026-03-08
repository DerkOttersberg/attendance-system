#ifndef UI_RENDERER_H
#define UI_RENDERER_H

#include "imgui.h"
#include <vector>
#include <string>
#include <cmath>

class UIRenderer {
public:
    void RenderWaitingScreen(ImDrawList* draw_list) {
        // Large centered text
        const char* text = "Please scan your RFID card";
        ImVec2 text_size = ImGui::CalcTextSize(text);
        ImVec2 center = ImVec2(400, 240);
        ImVec2 text_pos = ImVec2(center.x - text_size.x / 2, center.y - text_size.y / 2);
        
        // Animated circle
        float time = ImGui::GetTime();
        float radius = 80 + sin(time * 2.0f) * 10.0f;
        draw_list->AddCircle(center, radius, IM_COL32(100, 150, 250, 255), 32, 3.0f);
        
        // Text
        draw_list->AddText(ImGui::GetFont(), 32, text_pos, IM_COL32(50, 50, 50, 255), text);
    }
    
    void RenderSignatureScreen(ImDrawList* draw_list, 
                               const std::string& user_name,
                               const std::vector<std::vector<ImVec2>>& strokes,
                               const std::vector<ImVec2>& currentStroke) {
        // Header
        std::string header = "Welcome, " + user_name + "!";
        ImVec2 header_size = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, header.c_str());
        ImVec2 header_pos = ImVec2(400 - header_size.x / 2, 30);
        draw_list->AddText(ImGui::GetFont(), 28, header_pos, IM_COL32(50, 50, 50, 255), header.c_str());
        
        // Instruction
        const char* instruction = "Please sign below to clock in";
        ImVec2 instr_size = ImGui::CalcTextSize(instruction);
        ImVec2 instr_pos = ImVec2(400 - instr_size.x / 2, 80);
        draw_list->AddText(instr_pos, IM_COL32(100, 100, 100, 255), instruction);
        
        // Signature area
        ImVec2 sig_min = ImVec2(50, 150);
        ImVec2 sig_max = ImVec2(600, 420);
        draw_list->AddRectFilled(sig_min, sig_max, IM_COL32(250, 250, 250, 255));
        draw_list->AddRect(sig_min, sig_max, IM_COL32(200, 200, 200, 255), 0.0f, 0, 2.0f);
        
        // Draw signature strokes
        for (const auto& stroke : strokes) {
            if (stroke.size() > 1) {
                draw_list->AddPolyline(stroke.data(), stroke.size(), 
                                      IM_COL32(0, 0, 0, 255), false, 3.0f);
            }
        }
        
        if (currentStroke.size() > 1) {
            draw_list->AddPolyline(currentStroke.data(), currentStroke.size(), 
                                  IM_COL32(0, 0, 0, 255), false, 3.0f);
        }
        
        // Clear button
        draw_list->AddRectFilled(ImVec2(650, 10), ImVec2(790, 70), 
                                IM_COL32(220, 220, 220, 255), 8.0f);
        draw_list->AddRect(ImVec2(650, 10), ImVec2(790, 70), 
                          IM_COL32(100, 100, 100, 255), 8.0f, 0, 2.0f);
        
        const char* clear_text = "CLEAR";
        ImVec2 clear_size = ImGui::CalcTextSize(clear_text);
        ImVec2 clear_pos = ImVec2(720 - clear_size.x / 2, 40 - clear_size.y / 2);
        draw_list->AddText(clear_pos, IM_COL32(0, 0, 0, 255), clear_text);
        
        // Submit button (bottom right)
        draw_list->AddRectFilled(ImVec2(650, 400), ImVec2(790, 460), 
                                IM_COL32(100, 200, 100, 255), 8.0f);
        draw_list->AddRect(ImVec2(650, 400), ImVec2(790, 460), 
                          IM_COL32(50, 150, 50, 255), 8.0f, 0, 2.0f);
        
        const char* submit_text = "SUBMIT";
        ImVec2 submit_size = ImGui::CalcTextSize(submit_text);
        ImVec2 submit_pos = ImVec2(720 - submit_size.x / 2, 430 - submit_size.y / 2);
        draw_list->AddText(submit_pos, IM_COL32(255, 255, 255, 255), submit_text);
    }
    
    void RenderSuccessScreen(ImDrawList* draw_list, 
                            const std::string& user_name,
                            const std::string& action) {
        ImVec2 center = ImVec2(400, 200);
        
        // Checkmark circle
        draw_list->AddCircleFilled(center, 60, IM_COL32(100, 200, 100, 255));
        
        // Checkmark
        ImVec2 check_start = ImVec2(center.x - 25, center.y);
        ImVec2 check_mid = ImVec2(center.x - 5, center.y + 20);
        ImVec2 check_end = ImVec2(center.x + 30, center.y - 25);
        draw_list->AddLine(check_start, check_mid, IM_COL32(255, 255, 255, 255), 6.0f);
        draw_list->AddLine(check_mid, check_end, IM_COL32(255, 255, 255, 255), 6.0f);
        
        // Message
        std::string message = (action == "clock_in") ? 
            "Clocked In Successfully!" : "Clocked Out Successfully!";
        std::string name_msg = user_name;
        
        ImVec2 msg_size = ImGui::GetFont()->CalcTextSizeA(32, FLT_MAX, 0.0f, message.c_str());
        ImVec2 msg_pos = ImVec2(400 - msg_size.x / 2, 300);
        draw_list->AddText(ImGui::GetFont(), 32, msg_pos, IM_COL32(50, 50, 50, 255), message.c_str());
        
        ImVec2 name_size = ImGui::GetFont()->CalcTextSizeA(24, FLT_MAX, 0.0f, name_msg.c_str());
        ImVec2 name_pos = ImVec2(400 - name_size.x / 2, 350);
        draw_list->AddText(ImGui::GetFont(), 24, name_pos, IM_COL32(100, 100, 100, 255), name_msg.c_str());
    }
    
    void RenderErrorScreen(ImDrawList* draw_list, const std::string& message) {
        ImVec2 center = ImVec2(400, 200);
        
        // Error circle
        draw_list->AddCircleFilled(center, 60, IM_COL32(220, 80, 80, 255));
        
        // X mark
        float x_size = 40;
        draw_list->AddLine(ImVec2(center.x - x_size/2, center.y - x_size/2),
                          ImVec2(center.x + x_size/2, center.y + x_size/2),
                          IM_COL32(255, 255, 255, 255), 6.0f);
        draw_list->AddLine(ImVec2(center.x + x_size/2, center.y - x_size/2),
                          ImVec2(center.x - x_size/2, center.y + x_size/2),
                          IM_COL32(255, 255, 255, 255), 6.0f);
        
        // Error message
        ImVec2 msg_size = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, message.c_str());
        ImVec2 msg_pos = ImVec2(400 - msg_size.x / 2, 300);
        draw_list->AddText(ImGui::GetFont(), 28, msg_pos, IM_COL32(220, 80, 80, 255), message.c_str());
    }
};

#endif
