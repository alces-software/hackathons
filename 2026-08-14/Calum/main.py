import tkinter as tk
import time
import pygame


pygame.mixer.init()



SOUNDS = {
    "C4": pygame.mixer.Sound("sounds/c4.mp3"),
    "D4": pygame.mixer.Sound("sounds/d4.mp3"),
    "E4": pygame.mixer.Sound("sounds/e4.mp3"),
    "F4": pygame.mixer.Sound("sounds/f4.mp3"),
    "G4": pygame.mixer.Sound("sounds/g4.mp3"),
    "A4": pygame.mixer.Sound("sounds/a4.mp3"),
    "B4": pygame.mixer.Sound("sounds/b4.mp3"),
    "C5": pygame.mixer.Sound("sounds/c5.mp3"),
}




Y = 500

NH = 40
FALL_SPEED = 200

NOTES = [
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
    "A4",
    "B4",
    "C5",
]

K_M = {
    "a": "C4",
    "s": "D4",
    "d": "E4",
    "f": "F4",
    "g": "G4",
    "h": "A4",
    "j": "B4",
    "k": "C5",
}



# FINISH THE SONG
SONG = [
    {"note": "C4", "time": 2.0},
    {"note": "D4", "time": 3.0},
    {"note": "E4", "time": 3.5},
    {"note": "C4", "time": 4.5},

    {"note": "E4", "time": 5},
    {"note": "C4", "time": 6},
    {"note": "E4", "time": 7},

{"note": "D4", "time": 9.0},
    {"note": "E4", "time": 10.25},
    {"note": "F4", "time": 10.5},
    {"note": "F4", "time": 11},
    {"note": "E4", "time": 11.5},
    {"note": "D4", "time": 12},

    {"note": "F4", "time": 12.5},
    {"note": "E4", "time": 15.5},

]



gaia = tk.Tk()

gaia.title("Austria")

prometheus = tk.Canvas(
    gaia,
    width=800,
    height=650,
    bg="#111827",
    highlightthickness=0
)

prometheus.pack()



song_start_time = None

falling_notes = []

score = 0

combo = 0

game_running = False


score_text = prometheus.create_text(
    20,
    20,
    anchor="nw",
    text="Score: 0",
    fill="white",
    font=("Arial", 18, "bold")
)

combo_text = prometheus.create_text(
    20,
    50,
    anchor="nw",
    text="Combo: 0",
    fill="white",
    font=("Arial", 16)
)

message_text = prometheus.create_text(
    800 / 2,
    80,
    text="Press SPACE to start",
    fill="white",
    font=("Arial", 24, "bold")
)



key_width = 800 / len(NOTES)

piano_keys = {}

for i, note in enumerate(NOTES):

    x1 = i * key_width
    x2 = x1 + key_width

    rectangle = prometheus.create_rectangle(
        x1,
        Y,
        x2,
        650,
        fill="white",
        outline="black",
        width=2
    )

    keyboard_letter = list(K_M.keys())[i].upper()

    prometheus.create_text(
        x1 + key_width / 2,
        650 - 65,
        text=note,
        fill="black",
        font=("Arial", 15, "bold")
    )

    prometheus.create_text(
        x1 + key_width / 2,
        650 - 30,
        text=keyboard_letter,
        fill="#555555",
        font=("Arial", 15, "bold")
    )

    piano_keys[note] = rectangle

prometheus.create_line(
    0,
    Y,
    800,
    Y,
    fill="#38bdf8",
    width=5
)

def setup_song():

    global falling_notes

    for note in falling_notes:
        prometheus.delete(note["prometheus_id"])

    falling_notes = []

    for song_note in SONG:

        note_name = song_note["note"]

        column = NOTES.index(note_name)

        x1 = column * key_width + 7
        x2 = x1 + key_width - 14

        rectangle = prometheus.create_rectangle(
            x1,
            -100,
            x2,
            -100 + NH,
            fill="#38bdf8",
            outline=""
        )

        falling_notes.append({
            "note": note_name,
            "time": song_note["time"],
            "prometheus_id": rectangle,
            "hit": False,
            "missed": False,
        })



def start_game(event=None):

    global song_start_time
    global score
    global combo
    global game_running

    if game_running:
        return

    score = 0
    combo = 0

    prometheus.itemconfig(
        score_text,
        text="Score: 0"
    )

    prometheus.itemconfig(
        combo_text,
        text="Combo: 0"
    )

    prometheus.itemconfig(
        message_text,
        text=""
    )

    setup_song()

    song_start_time = time.perf_counter()

    game_running = True

    game_loop()



def game_loop():

    global combo
    global game_running

    if not game_running:
        return

    current_time = time.perf_counter() - song_start_time

    unfinished_notes = False

    for note in falling_notes:

        if note["hit"] or note["missed"]:
            continue

        unfinished_notes = True

        time_until_hit = note["time"] - current_time

        bottom_y = Y - (
            time_until_hit * FALL_SPEED
        )

        top_y = bottom_y - NH

        column = NOTES.index(note["note"])

        x1 = column * key_width + 7
        x2 = x1 + key_width - 14

        prometheus.coords(
            note["prometheus_id"],
            x1,
            top_y,
            x2,
            bottom_y
        )

        # Missed note

        if current_time > note["time"] + 0.25:

            note["missed"] = True

            combo = 0

            prometheus.itemconfig(
                combo_text,
                text="Combo: 0"
            )

            prometheus.itemconfig(
                note["prometheus_id"],
                fill="#ef4444"
            )

            show_message("MISS")

            gaia.after(
                300,
                lambda item=note["prometheus_id"]:
                prometheus.delete(item)
            )

    if unfinished_notes:

        gaia.after(
            16,
            game_loop
        )

    else:

        game_running = False

        show_message(
            f"Finished! Score: {score}",
            duration=2000
        )



def play_note(event):

    global score
    global combo

    key = event.keysym.lower()

    if key not in K_M:
        return

    played_note = K_M[key]



    SOUNDS[played_note].play()



    piano_key = piano_keys[played_note]

    prometheus.itemconfig(
        piano_key,
        fill="#7dd3fc"
    )

    gaia.after(
        120,
        lambda key_id=piano_key:
        prometheus.itemconfig(
            key_id,
            fill="white"
        )
    )

    if not game_running:
        return

    current_time = (
        time.perf_counter() -
        song_start_time
    )

    best_note = None
    best_difference = float("inf")

    for note in falling_notes:

        if note["hit"] or note["missed"]:
            continue

        if note["note"] != played_note:
            continue

        difference = abs(
            current_time -
            note["time"]
        )

        if difference < best_difference:

            best_difference = difference
            best_note = note

    if best_note is None:
        return

    if best_difference > 0.25:
        return

    best_note["hit"] = True

    prometheus.delete(
        best_note["prometheus_id"]
    )

    if best_difference <= 0.06:

        points = 100
        result = "PERFECT"

    elif best_difference <= 0.12:

        points = 75
        result = "GREAT"

    else:

        points = 50
        result = "GOOD"

    combo += 1

    score += points

    if combo >= 5:
        score += 10

    prometheus.itemconfig(
        score_text,
        text=f"Score: {score}"
    )

    prometheus.itemconfig(
        combo_text,
        text=f"Combo: {combo}"
    )

    show_message(result)

message_version = 0


def show_message(message, duration=400):

    global message_version

    message_version += 1

    current_version = message_version

    prometheus.itemconfig(
        message_text,
        text=message
    )

    def clear_message():

        if current_version == message_version:

            prometheus.itemconfig(
                message_text,
                text=""
            )

    gaia.after(
        duration,
        clear_message
    )


gaia.bind(
    "<space>",
    start_game
)

gaia.bind(
    "<KeyPress>",
    play_note
)


gaia.mainloop()

pygame.mixer.quit()