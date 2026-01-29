# signature drawing test touchscreen working

import kivy
from kivy.app import App
from kivy.uix.widget import Widget
from kivy.uix.button import Button
from kivy.graphics import Color, Line
from kivy.uix.floatlayout import FloatLayout
from kivy.core.window import Window
from kivy.config import Config
import random

# Ensure the app runs in the correct Kivy version (or compatible)
kivy.require('2.0.0')

# --- INPUT FIX for STM32MP157F-DK2 Touchscreen ---
# CRITICAL: This must be done BEFORE any other Kivy imports or Window operations

# The correct line comes from mouse emulation, the mirrored line from mtdev touch
# Solution: Keep mouse, disable mtdev by pointing it to non-existent device

# Disable mtdev touch provider by setting it to a device that doesn't exist
Config.set('input', 'mtdev_%(name)s', 'probesysfs,provider=mtdev,match=/dev/input/event999')

# Ensure mouse provider is enabled (this gives us the correct line)
Config.set('input', 'mouse', 'mouse')

# Write config changes
Config.write()
# -------------------------------------------------

# --- Window Size Setting ---
# Make the window fullscreen
Window.fullscreen = 'auto'  # or use True for forced fullscreen
Window.borderless = True
# ---------------------------


class DrawingWidget(Widget):
    """
    A custom Kivy widget that handles touch events to draw lines on its canvas.
    """
    def on_touch_down(self, touch):
        """
        Called when a finger or mouse button touches the surface.
        Starts a new line with a random color.
        
        FILTER: Only accept 'mouse' provider events, ignore 'mtdev'
        """
        # CRITICAL FIX: Only accept mouse events (correct line), reject mtdev (mirrored line)
        # Check if device attribute exists and is 'mouse'
        if not (hasattr(touch, 'device') and touch.device == 'mouse'):
            return False  # Ignore everything except mouse events
        
        # Ensure only touches within this widget are processed
        if self.collide_point(*touch.pos):
            # Pick a random vibrant color
            r = random.random()
            g = random.random()
            b = random.random()
            
            with self.canvas:
                # Add a Color instruction
                Color(r, g, b, 1.0)
                # Start a new Line instruction
                touch.ud['line'] = Line(points=(touch.x, touch.y), width=2)
            
            # Returning True consumes the touch event. 
            return True
        return super().on_touch_down(touch)

    def on_touch_move(self, touch):
        """
        Called when a touch moves across the surface.
        Adds the current position to the active line.
        
        FILTER: Only accept 'mouse' provider events, ignore 'mtdev'
        """
        # CRITICAL FIX: Only accept mouse events
        if not (hasattr(touch, 'device') and touch.device == 'mouse'):
            return False
        
        if self.collide_point(*touch.pos):
            if 'line' in touch.ud:
                # Add the new point to the current line
                touch.ud['line'].points += [touch.x, touch.y]
            # Consuming the event here too
            return True
        return super().on_touch_move(touch)

    def clear_canvas(self):
        """
        Clears all drawing instructions from the widget's canvas.
        """
        self.canvas.clear()
        
class DrawingApp(App):
    """
    The main application class.
    """
    def build(self):
        # Use a FloatLayout to position the drawing area and the button
        root = FloatLayout()

        # 1. Create the Drawing Widget
        self.drawing_widget = DrawingWidget(size_hint=(1, 1))
        root.add_widget(self.drawing_widget)

        # 2. Create the Clear Button (Bottom Right)
        clear_button = Button(
            text="Clear Canvas",
            size_hint=(0.2, 0.08),
            pos_hint={'x': 0.75, 'y': 0.02}, 
            background_color=(0.8, 0.2, 0.2, 1) # Red color
        )
        clear_button.bind(on_press=lambda instance: self.drawing_widget.clear_canvas())
        root.add_widget(clear_button)
        
        # 3. Create the Close Button (Top Right)
        close_button = Button(
            text="X",
            size_hint=(0.1, 0.08), 
            pos_hint={'right': 0.98, 'top': 0.98}, # Positioned top right
            background_color=(0.9, 0.1, 0.1, 1), # Bright red
            font_size='20sp'
        )
        # Bind the button press to the application's stop method
        close_button.bind(on_press=App.get_running_app().stop)
        root.add_widget(close_button)
        
        # Set a solid white background color for the drawing area
        Window.clearcolor = (1, 1, 1, 1)

        return root

if __name__ == '__main__':
    DrawingApp().run()