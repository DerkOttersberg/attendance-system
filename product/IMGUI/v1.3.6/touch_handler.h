#ifndef TOUCH_HANDLER_H
#define TOUCH_HANDLER_H

#include "imgui.h"
#include <linux/input.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <string.h>
#include <stdio.h>
#include <vector>

#define TOUCH_DEV_PATH "/dev/input/event1"
#define SCREEN_WIDTH  800
#define SCREEN_HEIGHT 480

// Button area for signature screen
#define BUTTON_X 650
#define BUTTON_Y 10
#define BUTTON_W 140
#define BUTTON_H 60

#define SIG_AREA_X 50
#define SIG_AREA_Y 150
#define SIG_AREA_W 550
#define SIG_AREA_H 270

#define SUBMIT_X 650
#define SUBMIT_Y 400
#define SUBMIT_W 140
#define SUBMIT_H 60

#define CANCEL_X 650
#define CANCEL_Y 205
#define CANCEL_W 140
#define CANCEL_H 60


struct TouchSlot {
    int x = 0;
    int y = 0;
    bool active = false;
};

struct TouchState {
    TouchSlot slots[10];
    int current_slot = 0;
};

class TouchHandler {
private:
    TouchState touch;
    bool was_touching;
    ImVec2 touch_start_pos;
    
    bool IsInButtonArea(float x, float y) {
        return (x >= BUTTON_X && x <= BUTTON_X + BUTTON_W && 
                y >= BUTTON_Y && y <= BUTTON_Y + BUTTON_H);
    }

    bool IsInSignatureArea(float x, float y) {
    return (x >= SIG_AREA_X && x <= SIG_AREA_X + SIG_AREA_W && 
            y >= SIG_AREA_Y && y <= SIG_AREA_Y + SIG_AREA_H);
}

    bool IsInSubmitArea(float x, float y) {
    return (x >= SUBMIT_X && x <= SUBMIT_X + SUBMIT_W && 
            y >= SUBMIT_Y && y <= SUBMIT_Y + SUBMIT_H);
}

    bool IsInCancelArea(float x, float y) {
    return (x >= CANCEL_X && x <= CANCEL_X + CANCEL_W && 
            y >= CANCEL_Y && y <= CANCEL_Y + CANCEL_H);
}
    
public:
    int fd;  // Made public so admin handlers can check if device is open
    
    TouchHandler() : fd(-1), was_touching(false), touch_start_pos(0, 0) {}
    
    void ProcessInput(std::vector<std::vector<ImVec2>>& strokes, 
                     std::vector<ImVec2>& currentStroke, 
                     bool& isDrawing, 
                     bool& clearPressed,
                     bool& submitPressed,
                     bool& cancelPressed) {
        if (fd < 0) {
            fd = open(TOUCH_DEV_PATH, O_RDONLY | O_NONBLOCK);
            if (fd < 0) {
                fprintf(stderr, "⚠️ Failed to open %s: %s\n", TOUCH_DEV_PATH, strerror(errno));
                return;
            }
            printf("✅ Touch device ready\n");
        }
        
        struct input_event ev;
        bool updated = false;
        
        while (read(fd, &ev, sizeof(ev)) > 0) {
            if (ev.type == EV_ABS) {
                switch (ev.code) {
                    case ABS_MT_SLOT:
                        touch.current_slot = ev.value;
                        if (touch.current_slot < 0 || touch.current_slot >= 10)
                            touch.current_slot = 0;
                        break;
                    case ABS_MT_TRACKING_ID:
                        touch.slots[touch.current_slot].active = (ev.value >= 0);
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
        
        int active_slot = -1;
        for (int i = 0; i < 10; i++) {
            if (touch.slots[i].active) {
                active_slot = i;
                break;
            }
        }
        
        bool is_touching = (active_slot >= 0);
        
        if (is_touching) {
            int draw_x = touch.slots[active_slot].x;
            //int draw_x = SCREEN_WIDTH - touch.slots[active_slot].x;
            int draw_y = SCREEN_HEIGHT - touch.slots[active_slot].y;
            ImVec2 touch_pos = ImVec2(draw_x, draw_y);
            
            if (!was_touching) {
                touch_start_pos = touch_pos;
            }

            
            
            if (updated && !IsInButtonArea(touch_pos.x, touch_pos.y) && IsInSignatureArea(touch_pos.x, touch_pos.y)) {
                currentStroke.push_back(touch_pos);
                isDrawing = true;
}
        } else {
            if (was_touching) {
                if (IsInButtonArea(touch_start_pos.x, touch_start_pos.y)) {
                    clearPressed = true;
                }
                else if (IsInSubmitArea(touch_start_pos.x, touch_start_pos.y)) {
                    submitPressed = true;  // ADD THIS
                }
                else if (IsInCancelArea(touch_start_pos.x, touch_start_pos.y)) {
                    cancelPressed = true;
                }
    
                if (isDrawing && !currentStroke.empty()) {
                    strokes.push_back(currentStroke);
                    currentStroke.clear();
                    }
            isDrawing = false;
            }
        } 
        was_touching = is_touching;
    }
};

#endif