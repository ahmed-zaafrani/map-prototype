# McGill Map: fog of war prototype

A phone-style map of McGill's downtown campus. Every building starts locked.
A building unlocks when you're within 50 m of it, and progress is saved in your browser.

## Files
- `index.html`: the page layout (header, map, buttons, bottom card, tab bar)
- `style.css`: how everything looks
- `data.js`: the buildings (name, position, colour, icon, description, tags)
- `app.js`: all the logic (unlocking, GPS, test mode, search, filters, saving)

## How to run it
1. Open the Terminal app.
2. Go to this folder:
   ```
   cd ~/Desktop/map-prototype
   ```
3. Start a small local web server (Python comes with macOS):
   ```
   python3 -m http.server 8000
   ```
4. Open **http://localhost:8000** in Chrome or Safari.
5. To stop the server, go back to Terminal and press `Ctrl + C`.

It's designed for a phone screen (390 × 844). On a computer it shows up as a
phone-sized frame. To see it exactly like a phone in Chrome, press
`Cmd + Option + I`, then click the phone icon and pick "iPhone 12 Pro".

## Testing from home
1. Tap the **joystick button** (bottom right) to turn on test mode. It turns purple.
2. Tap anywhere on the map: the purple dot moves there.
3. Tap close to a grey lock pin. When you're within 50 m, the "Building unlocked!" card appears with confetti.
4. Tap a little further away (50–120 m) from a locked building: its zone pulses purple ("almost there").
5. Tap a pin to open its card. Swipe it down, or tap the map, to close it
   (in test mode, tapping the map moves you instead).
6. Try the chips **All / Unlocked / Locked** and the search bar.
7. Refresh the page: unlocked buildings stay unlocked.
8. To start over, tap the **sliders icon** in the search bar, then **Reset progress**.

## Map style
The map uses the free "Positron" style from OpenFreeMap (no API key).
CARTO's version of Positron/Voyager now requires an API key, so it can't be used for free.

## Using it on campus with a phone
Phones only allow location on `https://` pages. The easiest free option is
GitHub Pages: put these files in a GitHub repository and turn on Pages in its settings.

## Adding new unlock conditions
Every unlock goes through `unlockBuilding(buildingId, method)` in `app.js`.
To unlock a building another way (an event check-in, a QR code scan), call it:
```js
unlockBuilding("trottier", "qr");
```
