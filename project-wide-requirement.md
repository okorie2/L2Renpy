PROJECT-WIDE RESPONSIVE DESIGN REQUIREMENT

This Ren'Py app is intended to ship on:
- iOS phones
- Android phones
- desktop during development
- potentially tablets later

Treat mobile responsiveness as a requirement for all new screens and scenes.

Rules:

1. Landscape is the primary orientation.

2. Use Ren'Py's logical/design resolution and allow Ren'Py to scale to different physical device resolutions.
Do not change the project's existing gui.init/design resolution unless there is a clear reason and you explain the change first.

3. Avoid hardcoded absolute screen coordinates for important UI wherever possible.

Prefer:
- xalign / yalign
- xanchor / yanchor
- frames
- vbox / hbox
- padding
- spacing
- relative positioning

rather than positioning controls for one specific monitor resolution.

4. Character positioning should also be reusable and responsive.

For example, create transforms such as:

transform sophie_park_position:
    xalign 0.35
    yalign 1.0

rather than scattering fixed xpos/ypos values throughout scenes.

5. Touch controls must be comfortably sized for phones.

Buttons such as Speak and Type should:
- have generous padding
- have enough spacing between them
- be easy to tap
- not be placed directly against screen edges

6. Account for mobile safe areas conceptually.

Important controls and text should stay inside a safe central region and away from:
- notches
- Dynamic Island / camera cutouts
- rounded corners
- bottom gesture/home-indicator areas

Decorative backgrounds may extend to the screen edges.

7. Backgrounds should visually fill the screen.

For scene backgrounds such as bg park_day:
- preserve aspect ratio
- do not stretch/distort the image
- allow reasonable edge cropping on wider/narrower devices if necessary
- keep important composition away from extreme edges

8. Sophie must:
- preserve aspect ratio
- remain fully readable on different screen sizes
- not have her face accidentally cropped
- not overlap the interaction controls
- use reusable transforms for scene positioning

9. Where useful, use Ren'Py touch variants such as:

renpy.variant("touch")

to provide larger controls or slightly different layouts on mobile.

Do not create completely separate mobile and desktop implementations unless necessary.

10. Every new UI screen should be designed with multiple aspect ratios in mind, not only the development window.

For the opening park scene specifically:

- background fills the viewport
- Sophie stays approximately centre-left
- Speak / Type controls stay near bottom-centre
- controls have a safe margin from the bottom edge
- Sophie and controls must not overlap
- layout should remain usable on iOS and Android landscape screens

Apply these requirements to future UI/scene work unless I explicitly say otherwise.