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

        // Admin button (reuses same area as clear button in signature screen)
        draw_list->AddRectFilled(ImVec2(650, 10), ImVec2(790, 70), 
                                IM_COL32(200, 180, 100, 255), 8.0f);
        draw_list->AddRect(ImVec2(650, 10), ImVec2(790, 70), 
                          IM_COL32(120, 100, 40, 255), 8.0f, 0, 2.0f);
        const char* admin_text = "ADMIN";
        ImVec2 admin_size = ImGui::CalcTextSize(admin_text);
        ImVec2 admin_pos = ImVec2(720 - admin_size.x / 2, 40 - admin_size.y / 2);
        draw_list->AddText(admin_pos, IM_COL32(0, 0, 0, 255), admin_text);
    }
    
    void RenderAdminPasswordScreen(ImDrawList* draw_list, const std::string& password_buffer) {
        // Draw background
        ImVec2 box_min = ImVec2(50, 50);
        ImVec2 box_max = ImVec2(750, 420);
        draw_list->AddRectFilled(box_min, box_max, IM_COL32(245, 245, 245, 255), 6.0f);
        draw_list->AddRect(box_min, box_max, IM_COL32(200, 200, 200, 255), 6.0f, 0, 2.0f);

        // Title
        const char* title = "Enter Admin PIN";
        ImVec2 title_size = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, title);
        ImVec2 title_pos = ImVec2(400 - title_size.x / 2, 70);
        draw_list->AddText(ImGui::GetFont(), 28, title_pos, IM_COL32(50, 50, 50, 255), title);

        // Display PIN dots
        std::string pin_display;
        for (size_t i = 0; i < password_buffer.length(); i++) {
            pin_display += "*";
        }
        ImVec2 pin_size = ImGui::GetFont()->CalcTextSizeA(32, FLT_MAX, 0.0f, pin_display.c_str());
        ImVec2 pin_pos = ImVec2(400 - pin_size.x / 2, 130);
        draw_list->AddText(ImGui::GetFont(), 32, pin_pos, IM_COL32(50, 50, 50, 255), pin_display.c_str());

        // Draw numeric keypad (1-9)
        for (int digit = 1; digit <= 9; digit++) {
            int row = (digit - 1) / 3;
            int col = (digit - 1) % 3;
            float btn_x = KEYPAD_START_X + col * KEYPAD_SPACING_X;
            float btn_y = KEYPAD_START_Y + row * KEYPAD_SPACING_Y;
            
            ImVec2 btn_min = ImVec2(btn_x, btn_y);
            ImVec2 btn_max = ImVec2(btn_x + KEYPAD_BUTTON_W, btn_y + KEYPAD_BUTTON_H);
            
            draw_list->AddRectFilled(btn_min, btn_max, IM_COL32(220, 220, 220, 255), 6.0f);
            draw_list->AddRect(btn_min, btn_max, IM_COL32(150, 150, 150, 255), 6.0f, 0, 2.0f);
            
            // Create digit string directly to avoid encoding issues
            std::string digit_str = std::to_string(digit);
            ImVec2 digit_size = ImGui::CalcTextSize(digit_str.c_str());
            ImVec2 digit_pos = ImVec2(btn_x + KEYPAD_BUTTON_W/2 - digit_size.x/2, btn_y + KEYPAD_BUTTON_H/2 - digit_size.y/2);
            draw_list->AddText(digit_pos, IM_COL32(0, 0, 0, 255), digit_str.c_str());
        }

        // Back button (top-right)
        draw_list->AddRectFilled(ImVec2(650, 10), ImVec2(790, 70), 
                                IM_COL32(220, 100, 100, 255), 8.0f);
        draw_list->AddRect(ImVec2(650, 10), ImVec2(790, 70), 
                          IM_COL32(180, 50, 50, 255), 8.0f, 0, 2.0f);
        const char* back_text = "BACK";
        ImVec2 back_size = ImGui::CalcTextSize(back_text);
        ImVec2 back_pos = ImVec2(720 - back_size.x / 2, 40 - back_size.y / 2);
        draw_list->AddText(back_pos, IM_COL32(255, 255, 255, 255), back_text);
    }

    void RenderAdminScreen(ImDrawList* draw_list, const std::string& uid) {
        // Simple admin overview: show last seen UID
        const char* header = "Admin Menu";
        ImVec2 header_size = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, header);
        ImVec2 header_pos = ImVec2(400 - header_size.x / 2, 30);
        draw_list->AddText(ImGui::GetFont(), 28, header_pos, IM_COL32(50, 50, 50, 255), header);

        std::string uid_text = "Last card: ";
        uid_text += uid.empty() ? "(none)" : uid;
        ImVec2 uid_pos = ImVec2(50, 120);
        draw_list->AddText(ImGui::GetFont(), 20, uid_pos, IM_COL32(30, 30, 30, 255), uid_text.c_str());

        // Back button (top-right)
        draw_list->AddRectFilled(ImVec2(650, 10), ImVec2(790, 70), 
                                IM_COL32(220, 100, 100, 255), 8.0f);
        draw_list->AddRect(ImVec2(650, 10), ImVec2(790, 70), 
                          IM_COL32(180, 50, 50, 255), 8.0f, 0, 2.0f);
        const char* back_text = "BACK";
        ImVec2 back_size = ImGui::CalcTextSize(back_text);
        ImVec2 back_pos = ImVec2(720 - back_size.x / 2, 40 - back_size.y / 2);
        draw_list->AddText(back_pos, IM_COL32(255, 255, 255, 255), back_text);
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

        // Cancel button (middle right)
        draw_list->AddRectFilled(ImVec2(650, 205), ImVec2(790, 265), 
                    IM_COL32(220, 120, 120, 255), 8.0f);
        draw_list->AddRect(ImVec2(650, 205), ImVec2(790, 265), 
                  IM_COL32(180, 70, 70, 255), 8.0f, 0, 2.0f);
        
        const char* cancel_text = "CANCEL";
        ImVec2 cancel_size = ImGui::CalcTextSize(cancel_text);
        ImVec2 cancel_pos = ImVec2(720 - cancel_size.x / 2, 235 - cancel_size.y / 2);
        draw_list->AddText(cancel_pos, IM_COL32(255, 255, 255, 255), cancel_text);
        
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