from picographics import PicoGraphics, DISPLAY_TUFTY_2040, PEN_RGB332
from pimoroni import Button
from os import listdir, remove
import machine
import time
import gc


# Check if an app was selected before reboot
try:
    with open("launch.txt", "r") as f:
        app_to_launch = f.read().strip()

    remove("launch.txt")

    if app_to_launch:
        gc.collect()
        __import__(app_to_launch.replace(".py", ""))
        while True:
            pass

except OSError:
    pass


display = PicoGraphics(
    display=DISPLAY_TUFTY_2040,
    pen_type=PEN_RGB332,
    rotate=180
)


def get_applications():
    applications = []

    for file in listdir():
        if file.endswith(".py") and file not in ("main.py", "settings.py"):
            title = " ".join(
                [v[:1].upper() + v[1:] for v in file[:-3].split("_")]
            )

            applications.append({
                "file": file,
                "title": title
            })

    return sorted(applications, key=lambda x: x["title"])


def launch_application(application):
    with open("launch.txt", "w") as f:
        f.write(application["file"])

    machine.reset()


applications = get_applications()


button_up = Button(22, invert=False)
button_down = Button(6, invert=False)
button_a = Button(7, invert=False)


display.set_backlight(1.0)

selected_pen = display.create_pen(255, 255, 255)
unselected_pen = display.create_pen(80, 80, 100)
background_pen = display.create_pen(50, 50, 70)


selected_item = 0
scroll_position = 0
target_scroll_position = 0


while True:

    if button_up.read():
        target_scroll_position -= 1
        if target_scroll_position < 0:
            target_scroll_position = len(applications) - 1

    if button_down.read():
        target_scroll_position += 1
        if target_scroll_position >= len(applications):
            target_scroll_position = 0

    if button_a.read():
        launch_application(applications[selected_item])

    display.set_pen(background_pen)
    display.clear()

    scroll_position += (target_scroll_position - scroll_position) / 5

    selected_item = round(target_scroll_position)

    for index, application in enumerate(applications):

        y = 100 + int((index - scroll_position) * 30)

        pen = selected_pen if index == selected_item else unselected_pen

        display.set_pen(pen)
        display.text(
            application["title"],
            20,
            y,
            -1,
            3
        )

    display.update()
