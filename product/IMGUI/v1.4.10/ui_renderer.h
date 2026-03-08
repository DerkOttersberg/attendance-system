#ifndef UI_RENDERER_H
#define UI_RENDERER_H

#include "imgui.h"
#include <vector>
#include <string>
#include <cmath>

class UIRenderer {
public:
    ImU32 WithAlpha(ImU32 color, int alpha) {
        return (color & 0x00FFFFFF) | ((ImU32)alpha << 24);
    }

    void DrawSoftPanel(ImDrawList* draw_list, const ImVec2& min, const ImVec2& max, ImU32 fill, float rounding) {
        draw_list->AddRectFilled(min, max, fill, rounding);
        draw_list->AddRect(min, max, IM_COL32(220, 220, 220, 255), rounding, 0, 1.0f);
    }

    void DrawButton(ImDrawList* draw_list,
                    const ImVec2& min,
                    const ImVec2& max,
                    const char* text,
                    ImU32 fill,
                    ImU32 border,
                    ImU32 text_color) {
        const float rounding = 10.0f;
        ImVec2 shadow_min = ImVec2(min.x, min.y + 2.0f);
        ImVec2 shadow_max = ImVec2(max.x, max.y + 2.0f);
        draw_list->AddRectFilled(shadow_min, shadow_max, IM_COL32(0, 0, 0, 25), rounding);
        draw_list->AddRectFilled(min, max, fill, rounding);
        draw_list->AddRect(min, max, border, rounding, 0, 1.0f);
        ImVec2 size = ImGui::CalcTextSize(text);
        ImVec2 pos = ImVec2((min.x + max.x) * 0.5f - size.x * 0.5f,
                            (min.y + max.y) * 0.5f - size.y * 0.5f);
        draw_list->AddText(pos, text_color, text);
    }

    void RenderWaitingScreen(ImDrawList* draw_list) {
        // Theme colors
        const ImU32 COLOR_ACCENT = IM_COL32(42, 120, 200, 255);
        const ImU32 COLOR_ACCENT_DARK = IM_COL32(28, 88, 150, 255);
        const ImU32 COLOR_TEXT = IM_COL32(40, 40, 40, 255);
        const ImU32 COLOR_PANEL = IM_COL32(248, 248, 248, 255);

        // Large centered text
        const char* text = "Scan uw RFID-kaart";
        ImVec2 text_size = ImGui::GetFont()->CalcTextSizeA(32, FLT_MAX, 0.0f, text);
        ImVec2 text_center = ImVec2(400, 330);
        ImVec2 text_pos = ImVec2(text_center.x - text_size.x / 2, text_center.y - text_size.y / 2);

        // Card panel
        DrawSoftPanel(draw_list, ImVec2(60, 120), ImVec2(740, 410), COLOR_PANEL, 16.0f);
        
        // Animated ripple (inspired by CSS lds-ripple)
        ImVec2 circle_center = ImVec2(400, 220);
        float time = (float)ImGui::GetTime();
        const float period = 1.0f;
        const float delay = 0.5f;
        const float min_radius = 6.0f;
        const float max_radius = 60.0f;
        const float thickness = 6.0f;

        for (int i = 0; i < 2; ++i) {
            float t = time - (i * delay);
            float phase = fmodf(t, period);
            if (phase < 0.0f) phase += period;
            float p = phase / period;

            if (p < 0.05f) {
                continue;
            }

            float radius = min_radius + (max_radius - min_radius) * p;
            float alpha = (1.0f - p);
            ImU32 color = WithAlpha(COLOR_ACCENT, (int)(alpha * 255.0f));
            draw_list->AddCircle(circle_center, radius, color, 48, thickness);
        }
        
        // Text
        draw_list->AddText(ImGui::GetFont(), 32, text_pos, COLOR_TEXT, text);

        // Admin button (reuses same area as clear button in signature screen)
        DrawButton(draw_list,
                   ImVec2(650, 10), ImVec2(790, 70),
                   "ADMIN",
                   COLOR_ACCENT,
                   COLOR_ACCENT_DARK,
                   IM_COL32(255, 255, 255, 255));
    }
    
    void RenderAdminPasswordScreen(ImDrawList* draw_list, const std::string& password_buffer, int last_digit, float last_digit_time) {
        // Draw background
        ImVec2 box_min = ImVec2(40, 40);
        ImVec2 box_max = ImVec2(760, 450);
        DrawSoftPanel(draw_list, box_min, box_max, IM_COL32(248, 248, 248, 255), 12.0f);

        // Title
        const char* title = "Voer beheerders-pincode in";
        ImVec2 title_size = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, title);
        ImVec2 title_pos = ImVec2(400 - title_size.x / 2, 70);
        draw_list->AddText(ImGui::GetFont(), 28, title_pos, IM_COL32(40, 40, 40, 255), title);

        // Display PIN dots
        std::string pin_display;
        for (size_t i = 0; i < password_buffer.length(); i++) {
            pin_display += "*";
        }
        ImVec2 pin_size = ImGui::GetFont()->CalcTextSizeA(32, FLT_MAX, 0.0f, pin_display.c_str());
        ImVec2 pin_pos = ImVec2(400 - pin_size.x / 2, 130);
        draw_list->AddText(ImGui::GetFont(), 32, pin_pos, IM_COL32(50, 50, 50, 255), pin_display.c_str());

        // Draw numeric keypad (1-9)
        float now = (float)ImGui::GetTime();
        for (int digit = 1; digit <= 9; digit++) {
            int row = (digit - 1) / 3;
            int col = (digit - 1) % 3;
            float btn_x = KEYPAD_START_X + col * KEYPAD_SPACING_X;
            float btn_y = KEYPAD_START_Y + row * KEYPAD_SPACING_Y;
            
            ImVec2 btn_min = ImVec2(btn_x, btn_y);
            ImVec2 btn_max = ImVec2(btn_x + KEYPAD_BUTTON_W, btn_y + KEYPAD_BUTTON_H);
            ImVec2 btn_center = ImVec2(btn_x + KEYPAD_BUTTON_W * 0.5f, btn_y + KEYPAD_BUTTON_H * 0.5f);
            float base_radius = (KEYPAD_BUTTON_W < KEYPAD_BUTTON_H ? KEYPAD_BUTTON_W : KEYPAD_BUTTON_H) * 0.5f;

            // Press animation: quick pulse on last pressed digit
            float scale = 1.0f;
            if (digit == last_digit) {
                float dt = now - last_digit_time;
                if (dt >= 0.0f && dt < 0.18f) {
                    float t = 1.0f - (dt / 0.18f);
                    scale = 1.0f + 0.12f * t;
                }
            }
            float btn_radius = base_radius * scale;

            ImU32 fill_col = IM_COL32(220, 220, 220, 255);
            ImU32 outline_col = IM_COL32(150, 150, 150, 255);
            if (digit == last_digit && (now - last_digit_time) < 0.18f) {
                fill_col = IM_COL32(200, 220, 235, 255);
                outline_col = IM_COL32(120, 160, 190, 255);
            }

            draw_list->AddCircleFilled(btn_center, btn_radius, fill_col, 32);
            draw_list->AddCircle(btn_center, btn_radius, outline_col, 32, 2.0f);
            
            // Create digit string directly to avoid encoding issues
            std::string digit_str = std::to_string(digit);
            ImVec2 digit_size = ImGui::CalcTextSize(digit_str.c_str());
            ImVec2 digit_pos = ImVec2(btn_x + KEYPAD_BUTTON_W/2 - digit_size.x/2, btn_y + KEYPAD_BUTTON_H/2 - digit_size.y/2);
            draw_list->AddText(digit_pos, IM_COL32(0, 0, 0, 255), digit_str.c_str());
        }

        // Back button (top-right)
        DrawButton(draw_list,
                   ImVec2(650, 10), ImVec2(790, 70),
                   "TERUG",
                   IM_COL32(220, 90, 90, 255),
                   IM_COL32(170, 60, 60, 255),
                   IM_COL32(255, 255, 255, 255));
    }

    void RenderAdminScreen(ImDrawList* draw_list, const std::string& uid) {
        // Simple admin overview: show last seen UID
        const char* header = "Beheermenu";
        ImVec2 header_size = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, header);
        ImVec2 header_pos = ImVec2(400 - header_size.x / 2, 30);
        draw_list->AddText(ImGui::GetFont(), 28, header_pos, IM_COL32(40, 40, 40, 255), header);

        std::string uid_text = "Laatste kaart: ";
        uid_text += uid.empty() ? "(geen)" : uid;
        ImVec2 uid_pos = ImVec2(50, 120);
        draw_list->AddText(ImGui::GetFont(), 20, uid_pos, IM_COL32(40, 40, 40, 255), uid_text.c_str());

        // Back button (top-right)
        DrawButton(draw_list,
                   ImVec2(650, 10), ImVec2(790, 70),
                   "TERUG",
                   IM_COL32(220, 90, 90, 255),
                   IM_COL32(170, 60, 60, 255),
                   IM_COL32(255, 255, 255, 255));
    }

    void RenderAttendanceScreen(ImDrawList* draw_list,
                                const std::string& user_name,
                                const std::vector<std::string>& dates,
                                const std::string& warning,
                                float scroll_offset) {
        // Header
        std::string header = "Aanwezigheid (laatste 30 dagen)";
        ImVec2 header_size = ImGui::GetFont()->CalcTextSizeA(26, FLT_MAX, 0.0f, header.c_str());
        ImVec2 header_pos = ImVec2(400 - header_size.x / 2, 20);
        draw_list->AddText(ImGui::GetFont(), 26, header_pos, IM_COL32(40, 40, 40, 255), header.c_str());

        // User label
        std::string user_label = "Gebruiker: " + (user_name.empty() ? std::string("(onbekend)") : user_name);
        draw_list->AddText(ImVec2(40, 60), IM_COL32(70, 70, 70, 255), user_label.c_str());

        if (!warning.empty()) {
            draw_list->AddText(ImVec2(40, 80), IM_COL32(220, 80, 80, 255), warning.c_str());
        }

        // Table box
        ImVec2 table_min = ImVec2(40, 90);
        ImVec2 table_max = ImVec2(600, 420);
        DrawSoftPanel(draw_list, table_min, table_max, IM_COL32(252, 252, 252, 255), 10.0f);

        // Column headers
        draw_list->AddText(ImVec2(60, 110), IM_COL32(60, 60, 60, 255), "Datum");
        draw_list->AddLine(ImVec2(50, 130), ImVec2(590, 130), IM_COL32(200, 200, 200, 255), 1.0f);

        // Rows
        float start_y = 140.0f;
        float row_h = 24.0f;
        float visible_height = table_max.y - start_y;
        float total_height = row_h * (float)dates.size();
        float max_scroll = total_height > visible_height ? (total_height - visible_height) : 0.0f;
        if (scroll_offset > 0.0f) scroll_offset = 0.0f;
        if (scroll_offset < -max_scroll) scroll_offset = -max_scroll;

        if (dates.empty()) {
            draw_list->AddText(ImVec2(60, start_y), IM_COL32(120, 120, 120, 255), "Geen aanwezigheid in de laatste 30 dagen");
        } else {
            draw_list->PushClipRect(table_min, table_max, true);
            for (int i = 0; i < (int)dates.size(); ++i) {
                float y = start_y + i * row_h + scroll_offset;
                if (y < start_y - row_h || y > table_max.y) {
                    continue;
                }
                draw_list->AddText(ImVec2(60, y), IM_COL32(30, 30, 30, 255), dates[i].c_str());
            }
            draw_list->PopClipRect();

            // Scrollbar
            if (max_scroll > 0.0f) {
                float bar_min_x = table_max.x + 8.0f;
                float bar_max_x = table_max.x + 20.0f;
                float bar_min_y = start_y;
                float bar_max_y = table_max.y;
                draw_list->AddRectFilled(ImVec2(bar_min_x, bar_min_y), ImVec2(bar_max_x, bar_max_y), IM_COL32(230, 230, 230, 255), 6.0f);
                draw_list->AddRect(ImVec2(bar_min_x, bar_min_y), ImVec2(bar_max_x, bar_max_y), IM_COL32(200, 200, 200, 255), 6.0f, 0, 1.0f);

                float thumb_h = (visible_height / total_height) * (bar_max_y - bar_min_y);
                if (thumb_h < 24.0f) thumb_h = 24.0f;
                float scroll_t = (-scroll_offset) / max_scroll;
                if (scroll_t < 0.0f) scroll_t = 0.0f;
                if (scroll_t > 1.0f) scroll_t = 1.0f;
                float thumb_y = bar_min_y + (bar_max_y - bar_min_y - thumb_h) * scroll_t;
                draw_list->AddRectFilled(ImVec2(bar_min_x + 1.0f, thumb_y), ImVec2(bar_max_x - 1.0f, thumb_y + thumb_h), IM_COL32(170, 170, 170, 255), 6.0f);
            }
        }

        // Back button (top-right)
        DrawButton(draw_list,
               ImVec2(650, 10), ImVec2(790, 70),
               "TERUG",
               IM_COL32(220, 90, 90, 255),
               IM_COL32(170, 60, 60, 255),
               IM_COL32(255, 255, 255, 255));

        // Confirm button (bottom-right)
        DrawButton(draw_list,
                   ImVec2(650, 400), ImVec2(790, 460),
                   "BEVESTIG",
                   IM_COL32(90, 190, 120, 255),
                   IM_COL32(60, 150, 90, 255),
                   IM_COL32(255, 255, 255, 255));
    }
    
    void RenderSignatureScreen(ImDrawList* draw_list, 
                               const std::string& user_name,
                               const std::vector<std::vector<ImVec2>>& strokes,
                               const std::vector<ImVec2>& currentStroke) {
        // Header
        std::string header = "Welkom, " + user_name + "!";
        ImVec2 header_size = ImGui::GetFont()->CalcTextSizeA(28, FLT_MAX, 0.0f, header.c_str());
        ImVec2 header_pos = ImVec2(400 - header_size.x / 2, 30);
        draw_list->AddText(ImGui::GetFont(), 28, header_pos, IM_COL32(40, 40, 40, 255), header.c_str());
        
        // Instruction
        const char* instruction = "Zet hieronder uw handtekening om in te klokken";
        ImVec2 instr_size = ImGui::CalcTextSize(instruction);
        ImVec2 instr_pos = ImVec2(400 - instr_size.x / 2, 80);
        draw_list->AddText(instr_pos, IM_COL32(90, 90, 90, 255), instruction);
        
        // Signature area
        ImVec2 sig_min = ImVec2(50, 150);
        ImVec2 sig_max = ImVec2(600, 420);
        DrawSoftPanel(draw_list, sig_min, sig_max, IM_COL32(252, 252, 252, 255), 8.0f);
        
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
        DrawButton(draw_list,
               ImVec2(650, 10), ImVec2(790, 70),
               "WISSEN",
               IM_COL32(235, 235, 235, 255),
               IM_COL32(190, 190, 190, 255),
               IM_COL32(40, 40, 40, 255));

        // Cancel button (middle right)
        DrawButton(draw_list,
               ImVec2(650, 205), ImVec2(790, 265),
               "ANNULEREN",
               IM_COL32(220, 90, 90, 255),
               IM_COL32(170, 60, 60, 255),
               IM_COL32(255, 255, 255, 255));
        
        // Submit button (bottom right)
        DrawButton(draw_list,
                   ImVec2(650, 400), ImVec2(790, 460),
                   "VERSTUREN",
                   IM_COL32(90, 190, 120, 255),
                   IM_COL32(60, 150, 90, 255),
                   IM_COL32(255, 255, 255, 255));
    }
    
    void RenderSuccessScreen(ImDrawList* draw_list, 
                            const std::string& user_name,
                            const std::string& action) {
        ImVec2 center = ImVec2(400, 200);
        
        // Checkmark circle
        draw_list->AddCircleFilled(center, 60, IM_COL32(90, 190, 120, 255));
        
        // Checkmark
        ImVec2 check_start = ImVec2(center.x - 25, center.y);
        ImVec2 check_mid = ImVec2(center.x - 5, center.y + 20);
        ImVec2 check_end = ImVec2(center.x + 30, center.y - 25);
        draw_list->AddLine(check_start, check_mid, IM_COL32(255, 255, 255, 255), 6.0f);
        draw_list->AddLine(check_mid, check_end, IM_COL32(255, 255, 255, 255), 6.0f);
        
        // Message
        std::string message = (action == "clock_in") ? 
            "Succesvol ingeklokt!" : "Succesvol uitgeklokt!";
        std::string name_msg = user_name;
        
        ImVec2 msg_size = ImGui::GetFont()->CalcTextSizeA(32, FLT_MAX, 0.0f, message.c_str());
        ImVec2 msg_pos = ImVec2(400 - msg_size.x / 2, 300);
        draw_list->AddText(ImGui::GetFont(), 32, msg_pos, IM_COL32(40, 40, 40, 255), message.c_str());
        
        ImVec2 name_size = ImGui::GetFont()->CalcTextSizeA(24, FLT_MAX, 0.0f, name_msg.c_str());
        ImVec2 name_pos = ImVec2(400 - name_size.x / 2, 350);
        draw_list->AddText(ImGui::GetFont(), 24, name_pos, IM_COL32(90, 90, 90, 255), name_msg.c_str());
    }
    
    void RenderErrorScreen(ImDrawList* draw_list, const std::string& message) {
        ImVec2 center = ImVec2(400, 200);
        
        // Error circle
        draw_list->AddCircleFilled(center, 60, IM_COL32(220, 90, 90, 255));
        
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
        draw_list->AddText(ImGui::GetFont(), 28, msg_pos, IM_COL32(200, 70, 70, 255), message.c_str());
    }
};

#endif