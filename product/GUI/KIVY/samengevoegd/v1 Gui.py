# kivy test enkel GUI
import kivy
from kivy.app import App
from kivy.uix.label import Label
# Optional: Set the window to match your display size if it doesn't auto-detect
# from kivy.core.window import Window
# Window.size = (800, 480) 

class SimpleApp(App):
    """A minimal Kivy application to test the display."""
    def build(self):
        return Label(text='Kivy Works! Ready for Touch', font_size='40sp')

if __name__ == '__main__':
    SimpleApp().run()