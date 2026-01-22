import kivy
from kivy.app import App
from kivy.uix.widget import Widget
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.uix.floatlayout import FloatLayout
from kivy.graphics import Color, Line, Rectangle
from kivy.core.window import Window
from kivy.clock import Clock
from kivy.config import Config
import threading
import socket
from shared import HOST, PORT, recv_json

kivy.require("2.0.0")

# Touchscreen fix
Config.set('input', 'mtdev_%(name)s', 'probesysfs,provider=mtdev,match=/dev/input/event999')
Config.set('input', 'mouse', 'mouse')
Config.write()

Window.fullscreen = 'auto'
Window.borderless = True
Window.clearcolor = (1, 1, 1, 1)

SIGNATURE_TIMEOUT = 30  # seconds

# ================= Smooth Drawing Widget =================
class DrawingWidget(Widget):
    def on_touch_down(self, touch):
        if not (hasattr(touch, 'device') and touch.device == 'mouse'):
            return False
        if self.collide_point(*touch.pos):
            r, g, b = 0, 0, 0
            with self.canvas:
                Color(r, g, b, 1.0)
                touch.ud['line'] = Line(points=(touch.x, touch.y), width=2)
            return True
        return super().on_touch_down(touch)

    def on_touch_move(self, touch):
        if not (hasattr(touch, 'device') and touch.device == 'mouse'):
            return False
        if self.collide_point(*touch.pos) and 'line' in touch.ud:
            touch.ud['line'].points += [touch.x, touch.y]
            return True
        return super().on_touch_move(touch)

    def clear_canvas(self):
        self.canvas.clear()

# ================= Frontend App =================
class FrontendApp(App):
    def build(self):
        self.root_layout = FloatLayout()

        # Waiting Screen
        self.status_label = Label(text="Waiting for RFID card...", font_size='48sp', pos_hint={'center_x':0.5, 'center_y':0.6})
        self.user_label = Label(text="", font_size='36sp', pos_hint={'center_x':0.5, 'center_y':0.5})
        self.root_layout.add_widget(self.status_label)
        self.root_layout.add_widget(self.user_label)

        # Signature Screen (hidden initially)
        self.signature_widget = DrawingWidget(size_hint=(1, 1))
        self.signature_widget.opacity = 0
        self.signature_widget.disabled = True
        self.root_layout.add_widget(self.signature_widget)

        clear_btn = Button(text='Clear', size_hint=(0.2,0.1), pos_hint={'x':0.05,'y':0.05})
        clear_btn.bind(on_press=lambda x:self.signature_widget.clear_canvas())
        self.root_layout.add_widget(clear_btn)

        submit_btn = Button(text='Submit', size_hint=(0.2,0.1), pos_hint={'x':0.75,'y':0.05})
        submit_btn.bind(on_press=self.submit_signature)
        self.root_layout.add_widget(submit_btn)

        # Start listening to backend
        threading.Thread(target=self.backend_listener, daemon=True).start()

        return self.root_layout

    # =============== Backend Listener ==================
    def backend_listener(self):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.connect((HOST, PORT))
        while True:
            msg = recv_json(sock)
            if not msg:
                continue
            if msg["command"] == "open_signature":
                Clock.schedule_once(lambda dt:self.show_signature_screen(msg["name"], msg["mode"]), 0)

    # =============== UI Updates ==================
    def show_signature_screen(self, name, mode):
        self.status_label.text = f"{name}, please sign ({mode})"
        self.user_label.text = ""
        self.signature_widget.clear_canvas()
        self.signature_widget.opacity = 1
        self.signature_widget.disabled = False

    def submit_signature(self, instance):
        self.signature_widget.clear_canvas()
        self.signature_widget.opacity = 0
        self.signature_widget.disabled = True
        self.status_label.text = "Waiting for RFID card..."
        self.user_label.text = ""

if __name__ == "__main__":
    FrontendApp().run()
