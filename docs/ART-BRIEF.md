# Art Brief

The decision (owner, 2026-10-02): the whole world is brought up to Sophie's illustrated style, so that she no longer looks pasted in. Every character gets illustrated world sprites, and every location gets a painted backdrop. The flat shapes drawn by code remain only as a fallback for whatever has no art yet.

This brief says what to make, in what order, and how to hand it over. The game is already able to use each piece as it arrives.

## The style, taken from Sophie

Use Sophie's walk sheet (`frontend/tools/sources/sophie-walk-sheet.webp`) as the style reference for every image.

- Clean anime-style digital illustration.
- Thin, slightly warm brown line art; no thick black outlines.
- Soft cel shading with gentle gradients; light from the upper left.
- Warm, slightly muted pastel palette.
- Realistic adult proportions, about seven and a half heads tall.
- Everyday modern clothes with visible fabric texture.

Words to put in every prompt: *"clean anime-style digital illustration, thin warm brown line art, soft cel shading, warm muted pastel palette, light from the upper left, same style as the reference image"*.

## Rules for every character image

- **Full body, head to shoes, nothing cropped.**
- **Transparent background.** If the tool cannot do that, use one flat colour that appears nowhere on the character (plain white is fine unless the clothes are white; otherwise bright green).
- **One sheet per animation,** all poses side by side in one image with clear gaps between them. Poses generated in separate images never match; poses in one image do.
- **Same character in every pose:** same clothes, hair, bag, colours. Check the bag and accessories; they are what usually goes missing.
- **Camera at eye level,** straight on. No tilt, no perspective from above.
- **No text, no ground shadow, no props on the floor.** The game adds the shadow.
- At least 1000 px tall per figure.

## What each character needs

| Piece | Poses | Who needs it |
| --- | --- | --- |
| Front idle | 1, standing relaxed, facing the camera | everyone |
| Front walk | 6 to 8, one full walk cycle, walking toward the camera | characters who walk |
| Side walk | 6 to 8, walking to the right (the game mirrors it for left) | characters who walk |
| Back walk | 6 to 8, walking away from the camera | characters who walk |
| Side idle, back idle | 1 each | optional; the first walk frame is used otherwise |
| Wave | 1, facing the camera, one hand raised | characters who greet you |
| Portraits | 4 expressions on a 1024×1536 canvas, head in the same place: neutral, asking a question, explaining, encouraging; mouth closed | characters you talk to up close |

A walk cycle of 8: right foot contact, right foot down, passing, right foot up, left foot contact, left foot down, passing, left foot up. With 6, drop the two "down" poses. Ask for "an evenly spaced walk cycle that loops".

Only two characters walk today: the player and Sophie. Nadia, Luc and Malik stand still, so they need a front idle and, later, portraits.

## Characters

| Character | Who they are | Look, from the current placeholder |
| --- | --- | --- |
| **You (the player)** | A newcomer to the neighbourhood | Yours to decide. Placeholder: dark hair, navy coat, mustard scarf, dark trousers. |
| **Sophie** | Friendly neighbour in her twenties | As she is: cream sweater, light blue wide jeans, white trainers, black shoulder bag, brown hair up. |
| **Nadia** | Barista, warm and patient | Dark hair, brown skin, teal apron or top with a cream accent. |
| **Luc** | Baker, cheerful and brisk | Light skin, brown hair, blue-grey top, white apron. |
| **Malik** | Older neighbour who likes to chat | Dark brown skin, black hair greying, olive-green jacket, mustard accent. |

The player is the one character the game cannot describe for you. Decide what they look like before generating them.

## Locations

Each location is one painting at exactly twice its world size.

| Location | Size | Guide |
| --- | --- | --- |
| Street | 2400 × 1720 px | `frontend/tools/guides/neighborhood.png` |
| Apartment | 1400 × 1400 px | `frontend/tools/guides/apartment.png` |
| Café | 1400 × 1400 px | `frontend/tools/guides/cafe.png` |
| Bakery | 1400 × 1400 px | `frontend/tools/guides/bakery.png` |

A guide is drawn from the game's own data and shows what the painting must respect:

| Colour | Meaning |
| --- | --- |
| Grey | Ground the player walks on. Keep it clear. |
| Brown | Solid. Paint something that visibly blocks the way there (a counter, a table, a bench, a fountain). |
| Blue | A building front. The white bar is a blank sign: leave it empty, the game writes the name there. |
| Yellow | A door or exit the player walks onto. Paint a doorway or mat there. |
| Pink | Where a character stands. Keep it clear. |
| Green | How tall a person is in this picture. Size doors and furniture to it. |

- **View:** building fronts seen straight on along the top; the ground below seen from slightly above, as in the current game.
- **No people and no readable text** in the painting. The game adds both.
- Give the guide to the image tool as a layout reference along with Sophie's sheet as the style reference.
- An exact match to the guide is not required. If the painting comes out better with a table a little to one side, send it anyway: the solid areas in the game data can be moved to fit the painting.

Regenerate the guides after any change to the locations: `PYTHON=<python with Pillow> node tools/export_layout_guides.mjs` in `frontend/`.

## Art in the game so far

All of it was made by the owner on 2026-10-02 with ChatGPT image generation (GPT 5.6 Sol, high), except Sophie's standing and waving poses, which come from L2Renpy (`L2RENPY-IMPORTS.md`). Sources are in `frontend/tools/sources/`.

| Piece | Source file | In the game as |
| --- | --- | --- |
| Player, standing | `player-idle.webp` | `characters/player/world/idle.png` |
| Player, walking toward the camera, to the side, and away (6 poses each) | `player-walk-front.webp`, `player-walk-side.webp`, `player-walk-back.webp` | `walking-1..6.png`, `walking-side-1..6.png`, `walking-back-1..6.png` |
| Sophie, walking toward the camera (6 poses) | `sophie-walk-front.webp` | `characters/sophie/world/walking-1..6.png` |
| Malik, Nadia, Luc, standing | `malik-idle.webp`, `nadia-idle.webp`, `luc-idle.webp` | `characters/neighbor`, `barista`, `baker` `/world/idle.png` |
| Street | `street.webp` | `locations/neighborhood.webp`, plus cut-outs of the fountain and benches |
| Apartment, café, bakery | `apartment.webp`, `cafe.webp`, `bakery.webp` | `locations/<room>.webp`, plus a cut-out of each counter |
| Malik, Nadia, Luc: neutral close-ups | `malik-`, `nadia-`, `luc-portrait-neutral.webp` | `characters/<id>/conversation/neutral/closed.webp` |
| Malik, Nadia, Luc: asking, explaining, encouraging (three sheets, one per expression, all three people on each) | `portraits-question.webp`, `portraits-explaining.webp`, `portraits-encouraging.webp` | `characters/<id>/conversation/<expression>/closed.webp` |

Every character and every location in Chapter 1 is now illustrated. What fitting the art showed:

- **Solid areas, doors, signs and where people stand are measured from each painting,** not the other way round. The guides in `tools/guides/` are redrawn from that data.
- **People are 116 world units tall on the street** (`WORLD_FIGURE_HEIGHT`), sized against the painted doors.
- **The rooms were painted from closer up than the street,** so people stand larger in them: twice as large in the apartment and 1.7 times in the café and bakery (`Location.figureScale`). Without that the player looked like a child beside the furniture.
- **Things a character can stand behind are cut out of the painting** as separate images (`tools/cut_props.py`, shapes in `tools/sources/*-props.json`): the fountain and benches on the street, and the two counters, which is how Nadia and Luc stand behind theirs.
- **Furniture the player could only half hide behind is simply solid** over its whole painted area (the café tables and chairs, the bread tables, the plants by the café door), so nobody ever stands where they would need to be partly hidden.
- **Close-ups made separately are lined up by their heads.** The three expression sheets were drawn at a different size and framing from the neutral portraits, so `tools/build_portraits.py` scales and places each figure until its head matches the neutral one. They are enlarged about 1.6 times, so they are a little softer than the neutral portraits, and they stop at the hip, which the dialogue card covers. In the question sheet Nadia and Luc were drawn with a larger head for their body; the tool splits that difference.
- **The paintings are smaller than the brief asks for** (the street 1482 px wide, the rooms 1254 px square). They are sharp on a computer and a little soft on a phone. Larger originals can replace them without any other change.

Still to make, in order of how much each would be noticed:

1. **Open-mouth versions of Malik's, Nadia's and Luc's close-ups,** so their mouths move when they speak as Sophie's does. Each must be an edit of the finished close-up in `frontend/public/assets/characters/<id>/conversation/`, changing only the mouth.
2. **Sophie walking to the side** (6 poses), so she turns when she walks in from the side.
3. **Larger versions of the four paintings,** and of the three expression sheets.
4. **A wave for Malik,** if he should greet the player as Sophie does.

## Handing art over

Put each file in `frontend/tools/sources/` (or send it in the chat) and say which character and piece it is. It is then cut, cleaned, scaled and lined up by `frontend/tools/build_world_sprites.py`, registered in `frontend/src/characters/catalog.ts` (or as the location's `backdrop`), and checked by the tests. Nothing needs to be named or sized precisely on your side.

Record where each image came from (the tool used and the date). Images made with an AI image tool are yours to use under that tool's terms; note the tool so the provenance stays clear, as `L2RENPY-IMPORTS.md` does for Sophie.

## Honest limits

- **Walk cycles are the hard part.** Image tools often return poses that are not an even cycle, or change a detail between poses. Expect to regenerate a few times; a sheet with one bad pose can still be used by leaving that pose out.
- **Side and back views drift** from the front design more than front views do. Supplying the front idle as a reference helps.
- **A painted street and painted people will still differ from a hand-animated game.** The aim is that everything on screen comes from one style, not that it matches a studio production.
