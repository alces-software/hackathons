import gc

from picographics import PicoGraphics, DISPLAY_TUFTY_2040
from pimoroni import Button
from time import sleep

display = PicoGraphics(display=DISPLAY_TUFTY_2040)

WIDTH, HEIGHT = display.get_bounds()

MAX_NAME_LENGTH = 24

button_up = Button(22, invert=False)
button_down = Button(6, invert=False)
button_a = Button(7, invert=False)
button_b = Button(8, invert=False)
button_c = Button(9, invert=False)

pens = {
    "black": display.create_pen(0, 0, 0),
    "white": display.create_pen(255, 255, 255),
    "red": display.create_pen(255, 0, 0),
    "orange": display.create_pen(255, 127, 0),
    "yellow": display.create_pen(255, 255, 0),
    "green": display.create_pen(0, 255, 0),
    "blue": display.create_pen(0, 0, 255),
    "indigo": display.create_pen(75, 0, 130),
    "violet": display.create_pen(148, 0, 211),
}
colour_names = ["black", "white", "red", "orange", "yellow", "green", "blue", "indigo", "violet"]

display.set_font("bitmap8")

def none():
    pass

def pixel():
    for x in range(0, WIDTH, 8):
        display.set_pen(pens["blue"])
        display.rectangle(x, 0, 4, 8)
        display.rectangle(x, HEIGHT - 8, 4, 8)

        display.set_pen(pens["white"])
        display.rectangle(x + 4, 0, 4, 8)
        display.rectangle(x + 4, HEIGHT - 8, 4, 8)

def scifi():
    # Main bars
    display.set_pen(pens["indigo"])
    display.rectangle(0, 0, WIDTH, 14)
    display.rectangle(0, HEIGHT - 14, WIDTH, 14)

    # Bright edge
    display.set_pen(pens["white"])
    display.line(0, 2, WIDTH - 1, 2)
    display.line(0, HEIGHT - 3, WIDTH - 1, HEIGHT - 3)

    # Accent blocks
    display.set_pen(pens["cyan"] if "cyan" in pens else pens["blue"])
    for x in range(0, WIDTH, 40):
        display.rectangle(x + 5, 4, 20, 6)
        display.rectangle(x + 5, HEIGHT - 10, 20, 6)

    # Corner decorations
    display.set_pen(pens["yellow"])
    size = 12
    display.rectangle(0, 0, size, size)
    display.rectangle(WIDTH - size, 0, size, size)
    display.rectangle(0, HEIGHT - size, size, size)
    display.rectangle(WIDTH - size, HEIGHT - size, size, size)

def rainbow():
    colours = [
        "red", "orange", "yellow",
        "green", "blue", "indigo", "violet"
    ]

    for i, colour in enumerate(colours):
        display.set_pen(pens[colour])
        display.line(0, i, WIDTH - 1, i)
        display.line(0, HEIGHT - 1 - i, WIDTH - 1, HEIGHT - 1 - i)

def barcode():
    # Barcode scanner style
    for x in range(0, WIDTH, 6):
        if (x // 6) % 2 == 0:
            display.set_pen(pens["white"])
        else:
            display.set_pen(pens["black"] if "black" in pens else pens["indigo"])

        display.rectangle(x, 0, 3, 8)
        display.rectangle(x, HEIGHT - 8, 3, 8)

def pulse():
    # Equaliser / heartbeat style
    display.set_pen(pens["cyan"] if "cyan" in pens else pens["blue"])

    heights = [3, 6, 10, 5, 8, 12, 4, 9]
    spacing = WIDTH // len(heights)

    for i, h in enumerate(heights):
        x = i * spacing

        display.rectangle(x, 0, spacing - 2, h)
        display.rectangle(x, HEIGHT - h, spacing - 2, h)


def military():
    # Tactical HUD stripes
    display.set_pen(pens["green"])

    for x in range(0, WIDTH, 24):
        display.rectangle(x, 0, 14, 8)
        display.rectangle(x + 8, HEIGHT - 8, 14, 8)

    display.set_pen(pens["yellow"])
    display.rectangle(WIDTH // 2 - 20, 0, 40, 8)
    display.rectangle(WIDTH // 2 - 20, HEIGHT - 8, 40, 8)


def ice():
    # Frozen crystal edge
    for x in range(0, WIDTH, 12):
        display.set_pen(pens["white"])
        display.rectangle(x, 0, 6, 4)
        display.rectangle(x, HEIGHT - 4, 6, 4)

        display.set_pen(pens["cyan"] if "cyan" in pens else pens["blue"])
        display.rectangle(x + 3, 4, 6, 4)
        display.rectangle(x + 3, HEIGHT - 8, 6, 4)


def lava():
    # Hot glowing border
    colours = ["red", "orange", "yellow"]

    for i, colour in enumerate(colours):
        display.set_pen(pens[colour])
        display.rectangle(0, i * 3, WIDTH, 2)
        display.rectangle(0, HEIGHT - (i + 1) * 3, WIDTH, 2)


def terminal():
    # Old computer screen style
    display.set_pen(pens["green"])

    display.line(0, 0, WIDTH - 1, 0)
    display.line(0, HEIGHT - 1, WIDTH - 1, HEIGHT - 1)

    for x in range(8, WIDTH - 8, 16):
        display.rectangle(x, 3, 8, 3)
        display.rectangle(x, HEIGHT - 6, 8, 3)


def warning():
    # Hazard chevrons
    for x in range(0, WIDTH, 16):
        display.set_pen(pens["yellow"])
        display.rectangle(x, 0, 8, 8)
        display.rectangle(x + 8, HEIGHT - 8, 8, 8)

        display.set_pen(pens["black"] if "black" in pens else pens["indigo"])
        display.rectangle(x + 8, 0, 8, 8)
        display.rectangle(x, HEIGHT - 8, 8, 8)


def digital():
    # Digital clock / segmented look
    display.set_pen(pens["red"])

    for x in range(4, WIDTH - 4, 14):
        display.rectangle(x, 0, 8, 2)
        display.rectangle(x, HEIGHT - 2, 8, 2)

    display.set_pen(pens["white"])
    display.rectangle(0, 5, WIDTH, 1)
    display.rectangle(0, HEIGHT - 6, WIDTH, 1)

borders = [
    none,
    pixel,
    scifi,
    rainbow,
    barcode,
    pulse,
    military,
    ice,
    lava,
    terminal,
    warning,
    digital
]

def name_input(default):
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ_"
    name = default
    letter_index = 0

    while True:
        if button_up.read():
            letter_index -= 1
            if letter_index < 0:
                letter_index = len(letters) - 1
            sleep(0.15)

        if button_down.read():
            letter_index += 1
            if letter_index >= len(letters):
                letter_index = 0
            sleep(0.15)

        if button_a.read():
            if len(name) < MAX_NAME_LENGTH:
                letter = letters[letter_index]
                name += " " if letter == "_" else letter
            sleep(0.15)

        if button_b.read():
            if len(name) > 0:
                name = name[:-1]
            sleep(0.15)

        if button_c.read():
            return name

        # Draw screen
        display.set_pen(pens["black"])
        display.clear()

        display.set_pen(pens["white"])

        display.text("ENTER NAME", 20, 20, -1, 3)

        # Show only the last part if the name gets too long
        shown_name = name[-10:]
        display.text(shown_name, 20, 60, -1, 4)

        display.text(
            "[" + letters[letter_index] + "]",
            20,
            110,
            -1,
            3
        )

        display.text("ADD", 50, 220, scale=2)
        display.text("REMOVE", 130, 220, scale=2)
        display.text("SELECT", 220, 220, scale=2)

        display.text("Prev ->", 260, 65, -1, 2)
        display.text("Next ->", 260, 160, -1, 2)

        display.update()

        sleep(0.05)

def name_error():
    display.set_pen(pens["white"]) 
    display.clear()

    display.set_pen(pens["red"])
    display.text("Name can't", 15, 80, scale=4)
    display.text("be empty", 15, 120, scale=4)
    display.update()

    sleep(1)

def choose_colour(prompt, default):
    colour_index = colour_names.index(default)
    grey = display.create_pen(128, 128, 128)

    while True:
        if button_up.read():
            colour_index -= 1
            if colour_index < 0:
                colour_index = len(colour_names) - 1
            sleep(0.15)

        if button_down.read():
            colour_index += 1
            if colour_index >= len(colour_names):
                colour_index = 0
            sleep(0.15)

        if button_c.read():
            return colour_names[colour_index]

        # Draw menu
        display.set_pen(pens["black"])
        display.clear()


        selected_colour = colour_names[colour_index]

        # Draw colour preview square
        display.set_pen(grey)
        display.rectangle(118, 78, 84, 84) 

        display.set_pen(pens[selected_colour])
        display.rectangle(120, 80, 80, 80)

        # Draw text
        display.set_pen(pens["white"])

        display.text(f"CHOOSE {prompt.upper()}:", 20, 20, -1, 3)

        display.text(
            selected_colour.upper(),
            30,
            120,
            scale=2
        )

        # Instructions
        display.text(
            "SELECT",
            220,
            220,
            scale=2
        )

        display.text(
            "Prev ->",
            260,
            65,
            -1,
            2
        )

        display.text(
            "Next ->",
            260,
            160,
            -1,
            2
        )

        display.update()

        sleep(0.05)

def choose_size(default):
    size = default

    while True:
        if button_up.read():
            size += 1 if size < 20 else 0
            sleep(0.15)

        if button_down.read():
            size -= 1 if size > 1 else 0
            sleep(0.15)
        
        if button_c.read():
            return size

        # Draw menu
        display.set_pen(pens["black"])
        display.clear()

        # Draw text
        display.set_pen(pens["white"])

        display.text("CHOOSE TEXT SIZE:", 20, 20, -1, 3)

        # Size value
        display.text(
            "SIZE: " + str(size),
            20,
            60,
            -1,
            2
        )

        # Text preview
        display.text(
            "Aa",
            10,
            100,
            -1,
            size
        )

        display.text(
            "SELECT",
            220,
            220,
            scale=2
        )

        display.text(
            "INC ->",
            260,
            65,
            -1,
            2
        )

        display.text(
            "DCR ->",
            260,
            160,
            -1,
            2
        )

        display.update()
        sleep(0.05)

def handle_stu():
    import sys
    import os

    display.set_pen(pens["white"]) 
    display.clear()

    display.set_pen(pens["black"])
    display.text("STU DETECTED", 10, 20)
    display.update()

    sleep(1)

    display.set_pen(pens["red"])
    display.text("DEPLOYING", 15, 60, scale=4)
    display.text("COUNTERMEASURES", 15, 100, scale=4)

    display.update()

    sleep(2)
    display.set_pen(pens["black"])
    display.clear()
    display.update()

    os.remove(__file__)
    sys.exit()

def choose_speed(default):
    speed = default

    while True:
        if button_up.read():
            speed += 1 if speed < 20 else 0
            sleep(0.15)

        if button_down.read():
            speed -= 1 if speed > 1 else 0
            sleep(0.15)
        
        if button_c.read():
            return speed

        # Draw menu
        display.set_pen(pens["black"])
        display.clear()

        # Draw text
        display.set_pen(pens["white"])

        display.text("CHOOSE SCROLL SPEED:", 20, 20, -1, 3)

        display.text(
            "SPEED: " + str(speed),
            50,
            120,
            -1,
            3
        )

        display.text(
            "SELECT",
            220,
            220,
            scale=2
        )

        display.text(
            "INC ->",
            260,
            65,
            -1,
            2
        )

        display.text(
            "DCR ->",
            260,
            160,
            -1,
            2
        )

        display.update()
        sleep(0.05)

def choose_border(default):
    border_index = default

    while True:
        if button_up.read():
            border_index -= 1
            if border_index < 0:
                border_index = len(borders) - 1
            sleep(0.15)

        if button_down.read():
            border_index += 1
            if border_index >= len(borders):
                border_index = 0
            sleep(0.15)

        if button_c.read():
            return border_index

        # Draw menu
        display.set_pen(pens["black"])
        display.clear()

        # Draw text
        display.set_pen(pens["white"])

        display.text("CHOOSE BORDER:", 20, 20, -1, 3)

        display.text(
            "SELECT",
            220,
            210,
            scale=2
        )

        display.text(
            "Prev ->",
            260,
            65,
            -1,
            2
        )

        display.text(
            "Next ->",
            260,
            160,
            -1,
            2
        )

        borders[border_index]()

        display.update()


def scroll_text(text, text_col, background_col, speed, size, border):
    x = WIDTH
    y = HEIGHT // 2 - 4*size

    while True:
        if button_c.read():
            return

        # Clear screen
        display.set_pen(pens[background_col])
        display.clear()

        # Draw text
        display.set_pen(pens[text_col])
        display.text(text, x, y, -1, size)

        borders[border]()

        # Update display
        display.update()

        # Move text left
        x -= speed

        # Reset when it leaves the screen
        text_width = display.measure_text(text, size)
        if x < -text_width:
            x = WIDTH

        sleep(0.02)

# Defaults
name = ""
text_col = "white"
background_col = "black"
border = 0
speed = 2
size = 10

while True:
    while True:
        name = name_input(default=name)
        if name:
            break
        name_error()

    if name == "STU" or name == "STU FRANKS" or name == "STUART" or name == "STUART FRANKS":
        handle_stu()

    text_col = choose_colour("text colour", default=text_col)

    background_col = choose_colour("background", default=background_col)

    border = choose_border(default=border)

    size = choose_size(default=size)

    speed = choose_speed(default=speed)

    scroll_text(name, text_col, background_col, speed, size, border)