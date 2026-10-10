import type { Item, Location, MessageThread, NPC, Player, Quest, WorldPosition, WorldRect } from "../core/models";
import { CONCEPT_IDS, type LanguageConceptId } from "../learning/models";

const streetSize = { width: 1200, height: 860 };
const roomSize = { width: 700, height: 700 };
const point = (size: { width: number; height: number }, x: number, y: number): WorldPosition => ({
  x: x / size.width,
  y: y / size.height
});
const rect = (size: { width: number; height: number }, x: number, y: number, width: number, height: number): WorldRect => ({
  ...point(size, x, y),
  width: width / size.width,
  height: height / size.height
});
const streetPoint = (x: number, y: number) => point(streetSize, x, y);
const streetRect = (x: number, y: number, width: number, height: number) => rect(streetSize, x, y, width, height);
const roomPoint = (x: number, y: number) => point(roomSize, x, y);
const roomRect = (x: number, y: number, width: number, height: number) => rect(roomSize, x, y, width, height);

const neighborhood: Location = {
  id: "neighborhood",
  name: "Neighborhood",
  kind: "neighborhood",
  size: streetSize,
  // Everything below is measured from the painting, so what looks solid is solid.
  backdrop: "locations/neighborhood.webp",
  // Cut from the painting by tools/cut_props.py; see tools/sources/street-props.json.
  props: [
    { image: "locations/neighborhood-fountain.png", rect: { x: 0.7126, y: 0.4266, width: 0.2314, height: 0.1770 }, base: 0.5461 },
    { image: "locations/neighborhood-bench-left.png", rect: { x: 0.6161, y: 0.5763, width: 0.1316, height: 0.0895 }, base: 0.6591 },
    { image: "locations/neighborhood-bench-right.png", rect: { x: 0.8880, y: 0.5763, width: 0.1120, height: 0.0895 }, base: 0.6591 }
  ],
  buildings: [
    { id: "apartment", labelKey: "apartment", rect: streetRect(0, 0, 403, 372), sign: streetPoint(220, 170) },
    { id: "cafe", labelKey: "cafe", rect: streetRect(403, 0, 395, 372), sign: streetPoint(594, 169) },
    { id: "bakery", labelKey: "bakery", rect: streetRect(798, 0, 402, 372), sign: streetPoint(986, 169) }
  ],
  // In order: the building fronts, the two benches, and the fountain last.
  obstacles: [
    streetRect(0, 0, 403, 372),
    streetRect(403, 0, 395, 372),
    streetRect(798, 0, 402, 372),
    streetRect(741, 500, 154, 66),
    streetRect(1067, 500, 133, 66),
    streetRect(862, 425, 264, 88)
  ],
  portals: [
    { id: "enterApartment", position: streetPoint(219, 394), destination: { locationId: "apartment", spawnId: "entry" }, label: "Enter apartment", interactionRadius: 70 },
    { id: "enterCafe", position: streetPoint(595, 394), destination: { locationId: "cafe", spawnId: "entry" }, label: "Enter café", interactionRadius: 70 },
    { id: "enterBakery", position: streetPoint(984, 394), destination: { locationId: "bakery", spawnId: "entry" }, label: "Enter bakery", interactionRadius: 70 }
  ],
  spawnPoints: {
    outsideApartment: streetPoint(219, 465),
    outsideCafe: streetPoint(595, 465),
    // Left of the door: the fountain sits directly below it.
    outsideBakery: streetPoint(830, 430)
  }
};

// The rooms are measured on their paintings, which are 1254 pixels square.
const ROOM_PAINTING = 1254;
const paintedPoint = (x: number, y: number): WorldPosition => ({ x: x / ROOM_PAINTING, y: y / ROOM_PAINTING });
const paintedRect = (x: number, y: number, width: number, height: number): WorldRect => ({
  ...paintedPoint(x, y),
  width: width / ROOM_PAINTING,
  height: height / ROOM_PAINTING
});

const apartment: Location = {
  id: "apartment",
  name: "Apartment",
  kind: "apartment",
  size: roomSize,
  backdrop: "locations/apartment.webp",
  // The room is painted from close up, so people stand larger in it than on the street.
  figureScale: 2,
  buildings: [],
  // The bed first, then the back wall, the plant by the window, the coffee table and the desk corner.
  obstacles: [
    paintedRect(0, 300, 620, 345),
    paintedRect(0, 0, 1254, 540),
    paintedRect(570, 340, 180, 215),
    paintedRect(0, 585, 220, 320),
    paintedRect(980, 450, 274, 545)
  ],
  portals: [
    { id: "leaveApartment", position: paintedPoint(648, 1150), destination: { locationId: "neighborhood", spawnId: "outsideApartment" }, label: "Go to street", interactionRadius: 75 }
  ],
  spawnPoints: { entry: paintedPoint(648, 940) }
};

const cafe: Location = {
  id: "cafe",
  name: "Café",
  kind: "cafe",
  size: roomSize,
  backdrop: "locations/cafe.webp",
  figureScale: 1.7,
  // Cut from the painting by tools/cut_props.py, so the barista stands behind her counter.
  props: [{ image: "locations/cafe-counter.png", rect: paintedRect(112, 336, 1063, 189), base: 524 / ROOM_PAINTING }],
  buildings: [],
  // The counter and everything behind it belong to the staff. Then the two tables and the plants by the door.
  obstacles: [
    paintedRect(0, 0, 1254, 522),
    paintedRect(0, 505, 385, 290),
    paintedRect(890, 505, 364, 290),
    paintedRect(0, 790, 240, 464),
    paintedRect(1110, 880, 144, 374)
  ],
  portals: [
    { id: "leaveCafe", position: paintedPoint(630, 1140), destination: { locationId: "neighborhood", spawnId: "outsideCafe" }, label: "Go to street", interactionRadius: 75 }
  ],
  spawnPoints: { entry: paintedPoint(630, 960) }
};

const bakery: Location = {
  id: "bakery",
  name: "Bakery",
  kind: "bakery",
  size: roomSize,
  backdrop: "locations/bakery.webp",
  figureScale: 1.7,
  props: [{ image: "locations/bakery-counter.png", rect: paintedRect(100, 343, 1063, 217), base: 559 / ROOM_PAINTING }],
  buildings: [],
  // The display counter and the shelves behind it, then the two bread tables.
  obstacles: [
    paintedRect(0, 0, 1254, 557),
    paintedRect(0, 480, 285, 450),
    paintedRect(970, 470, 284, 460)
  ],
  portals: [
    { id: "leaveBakery", position: paintedPoint(640, 1160), destination: { locationId: "neighborhood", spawnId: "outsideBakery" }, label: "Go to street", interactionRadius: 75 }
  ],
  spawnPoints: { entry: paintedPoint(640, 980) }
};

export const chapterOneLocations: Location[] = [neighborhood, apartment, cafe, bakery];

export const chapterOneNpcs: NPC[] = [
  {
    // She walks the player to the café, so she waits beside its door afterwards.
    id: "sophie", name: "Sophie", locationId: neighborhood.id, position: streetPoint(470, 470), appearanceId: "sophie",
    persona: { role: "a friendly neighbour in her twenties who shows newcomers around", register: "informal" },
    // What Sophie says follows the quest chain; the last rule is her first meeting.
    dialogues: [
      { dialogueId: "sophieAfterErrands", when: [{ type: "OBJECTIVE_CURRENT", questId: "neighborhood", objectiveId: "returnToSophie" }] },
      { dialogueId: "sophieToSquare", when: [{ type: "QUEST_STATUS", questId: "neighborhood", status: "available" }] },
      { dialogueId: "sophieToSquare", when: [{ type: "QUEST_STATUS", questId: "neighborhood", status: "active" }] },
      { dialogueId: "sophieToCafe", when: [{ type: "QUEST_STATUS", questId: "cafe", status: "active" }] },
      { dialogueId: "sophieToBakery", when: [{ type: "QUEST_STATUS", questId: "bakery", status: "active" }] },
      { dialogueId: "sophieGoodbye", when: [{ type: "QUEST_STATUS", questId: "goodbye", status: "active" }] },
      // Normally played straight after meeting her; here in case the walk was left unfinished.
      { dialogueId: "walkToCafe", when: [{ type: "QUEST_STATUS", questId: "walkToCafe", status: "active" }] },
      { dialogueId: "sophieCatchUp", when: [{ type: "DIALOGUE_COMPLETED", dialogueId: "meetSophie" }] },
      { dialogueId: "meetSophie" }
    ],
    interaction: { radius: 78, noticeRadius: 190 },
    // She strolls out of the passage beside the apartment as the player first steps outside.
    // She comes out of the apartment building, toward the camera.
    entrance: { from: streetPoint(250, 392), durationMs: 1600 },
    state: "available"
  },
  {
    // Behind the counter, where its top is clear.
    id: "barista", name: "Nadia", locationId: cafe.id, position: paintedPoint(425, 515), appearanceId: "barista",
    persona: { role: "the barista of the neighbourhood café, warm and patient", register: "formal" },
    dialogues: [
      { dialogueId: "cafeOrder", when: [{ type: "QUEST_STATUS", questId: "cafe", status: "active" }] },
      { dialogueId: "meetBarista" }
    ],
    interaction: { radius: 155 }, state: "available"
  },
  {
    id: "baker", name: "Luc", locationId: bakery.id, position: paintedPoint(627, 550), appearanceId: "baker",
    persona: { role: "the neighbourhood baker, cheerful and brisk", register: "formal" },
    dialogues: [
      { dialogueId: "bakeryOrder", when: [{ type: "QUEST_STATUS", questId: "bakery", status: "active" }] },
      { dialogueId: "meetBaker" }
    ],
    interaction: { radius: 155 }, state: "available"
  },
  {
    id: "neighbor", name: "Malik", locationId: neighborhood.id, position: streetPoint(985, 585), appearanceId: "neighbor",
    persona: { role: "an older neighbour who likes to chat on the square", register: "formal" },
    dialogues: [
      { dialogueId: "neighborChat", when: [{ type: "DIALOGUE_COMPLETED", dialogueId: "meetNeighbor" }] },
      { dialogueId: "meetNeighbor" }
    ],
    interaction: { radius: 78 }, state: "available"
  }
];

/**
 * People met in passing during a scene. They speak a line or two in a conversation
 * but have no place in the world, so they are speakers only.
 */
export const chapterOneSceneSpeakers: Array<{ id: string; name: string; appearanceId: string }> = [
  { id: "passerby", name: "Passer-by", appearanceId: "passerby" },
  { id: "shopkeeper", name: "Shopkeeper", appearanceId: "shopkeeper" }
];

export const chapterOneItems: Item[] = [
  { id: "coffee", name: "Coffee" },
  { id: "croissant", name: "Croissant" }
];

/**
 * The Chapter 1 chain. Language steps complete when the player communicates the
 * intent or shows understanding, however they word it; the location requirement
 * ties a general intent such as greeting to the place the quest means.
 */
export const chapterOneQuests: Quest[] = [
  {
    id: "meetSophie",
    chapter: 1,
    title: "Bonjour, Sophie",
    summary: "Meet your new neighbour and introduce yourself.",
    prerequisites: [],
    objectives: [
      { id: "giveName", description: "Tell Sophie your name", trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "meetSophie", nodeId: "askName" } },
      { id: "practiseIntroduction", description: "Practise introducing yourself in French", trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "meetSophie", nodeId: "practice" } },
      { id: "hearPlan", description: "Hear Sophie's plan", trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "meetSophie" } }
    ],
    rewards: [{ type: "XP", amount: 20 }]
  },
  {
    // Goal 1, Scene 2: the first retrieval scene, on the way from the park to the café.
    id: "walkToCafe",
    chapter: 1,
    title: "En route",
    summary: "Walk to the café with Sophie and answer her questions in French.",
    prerequisites: ["meetSophie"],
    objectives: [
      { id: "greetPasserby", description: "Say bonjour to a passer-by", trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "walkToCafe", nodeId: "greetPasserby" } },
      { id: "answerCaVa", description: "Answer « Ça va ? »", trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "walkToCafe", nodeId: "caVaAnswer" } },
      { id: "answerAge", description: "Answer « Tu as quel âge ? »", trigger: { type: "INTENT_COMMUNICATED", intentId: "tellAge" } },
      { id: "answerName", description: "Answer « Comment tu t'appelles ? »", trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "walkToCafe", nodeId: "miniNameAnswer" } },
      { id: "arrive", description: "Arrive at the café", trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "walkToCafe" } }
    ],
    rewards: [{ type: "XP", amount: 30 }]
  },
  {
    id: "cafe",
    chapter: 1,
    title: "Un café",
    summary: "Order your first coffee in French.",
    prerequisites: ["walkToCafe"],
    objectives: [
      { id: "enterCafe", description: "Go into the café", trigger: { type: "LOCATION_ENTERED", locationId: "cafe" } },
      { id: "greetBarista", description: "Greet the barista", trigger: { type: "INTENT_COMMUNICATED", intentId: "greet" }, requires: { locationId: "cafe" } },
      { id: "orderDrink", description: "Order a coffee", trigger: { type: "INTENT_COMMUNICATED", intentId: "orderDrink" }, requires: { locationId: "cafe" } },
      { id: "payForCoffee", description: "Pay the right price", trigger: { type: "CONCEPT_DEMONSTRATED", conceptId: CONCEPT_IDS.UNDERSTAND_PRICE }, requires: { locationId: "cafe" } },
      { id: "thankBarista", description: "Say thank you", trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "cafeOrder" } }
    ],
    rewards: [{ type: "XP", amount: 30 }]
  },
  {
    id: "bakery",
    chapter: 1,
    title: "À la boulangerie",
    summary: "Buy a croissant from the bakery next door.",
    prerequisites: ["cafe"],
    objectives: [
      { id: "enterBakery", description: "Go into the bakery", trigger: { type: "LOCATION_ENTERED", locationId: "bakery" } },
      { id: "askForCroissant", description: "Ask for a croissant", trigger: { type: "INTENT_COMMUNICATED", intentId: "orderPastry" }, requires: { locationId: "bakery" } },
      { id: "payForCroissant", description: "Pay the right price", trigger: { type: "CONCEPT_DEMONSTRATED", conceptId: CONCEPT_IDS.UNDERSTAND_PRICE }, requires: { locationId: "bakery" } },
      { id: "sayGoodbye", description: "Say thank you and goodbye", trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "bakeryOrder" } }
    ],
    rewards: [{ type: "XP", amount: 30 }]
  },
  {
    id: "neighborhood",
    chapter: 1,
    title: "Le quartier",
    summary: "Meet someone new in the square, then tell Sophie how it went.",
    prerequisites: ["bakery"],
    start: { trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "sophieToSquare" }, description: "Talk to Sophie" },
    objectives: [
      { id: "meetMalik", description: "Meet Malik in the square", trigger: { type: "NPC_TALKED", npcId: "neighbor" } },
      { id: "greetNadiaAgain", description: "Say hello to Nadia again", trigger: { type: "NPC_TALKED", npcId: "barista" }, optional: true },
      { id: "returnToSophie", description: "Go back to Sophie", trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "sophieAfterErrands" } }
    ],
    rewards: [{ type: "XP", amount: 30 }]
  },
  {
    id: "goodbye",
    chapter: 1,
    title: "À bientôt",
    summary: "Head home after your first morning in French.",
    prerequisites: ["neighborhood"],
    objectives: [
      { id: "goHome", description: "Go home", trigger: { type: "LOCATION_ENTERED", locationId: "apartment" } },
      { id: "readMessage", description: "Read Sophie's message on your phone", trigger: { type: "DIALOGUE_LINE_COMPLETED", dialogueId: "sophieMessage", nodeId: "hi" } },
      { id: "answerSophie", description: "Answer Sophie", trigger: { type: "DIALOGUE_COMPLETED", dialogueId: "sophieMessage" } }
    ],
    rewards: [{ type: "XP", amount: 20 }]
  }
];

/** Conversations that reach the player on their phone, and when. */
export const chapterOneMessages: MessageThread[] = [
  {
    id: "sophieEvening",
    contactId: "sophie",
    dialogueId: "sophieMessage",
    when: [{ type: "OBJECTIVE_CURRENT", questId: "goodbye", objectiveId: "readMessage" }]
  }
];

/** Learning scope for the chapter. */
export const chapterOneConceptIds: LanguageConceptId[] = Object.values(CONCEPT_IDS);

export function createStartingPlayer(targetLanguageCode: string): Player {
  return {
    id: "local-player",
    name: "You",
    targetLanguageCode,
    // The game opens in the park with Sophie (the opening scene), then on this street.
    locationId: neighborhood.id,
    position: { ...neighborhood.spawnPoints.outsideApartment },
    xp: 0,
    profile: {}
  };
}
