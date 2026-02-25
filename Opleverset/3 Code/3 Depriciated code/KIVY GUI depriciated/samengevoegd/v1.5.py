#!/usr/bin/env python3
#same as 1.4 but a bit smoother

"""
RFID Attendance System with Signature Verification
Combines RFID scanning with signature capture for clock-in
"""

import kivy
from kivy.app import App
from kivy.uix.boxlayout import BoxLayout
from kivy.uix.floatlayout import FloatLayout
from kivy.uix.label import Label
from kivy.uix.button import Button
from kivy.uix.widget import Widget
from kivy.clock import Clock
from kivy.graphics import Color, Rectangle, Line
from kivy.core.window import Window
from kivy.config import Config

import serial
import requests
import re
import logging
import threading
import random
from datetime import datetime
from queue import Queue

# ===== TOUCHSCREEN FIX FOR STM32MP157F-DK2 =====
Config.set('input', 'mtdev_%(name)s', 'probesysfs,provider=mtdev,match=/dev/input/event999')
Config.set('input', 'mouse', 'mouse')
Config.write()
# ===============================================

# Configuration
SERIAL_PORT = '/dev/ttyRPMSG0'
BAUD_RATE = 115200
API_URL = 'http://10.10.2.86:5000/api/scan'
API_TIMEOUT = 5
SIGNATURE_TIMEOUT = 30  # seconds

# Window setup
Window.size = (800, 480)
Window.clearcolor = (0.1, 0.1, 0.15, 1)
Window.fullscreen = 'auto'
Window.borderless = True

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

kivy.require('2.0.0')


class SignatureWidget(Widget):
    """Widget for drawing signatures with touchscreen fix"""
    
    def on_touch_down(self, touch):
        """Handle touch start - CRITICAL: Filter for mouse events only"""
        if not (hasattr(touch, 'device') and touch.device == 'mouse'):
            return False
        
        if self.collide_point(*touch.pos):
            r = random.random()
            g = random.random()
            b = random.random()
            
            with self.canvas:
                Color(r, g, b, 1.0)
                touch.ud['line'] = Line(points=(touch.x, touch.y), width=2)
            
            return True
        return super().on_touch_down(touch)
    
    def on_touch_move(self, touch):
        """Handle touch move - CRITICAL: Filter for mouse events only"""
        if not (hasattr(touch, 'device') and touch.device == 'mouse'):
            return False
        
        # Remove collision check for better performance during drawing
        if 'line' in touch.ud:
            touch.ud['line'].points += [touch.x, touch.y]
            return True
        return super().on_touch_move(touch)
    
    def clear_signature(self):
        """Clear the signature canvas"""
        self.canvas.clear()
    
    def has_signature(self):
        """Check if any drawing exists"""
        return len(self.canvas.children) > 0


class SignatureScreen(FloatLayout):
    """Screen for capturing signatures - simplified for performance"""
    
    def __init__(self, on_submit, on_timeout, **kwargs):
        super().__init__(**kwargs)
        self.on_submit = on_submit
        self.on_timeout = on_timeout
        self.timeout_event = None
        self.time_remaining = SIGNATURE_TIMEOUT
        
        # Simple white background (like original script)
        with self.canvas.before:
            Color(1, 1, 1, 1)
            self.bg_rect = Rectangle(pos=self.pos, size=self.size)
        self.bind(pos=self._update_rect, size=self._update_rect)
        
        # User name label at top (no text_size binding)
        self.name_label = Label(
            text='',
            font_size='40sp',
            size_hint=(1, 0.12),
            pos_hint={'x': 0, 'y': 0.88},
            color=(0.1, 0.1, 0.1, 1),
            bold=True
        )
        self.add_widget(self.name_label)
        
        # Drawing widget (full screen like original, just offset for buttons/label)
        self.signature_widget = SignatureWidget(size_hint=(1, 1))
        self.add_widget(self.signature_widget)
        
        # Clear button (bottom left)
        clear_btn = Button(
            text='Clear',
            size_hint=(0.2, 0.1),
            pos_hint={'x': 0.05, 'y': 0.05},
            background_color=(0.8, 0.4, 0.2, 1),
            font_size='22sp'
        )
        clear_btn.bind(on_press=lambda x: self.signature_widget.clear_signature())
        self.add_widget(clear_btn)
        
        # Submit button (bottom right)
        submit_btn = Button(
            text='Submit',
            size_hint=(0.2, 0.1),
            pos_hint={'x': 0.75, 'y': 0.05},
            background_color=(0.2, 0.6, 0.3, 1),
            font_size='22sp',
            bold=True
        )
        submit_btn.bind(on_press=self._on_submit_pressed)
        self.add_widget(submit_btn)
    
    def _update_rect(self, instance, value):
        self.bg_rect.pos = self.pos
        self.bg_rect.size = self.size
    
    def start_timeout(self):
        """Start the timeout countdown - no visual indicator for performance"""
        self.time_remaining = SIGNATURE_TIMEOUT
        self.timeout_event = Clock.schedule_once(self._timeout_reached, SIGNATURE_TIMEOUT)
    
    def _timeout_reached(self, dt):
        """Called when timeout is reached"""
        self.on_timeout()
    
    def stop_timeout(self):
        """Stop the timeout"""
        if self.timeout_event:
            self.timeout_event.cancel()
            self.timeout_event = None
    
    def _on_submit_pressed(self, instance):
        """Handle submit button press"""
        if not self.signature_widget.has_signature():
            logging.warning("No signature provided")
            return
        
        self.stop_timeout()
        self.on_submit()
    
    def set_user_name(self, name):
        """Set the user name displayed"""
        self.name_label.text = f'Welcome, {name}!'


class RFIDWidget(BoxLayout):
    """Main widget for RFID waiting screen"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.orientation = 'vertical'
        self.padding = 20
        self.spacing = 20
        self.time_clock_event = None  # Initialize timer reference
        
        # Status colors
        self.colors = {
            'waiting': (0.3, 0.3, 0.4, 1),
            'scanning': (0.2, 0.4, 0.6, 1),
            'success': (0.2, 0.6, 0.3, 1),
            'error': (0.7, 0.2, 0.2, 1)
        }
        
        # Background
        with self.canvas.before:
            self.bg_color = Color(*self.colors['waiting'])
            self.bg_rect = Rectangle(pos=self.pos, size=self.size)
        
        self.bind(pos=self._update_rect, size=self._update_rect)
        
        # Time label
        self.time_label = Label(
            text=self._get_time_str(),
            font_size='24sp',
            size_hint=(1, 0.1),
            color=(0.7, 0.7, 0.7, 1)
        )
        self.add_widget(self.time_label)
        
        # Status label
        self.status_label = Label(
            text='Waiting for RFID card...',
            font_size='48sp',
            size_hint=(1, 0.4),
            bold=True,
            halign='center',
            valign='middle'
        )
        self.status_label.bind(size=self.status_label.setter('text_size'))
        self.add_widget(self.status_label)
        
        # User info label
        self.user_label = Label(
            text='',
            font_size='36sp',
            size_hint=(1, 0.3),
            halign='center',
            valign='middle',
            color=(0.9, 0.9, 0.9, 1)
        )
        self.user_label.bind(size=self.user_label.setter('text_size'))
        self.add_widget(self.user_label)
        
        # Details label
        self.details_label = Label(
            text='Place your card on the reader',
            font_size='24sp',
            size_hint=(1, 0.2),
            halign='center',
            valign='middle',
            color=(0.6, 0.6, 0.6, 1)
        )
        self.details_label.bind(size=self.details_label.setter('text_size'))
        self.add_widget(self.details_label)
        
        Clock.schedule_interval(self._update_time, 1)
    
    def _update_rect(self, instance, value):
        self.bg_rect.pos = self.pos
        self.bg_rect.size = self.size
    
    def _get_time_str(self):
        return datetime.now().strftime('%H:%M:%S - %A, %B %d, %Y')
    
    def _update_time(self, dt):
        self.time_label.text = self._get_time_str()
    
    def set_background_color(self, color_name):
        if color_name in self.colors:
            self.bg_color.rgba = self.colors[color_name]
    
    def show_waiting(self):
        self.set_background_color('waiting')
        self.status_label.text = 'Waiting for RFID card...'
        self.user_label.text = ''
        self.details_label.text = 'Place your card on the reader'
    
    def pause_updates(self):
        """Pause time updates for performance"""
        if self.time_clock_event:
            self.time_clock_event.cancel()
            self.time_clock_event = None
    
    def resume_updates(self):
        """Resume time updates"""
        if not self.time_clock_event:
            self.time_clock_event = Clock.schedule_interval(self._update_time, 1)
    
    def show_scanning(self, rfid_uid):
        self.set_background_color('scanning')
        self.status_label.text = 'Card Detected'
        self.user_label.text = f'UID: {rfid_uid}'
        self.details_label.text = 'Processing...'
    
    def show_success(self, message, user_name, department):
        self.set_background_color('success')
        self.status_label.text = message
        self.user_label.text = f'{user_name}\n{department}'
        self.details_label.text = datetime.now().strftime('%H:%M:%S')
    
    def show_error(self, message):
        self.set_background_color('error')
        self.status_label.text = '✗ ERROR'
        self.user_label.text = message
        self.details_label.text = 'Please try again or contact support'


class RFIDApp(App):
    """Main application"""
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.serial_conn = None
        self.rfid_queue = Queue()
        self.last_uid = None
        self.last_scan_time = 0
        self.debounce_seconds = 2
        self.is_running = True
        
        self.current_screen = 'rfid'  # 'rfid' or 'signature'
        self.pending_scan_data = None
    
    def build(self):
        """Build the UI"""
        self.root_layout = FloatLayout()
        
        # RFID screen
        self.rfid_widget = RFIDWidget()
        self.root_layout.add_widget(self.rfid_widget)
        
        # Signature screen (hidden initially)
        self.signature_screen = SignatureScreen(
            on_submit=self._on_signature_submit,
            on_timeout=self._on_signature_timeout
        )
        self.signature_screen.opacity = 0
        self.signature_screen.disabled = True
        self.root_layout.add_widget(self.signature_screen)
        
        # Start RFID thread
        self.rfid_thread = threading.Thread(target=self._rfid_reader_thread, daemon=True)
        self.rfid_thread.start()
        
        # Schedule queue checking
        Clock.schedule_interval(self._check_queue, 0.1)
        
        return self.root_layout
    
    def on_stop(self):
        """Cleanup"""
        self.is_running = False
        if self.serial_conn and self.serial_conn.is_open:
            self.serial_conn.close()
    
    def _connect_serial(self):
        """Connect to M4 core"""
        try:
            self.serial_conn = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=1)
            logging.info(f"Connected to {SERIAL_PORT}")
            return True
        except Exception as e:
            logging.error(f"Failed to connect to serial: {e}")
            return False
    
    def _parse_uid(self, line):
        """Extract UID from M4 output"""
        match = re.search(r'Card UID:\s+((?:[0-9A-F]{2}\s*)+)', line)
        if match:
            uid_bytes = match.group(1).strip().split()
            uid = ''.join(uid_bytes)
            return uid
        return None
    
    def _should_process_scan(self, uid):
        """Check debouncing"""
        import time
        current_time = time.time()
        
        if uid == self.last_uid:
            if (current_time - self.last_scan_time) < self.debounce_seconds:
                return False
        
        self.last_uid = uid
        self.last_scan_time = current_time
        return True
    
    def _send_to_api(self, rfid_uid):
        """Send RFID UID to API"""
        try:
            payload = {'rfid_uid': rfid_uid}
            response = requests.post(API_URL, json=payload, timeout=API_TIMEOUT)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                return {'success': False, 'error': 'Card not registered'}
            else:
                return {'success': False, 'error': f'API error: {response.status_code}'}
        except requests.exceptions.Timeout:
            return {'success': False, 'error': 'API timeout'}
        except Exception as e:
            return {'success': False, 'error': f'Connection failed: {str(e)}'}
    
    def _rfid_reader_thread(self):
        """Background thread for RFID reading"""
        import time
        
        while self.is_running:
            try:
                if not self.serial_conn or not self.serial_conn.is_open:
                    if not self._connect_serial():
                        time.sleep(5)
                        continue
                
                if self.serial_conn.in_waiting > 0:
                    line = self.serial_conn.readline().decode('utf-8', errors='ignore').strip()
                    
                    if line:
                        logging.debug(f"M4: {line}")
                        uid = self._parse_uid(line)
                        
                        if uid:
                            logging.info(f"Detected RFID: {uid}")
                            
                            if self._should_process_scan(uid):
                                self.rfid_queue.put(('scan', uid))
                            else:
                                logging.debug(f"Debounced duplicate scan of {uid}")
                
                time.sleep(0.01)
            except Exception as e:
                logging.error(f"Error in RFID thread: {e}")
                time.sleep(1)
    
    def _check_queue(self, dt):
        """Check queue for RFID events"""
        try:
            while not self.rfid_queue.empty():
                event_type, data = self.rfid_queue.get_nowait()
                
                if event_type == 'scan':
                    self._handle_scan(data)
        except Exception as e:
            logging.error(f"Error processing queue: {e}")
    
    def _handle_scan(self, rfid_uid):
        """Handle RFID scan"""
        # Only process if on RFID screen
        if self.current_screen != 'rfid':
            logging.info("Ignoring scan - not on RFID screen")
            return
        
        self.rfid_widget.show_scanning(rfid_uid)
        
        def api_call():
            result = self._send_to_api(rfid_uid)
            Clock.schedule_once(lambda dt: self._update_ui_with_result(result), 0)
        
        threading.Thread(target=api_call, daemon=True).start()
    
    def _update_ui_with_result(self, result):
        """Update UI with API result"""
        if result.get('success'):
            action = result.get('action', 'unknown')
            user = result.get('user', {})
            user_name = user.get('name', 'Unknown User')
            department = user.get('department', '')
            
            if action == 'clock_in':
                # Show signature screen for clock in
                self.pending_scan_data = {
                    'action': action,
                    'user_name': user_name,
                    'department': department
                }
                self._show_signature_screen(user_name)
            else:
                # Clock out - no signature needed
                self.rfid_widget.show_success('✓ CLOCKED OUT', user_name, department)
                Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)
        else:
            error_msg = result.get('error', 'Unknown error')
            if 'not registered' in error_msg.lower():
                error_msg = 'Card Not Registered\nPlease contact administrator'
            self.rfid_widget.show_error(error_msg)
            Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)
    
    def _show_signature_screen(self, user_name):
        """Switch to signature screen"""
        self.current_screen = 'signature'
        self.signature_screen.set_user_name(user_name)
        self.signature_screen.signature_widget.clear_signature()
        
        # PERFORMANCE: Pause RFID screen updates
        self.rfid_widget.pause_updates()
        
        # Animate transition
        self.rfid_widget.opacity = 0
        self.rfid_widget.disabled = True
        self.signature_screen.opacity = 1
        self.signature_screen.disabled = False
        
        self.signature_screen.start_timeout()
    
    def _show_rfid_screen(self):
        """Switch to RFID screen"""
        self.current_screen = 'rfid'
        
        # PERFORMANCE: Resume RFID screen updates
        self.rfid_widget.resume_updates()
        
        # Animate transition
        self.signature_screen.opacity = 0
        self.signature_screen.disabled = True
        self.rfid_widget.opacity = 1
        self.rfid_widget.disabled = False
    
    def _on_signature_submit(self):
        """Handle signature submission"""
        if not self.pending_scan_data:
            return
        
        logging.info("Signature submitted successfully")
        
        # Show success message
        user_name = self.pending_scan_data['user_name']
        department = self.pending_scan_data['department']
        
        self._show_rfid_screen()
        self.rfid_widget.show_success('✓ CLOCKED IN', user_name, department)
        
        # Return to waiting
        Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)
        
        self.pending_scan_data = None
    
    def _on_signature_timeout(self):
        """Handle signature timeout"""
        logging.warning("Signature timeout - clock in cancelled")
        
        self._show_rfid_screen()
        self.rfid_widget.show_error('Signature Timeout\nClock-in cancelled')
        
        Clock.schedule_once(lambda dt: self.rfid_widget.show_waiting(), 3)
        
        self.pending_scan_data = None


if __name__ == '__main__':
    try:
        RFIDApp().run()
    except KeyboardInterrupt:
        logging.info("Application stopped by user")