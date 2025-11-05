#!/usr/bin/env python3
"""
RFID Attendance + Smooth Signature Drawing

This version prioritizes *exactly* the same drawing code and performance characteristics
as your standalone "signature drawing test" script while keeping the RFID worker
out of the main thread. Key principles:
 - Signature drawing uses the exact same approach (Line drawn on widget.canvas).
 - Touch input filter is the same (only accept 'mouse' device events) to avoid mirrored mtdev touches.
 - All blocking I/O runs in a separate multiprocessing Process.
 - A background listener thread does a blocking Queue.get() and posts lightweight
   UI updates via Clock.schedule_once() — it does NOT poll on the main thread.
 - While the signature screen is active we remove unnecessary widgets and
   pause other periodic UI updates (like time label) so drawing stays as smooth as possible.

Drop-in replacement for your existing app. Tweak SERIAL_PORT, API_URL, etc. as needed.
"""

# --- Kivy Config (must be set before main kivy imports) ----------------------
from kivy.config import Config
# Ensure touch provider selection matches working script
Config.set('input', 'mtdev_%(name)s', 'probesysfs,provider=mtdev,match=/dev/input/event999')
Config.set('input', 'mouse', 'mouse')
# Cap fps to 60 for stable rendering (optional -- matches your working script behavior)
Config.set('graphics', 'maxfps', '60')
Config.write()
# -----------------------------------------------------------------------------

import kivy
kivy.require('2.0.0')

import multiprocessing
from multiprocessing import Process, Queue
import threading
import time
import logging
import re

from kivy.app import App
from kivy.clock import Clock
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.widget import Widget
from kivy.uix.button import Button
from kivy.uix.label import Label
from kivy.graphics import Color, Line, Rectangle
from kivy.core.window import Window
from kivy.metrics import dp

# Optional: change to your display preferences
Window.clearcolor = (1, 1, 1, 1)
Window.fullscreen = 'auto'
Window.borderless = True

# ============= Configuration ==================================================
SERIAL_PORT = '/dev/ttyRPMSG0'
BAUD_RATE = 115200
API_URL = 'http://10.10.2.86:5000/api/scan'
API_TIMEOUT = 5
SIGNATURE_TIMEOUT = 30
DEBOUNCE_SECONDS = 2
# ==============================================================================

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Try to import serial/requests for worker; allow script to run without them for testing.
try:
    import serial
    import requests
except Exception:
    serial = None
    requests = None

# --------------------- I/O worker (separate process) -------------------------
import json

uid_re = re.compile(r'Card UID:\s+((?:[0-9A-F]{2}\s*)+)', re.I)


def rfid_io_worker(queue: Queue, serial_port: str, baud_rate: int, api_url: str, api_timeout: int):
    """Reads serial, parses UID, hits API, sends results back via queue."""
    def connect_serial():
        if serial is None:
            queue.put(('worker_error', {'error': 'pyserial missing in worker'}))
            time.sleep(2)
            return None
        try:
            conn = serial.Serial(serial_port, baud_rate, timeout=0.1)
            logging.info('Worker connected to serial')
            return conn
        except Exception as e:
            queue.put(('worker_error', {'error': f'serial connect failed: {e}'}))
            time.sleep(2)
            return None

    def parse_uid(line: str):
        m = uid_re.search(line)
        if m:
            return ''.join(m.group(1).split())
        return None

    def send_api(uid: str):
        if requests is None:
            return {'success': False, 'error': 'requests missing in worker'}
        try:
            resp = requests.post(api_url, json={'rfid_uid': uid}, timeout=api_timeout)
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 404:
                return {'success': False, 'error': 'Card not registered'}
            else:
                return {'success': False, 'error': f'API error {resp.status_code}'}
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'API timeout'}
        except Exception as e:
            return {'success': False, 'error': f'Connection failed: {e}'}

    conn = None
    last_uid = None
    last_time = 0

    def should_process(uid: str):
        nonlocal last_uid, last_time
        now = time.time()
        if uid == last_uid and (now - last_time) < DEBOUNCE_SECONDS:
            return False
        last_uid = uid
        last_time = now
        return True

    while True:
        if conn is None or not getattr(conn, 'is_open', True):
            conn = connect_serial()
            if conn is None:
                continue
        try:
            if getattr(conn, 'in_waiting', 0) > 0:
                line = conn.readline().decode('utf-8', errors='ignore').strip()
                if line:
                    uid = parse_uid(line)
                    if uid and should_process(uid):
                        queue.put(('rfid_detected', {'uid': uid}))
                        res = send_api(uid)
                        queue.put(('api_result', {'uid': uid, 'result': res}))
            time.sleep(0.005)
        except Exception as e:
            queue.put(('worker_error', {'error': str(e)}))
            try:
                conn.close()
            except Exception:
                pass
            conn = None
            time.sleep(1)

# ---------------------- Signature drawing (exact approach) -------------------
class SignatureWidget(Widget):
    """Signature drawing widget using same approach as your working script.

    - Draws Lines directly on the widget.canvas (no FBO).
    - Only accepts touch.device == 'mouse' (filters mirrored mtdev).
    - Minimal processing in touch callbacks for maximum responsiveness.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Start with white background drawn in canvas.before so clear() resets to transparent
        with self.canvas.before:
            Color(1, 1, 1, 1)
            self._bg = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._update_bg, size=self._update_bg)

    def _update_bg(self, *a):
        if hasattr(self, '_bg'):
            self._bg.pos = self.pos
            self._bg.size = self.size

    def on_touch_down(self, touch):
        # Accept only mouse provider (matches your working script)
        if not (hasattr(touch, 'device') and getattr(touch, 'device') == 'mouse'):
            return False
        if not self.collide_point(*touch.pos):
            return False

        # Start a new Line in our canvas
        with self.canvas:
            Color(0, 0, 0, 1)
            touch.ud['line'] = Line(points=(touch.x, touch.y), width=2)
        return True

    def on_touch_move(self, touch):
        if not (hasattr(touch, 'device') and getattr(touch, 'device') == 'mouse'):
            return False
        if 'line' in touch.ud and self.collide_point(*touch.pos):
            # Append points directly (very fast)
            touch.ud['line'].points += [touch.x, touch.y]
            return True
        return False

    def on_touch_up(self, touch):
        # consume the event to avoid propagation
        return True

    def clear_signature(self):
        # Clear canvas and redraw white background
        self.canvas.clear()
        with self.canvas.before:
            Color(1, 1, 1, 1)
            self._bg = Rectangle(pos=self.pos, size=self.size)

    def has_signature(self):
        # Rough check: if canvas has more than 1 instruction (bg), we have strokes
        try:
            children = self.canvas.children
            # canvas.children includes items in reverse drawing order; bg is in canvas.before
            # Best-effort heuristic: if any Line exists in canvas, return True
            for c in children:
                if isinstance(c, Line):
                    return True
        except Exception:
            pass
        return False

# ---------------------------- UI widgets ------------------------------------
class RFIDWidget(BoxLayout):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.orientation = 'vertical'
        self.padding = dp(12)
        self.spacing = dp(6)
        with self.canvas.before:
            Color(0.95, 0.95, 0.95, 1)
            self._bg = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._update_bg, size=self._update_bg)

        self.time_label = Label(text='', size_hint=(1, 0.1), font_size='20sp', color=(0.2, 0.2, 0.2, 1))
        self.add_widget(self.time_label)
        self.status_label = Label(text='Waiting for RFID card...', font_size='36sp', size_hint=(1, 0.5), halign='center')
        self.status_label.bind(size=self.status_label.setter('text_size'))
        self.add_widget(self.status_label)
        self.user_label = Label(text='', font_size='28sp', size_hint=(1, 0.3), halign='center')
        self.user_label.bind(size=self.user_label.setter('text_size'))
        self.add_widget(self.user_label)

        self._time_event = Clock.schedule_interval(self._update_time, 1.0)

    def _update_bg(self, *a):
        self._bg.pos = self.pos
        self._bg.size = self.size

    def _update_time(self, dt):
        self.time_label.text = time.strftime('%H:%M:%S - %A, %B %d, %Y')

    def show_waiting(self):
        self.status_label.text = 'Waiting for RFID card...'
        self.user_label.text = ''

    def show_scanning(self, uid):
        self.status_label.text = 'Card Detected'
        self.user_label.text = f'UID: {uid}'

    def show_success(self, message, user_name, department):
        self.status_label.text = message
        self.user_label.text = f'{user_name}\n{department}'

    def show_error(self, message):
        self.status_label.text = '✗ ERROR'
        self.user_label.text = message

    def pause_updates(self):
        if self._time_event:
            self._time_event.cancel()
            self._time_event = None

    def resume_updates(self):
        if not self._time_event:
            self._time_event = Clock.schedule_interval(self._update_time, 1.0)


class SignatureScreen(FloatLayout):
    def __init__(self, on_submit, on_timeout, **kwargs):
        super().__init__(**kwargs)
        self.on_submit = on_submit
        self.on_timeout = on_timeout
        self.timeout_event = None

        with self.canvas.before:
            Color(1, 1, 1, 1)
            self._bg_rect = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._update_bg, size=self._update_bg)

        self.name_label = Label(text='', font_size='32sp', size_hint=(1, 0.12), pos_hint={'x': 0, 'y': 0.88}, color=(0.1, 0.1, 0.1, 1))
        self.add_widget(self.name_label)

        self.signature_widget = SignatureWidget(size_hint=(1, 0.76), pos_hint={'x': 0, 'y': 0.12})
        self.add_widget(self.signature_widget)

        btn_layout = BoxLayout(size_hint=(1, 0.12), pos_hint={'x': 0, 'y': 0})
        clear_btn = Button(text='Clear', size_hint=(0.3, 1))
        submit_btn = Button(text='Submit', size_hint=(0.3, 1))
        cancel_btn = Button(text='Cancel', size_hint=(0.4, 1))
        clear_btn.bind(on_press=lambda *_: self.signature_widget.clear_signature())
        submit_btn.bind(on_press=lambda *_: self._on_submit())
        cancel_btn.bind(on_press=lambda *_: self._on_cancel())
        btn_layout.add_widget(clear_btn)
        btn_layout.add_widget(submit_btn)
        btn_layout.add_widget(cancel_btn)
        self.add_widget(btn_layout)

    def _update_bg(self, *a):
        self._bg_rect.pos = self.pos
        self._bg_rect.size = self.size

    def set_user_name(self, name):
        self.name_label.text = f'Welcome, {name}!'

    def start_timeout(self):
        self.stop_timeout()
        self.timeout_event = Clock.schedule_once(lambda dt: self.on_timeout(), SIGNATURE_TIMEOUT)

    def stop_timeout(self):
        if self.timeout_event:
            self.timeout_event.cancel()
            self.timeout_event = None

    def _on_submit(self):
        if not self.signature_widget.has_signature():
            # brief message overlay
            mv = Widget()
            return
        self.stop_timeout()
        self.on_submit()

    def _on_cancel(self):
        self.stop_timeout()
        self.on_timeout()


# ====================== Main App =============================================
class RFIDApp(App):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.queue = multiprocessing.Queue()
        self.worker = None
        self.listener_thread = None
        self.root_layout = None
        self.rfid_widget = None
        self.signature_screen = None
        self.pending = None
        self._running = True

    def build(self):
        # Start worker process
        self.worker = Process(target=rfid_io_worker, args=(self.queue, SERIAL_PORT, BAUD_RATE, API_URL, API_TIMEOUT), daemon=True)
        self.worker.start()

        # Start listener thread
        self.listener_thread = threading.Thread(target=self._queue_listener, daemon=True)
        self.listener_thread.start()

        # Build UI
        self.root_layout = FloatLayout()
        self.rfid_widget = RFIDWidget(size_hint=(1, 1))
        self.root_layout.add_widget(self.rfid_widget)

        self.signature_screen = SignatureScreen(on_submit=self._on_signature_submit, on_timeout=self._on_signature_timeout)
        # signature_screen is NOT added until needed to reduce overhead

        return self.root_layout

    def on_stop(self):
        self._running = False
        try:
            if self.worker and self.worker.is_alive():
                self.worker.terminate()
                self.worker.join(timeout=1)
        except Exception:
            pass

    def _queue_listener(self):
        # Blocking thread: wait for worker events and schedule UI updates.
        while self._running:
            try:
                evt = self.queue.get()
                if not evt:
                    continue
                t, payload = evt[0], evt[1]
                if t == 'worker_error':
                    Clock.schedule_once(lambda dt, p=payload: self._show_worker_error(p), 0)
                elif t == 'rfid_detected':
                    uid = payload.get('uid')
                    Clock.schedule_once(lambda dt, u=uid: self._on_rfid_detected(u), 0)
                elif t == 'api_result':
                    res = payload.get('result')
                    uid = payload.get('uid')
                    Clock.schedule_once(lambda dt, r=res, u=uid: self._handle_api_result(r, u), 0)
            except Exception as e:
                logging.exception('Listener thread error: %s', e)
                time.sleep(0.2)

    def _show_worker_error(self, payload):
        err = payload.get('error', 'Unknown')
        logging.error('Worker error: %s', err)
        self.rfid_widget.show_error(err)
        Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)

    def _on_rfid_detected(self, uid):
        logging.info('RFID detected %s', uid)
        self.rfid_widget.show_scanning(uid)

    def _handle_api_result(self, result, uid):
        if result.get('success'):
            action = result.get('action', 'unknown')
            user = result.get('user', {})
            name = user.get('name', 'Unknown')
            dept = user.get('department', '')
            if action == 'clock_in':
                self.pending = {'name': name, 'department': dept}
                self._show_signature_screen(name)
            else:
                self.rfid_widget.show_success('\u2713 CLOCKED OUT', name, dept)
                Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)
        else:
            err = result.get('error', 'Unknown')
            if 'not registered' in err.lower():
                err = 'Card Not Registered\nPlease contact administrator'
            self.rfid_widget.show_error(err)
            Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)

    def _show_signature_screen(self, user_name):
        # Pause periodic updates and remove heavier widget(s)
        self.rfid_widget.pause_updates()
        if self.rfid_widget.parent is not None:
            self.root_layout.remove_widget(self.rfid_widget)
        # Prepare and add signature screen
        self.signature_screen.set_user_name(user_name)
        self.signature_screen.signature_widget.clear_signature()
        if self.signature_screen.parent is None:
            self.root_layout.add_widget(self.signature_screen)
        self.signature_screen.start_timeout()

    def _show_rfid_screen(self):
        # Remove signature screen and restore RFID widget
        if self.signature_screen.parent is not None:
            self.signature_screen.stop_timeout()
            self.root_layout.remove_widget(self.signature_screen)
        if self.rfid_widget.parent is None:
            self.root_layout.add_widget(self.rfid_widget)
        self.rfid_widget.resume_updates()
        self.rfid_widget.show_waiting()
        self.pending = None

    def _on_signature_submit(self):
        if not self.pending:
            self._show_rfid_screen()
            return
        name = self.pending.get('name')
        dept = self.pending.get('department')
        logging.info('Signature submitted for %s', name)
        self._show_rfid_screen()
        self.rfid_widget.show_success('\u2713 CLOCKED IN', name, dept)
        Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)

    def _on_signature_timeout(self):
        logging.warning('Signature timeout')
        self._show_rfid_screen()
        self.rfid_widget.show_error('Signature Timeout\nClock-in cancelled')
        Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)


if __name__ == '__main__':
    try:
        multiprocessing.set_start_method('fork')
    except RuntimeError:
        pass
    RFIDApp().run()