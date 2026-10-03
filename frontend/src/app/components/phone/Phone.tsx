import { useState } from "react";
import type { Item, Location, NPC } from "../../../core/models";
import type { QuestLogEntry } from "../../../core/quests";
import type { DialogueInput } from "../../../dialogue/engine";
import type { DialogueNode } from "../../../dialogue/models";
import type { SlotValues } from "../../../dialogue/template";
import type { LanguageConcept, SupportLevel } from "../../../learning/models";
import type { LearningSummary } from "../../../learning/summary";
import type { MapPlace } from "../../../phone/directory";
import { icons } from "../../icons";
import type { AudioSettings } from "../../voice";
import type { SayChoice } from "../Conversation";
import { ProgressSummary } from "../ProgressSheet";
import { QuestList } from "../QuestLog";
import { ProblemLog } from "../ProblemLog";
import { SoundSettings } from "../SoundSettings";
import { MessageThreadView, threadPreview, type ThreadEntry } from "./MessagesApp";

export type PhoneApp = "messages" | "map" | "contacts" | "phrasebook" | "quests" | "progress" | "settings";
/** Where the phone opens. Without an app it opens on its home screen. */
export interface PhoneRoute {
  app?: PhoneApp;
  threadId?: string;
}

type Props = {
  route: PhoneRoute;
  onClose: () => void;
  languageCode: string;
  languageName: string;
  level: string;
  xp: number;
  playerName: string;
  /** The one thing worth doing next, as on the HUD. */
  guidance?: string;

  threads: ThreadEntry[];
  thinkingThreadId?: string;
  slotValues: SlotValues;
  supportLevel: SupportLevel;
  sayChoices: (node: DialogueNode) => SayChoice[];
  onThreadInput: (threadId: string, input: DialogueInput) => void;
  onThreadRead: (threadId: string) => void;

  places: MapPlace[];
  /** The location drawn as the map; the others are its buildings. */
  mapLocation: Location;
  placeLabels: Record<string, string>;
  playerPosition: { x: number; y: number };
  contacts: NPC[];
  questEntries: QuestLogEntry[];
  items: Item[];
  summary: LearningSummary;
  expressions: Array<{ concept: LanguageConcept; examples: string[] }>;

  audioSettings: AudioSettings;
  voicesAvailable: boolean;
  onAudioSettingsChange: (change: Partial<AudioSettings>) => void;
  /** Say something aloud once. Absent when the game has no voices. */
  onHear?: (text: string, speakerId?: string) => void;
  onStartOver: () => void;
};

const APPS: Array<{ id: PhoneApp; title: string; glyph: string }> = [
  { id: "messages", title: "Messages", glyph: "💬" },
  { id: "map", title: "Map", glyph: "🗺️" },
  { id: "contacts", title: "Contacts", glyph: "👥" },
  { id: "phrasebook", title: "Phrasebook", glyph: "📖" },
  { id: "quests", title: "Quests", glyph: "🎯" },
  { id: "progress", title: "Progress", glyph: "📈" },
  { id: "settings", title: "Settings", glyph: "⚙️" }
];

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const REGISTER_NOTE = { informal: "You say « tu » to each other.", formal: "Say « vous »." };

function MapView({ places, mapLocation, placeLabels, playerPosition }: Pick<Props, "places" | "mapLocation" | "placeLabels" | "playerPosition">) {
  const { width, height } = mapLocation.size;
  const byId = new Map(places.map((place) => [place.location.id, place]));
  const outside = byId.get(mapLocation.id);
  const label = (place: MapPlace) => placeLabels[place.location.id] ?? place.location.name;
  return (
    <>
      <svg className="phone-map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Map of the neighbourhood">
        <rect width={width} height={height} rx="24" className="map-ground" />
        <rect y={height * 0.72} width={width} height={height * 0.14} className="map-road" />
        {mapLocation.buildings.map((building) => {
          const place = byId.get(building.id);
          const x = building.rect.x * width;
          const y = building.rect.y * height;
          const w = building.rect.width * width;
          const h = building.rect.height * height;
          return (
            <g key={building.id} className={place?.visited ? "map-building visited" : "map-building"}>
              <rect x={x} y={y} width={w} height={h} rx="18" />
              <text x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle">
                {place?.visited ? (placeLabels[building.labelKey] ?? place.location.name) : "?"}
              </text>
              {place?.objective && <circle cx={x + w - 34} cy={y + 34} r="24" className="map-objective" />}
              {place?.here && <circle cx={x + w / 2} cy={y + h - 44} r="26" className="map-you" />}
            </g>
          );
        })}
        {outside?.people.map((npc) => (
          <g key={npc.id} className="map-person">
            <circle cx={npc.position.x * width} cy={npc.position.y * height} r="20" />
            <text x={npc.position.x * width} y={npc.position.y * height + 56} textAnchor="middle">{npc.name}</text>
          </g>
        ))}
        {outside?.objective && <circle cx={width * 0.5} cy={height * 0.62} r="24" className="map-objective" />}
        {outside?.here && <circle cx={playerPosition.x * width} cy={playerPosition.y * height} r="26" className="map-you" />}
      </svg>
      <p className="map-legend"><span className="dot you" /> You <span className="dot objective" /> Next step <span className="dot person" /> People you know</p>

      <ul className="phone-list">
        {places.filter((place) => place.visited).map((place) => (
          <li key={place.location.id}>
            <strong>{label(place)}</strong>
            {(label(place) !== place.location.name || place.here) && (
              <small>{[label(place) !== place.location.name ? place.location.name : "", place.here ? "You are here" : ""].filter(Boolean).join(" · ")}</small>
            )}
            {place.objective && <small className="accent">Next step: {place.objective}</small>}
            {place.people.length > 0 && <small>{place.people.map((npc) => npc.name).join(", ")}</small>}
          </li>
        ))}
      </ul>
      {places.some((place) => !place.visited) && <p className="progress-note">Places you haven't been to yet appear as « ? ».</p>}
    </>
  );
}

function SavedGame({ onStartOver }: { onStartOver: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <section className="quest-section saved-game">
      <h3>Saved game</h3>
      {confirming ? (
        <>
          <p className="progress-note">
            This erases your quests, your name, your messages and your French progress from this device. It can't be undone.
          </p>
          <div className="saved-game-actions">
            <button className="danger" onClick={onStartOver}>Erase and start over</button>
            <button onClick={() => setConfirming(false)}>Keep playing</button>
          </div>
        </>
      ) : (
        <>
          <p className="progress-note">Your progress is saved on this device as you play.</p>
          <div className="saved-game-actions">
            <button onClick={() => setConfirming(true)}>Start over…</button>
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The player's phone: everything about the game that is not the world itself.
 * It only shows what the save and the content say, and reports what the player
 * writes or chooses; like the conversation view, it decides nothing.
 */
export function Phone(props: Props) {
  const { onClose, languageCode, threads, slotValues } = props;
  const [app, setApp] = useState<PhoneApp | undefined>(props.route.app);
  const [threadId, setThreadId] = useState<string | undefined>(props.route.threadId);
  const thread = threads.find((entry) => entry.id === threadId);
  const unread = threads.filter((entry) => entry.state.unread).length;
  const title = thread ? thread.contact.name : APPS.find((item) => item.id === app)?.title;
  const back = () => {
    if (thread) setThreadId(undefined);
    else setApp(undefined);
  };
  const openThread = (id: string) => {
    setApp("messages");
    setThreadId(id);
  };

  return (
    <div className="phone-backdrop" onClick={onClose}>
      <div className="phone" role="dialog" aria-modal="true" aria-label="Your phone" onClick={(event) => event.stopPropagation()}>
        <header className="phone-bar">
          {app ? <button className="phone-back" onClick={back} aria-label="Back">‹</button> : <span className="phone-back" aria-hidden="true" />}
          <h2>{title ?? "Phone"}</h2>
          <button className="sheet-close" onClick={onClose} aria-label="Put the phone away">×</button>
        </header>

        <div className={`phone-body${thread ? " in-thread" : ""}`}>
          {!app && (
            <>
              <p className="phone-hello">Bonjour, <strong>{props.playerName}</strong> ! <span>{languageCode.toUpperCase()} · {props.level} · {props.xp} XP</span></p>
              {props.guidance && (
                <button className="phone-next" onClick={() => setApp("quests")}>
                  <span className="eyebrow">NEXT STEP</span>
                  <strong>{props.guidance}</strong>
                </button>
              )}
              <div className="app-grid">
                {APPS.map((item) => (
                  <button key={item.id} className="app-tile" onClick={() => setApp(item.id)}>
                    <span className="app-glyph" aria-hidden="true">{item.glyph}</span>
                    <span>{item.title}</span>
                    {item.id === "messages" && unread > 0 && <span className="badge" aria-label={`${unread} unread`}>{unread}</span>}
                  </button>
                ))}
              </div>
            </>
          )}

          {app === "messages" && !thread && (
            threads.length === 0
              ? <p className="progress-note">No messages yet. People you meet may write to you.</p>
              : (
                <ul className="phone-list tappable">
                  {threads.map((entry) => (
                    <li key={entry.id}>
                      <button onClick={() => setThreadId(entry.id)}>
                        <strong>{entry.contact.name}{entry.state.unread && <span className="badge" aria-label="unread">•</span>}</strong>
                        <small lang={languageCode}>{threadPreview(entry, slotValues)}</small>
                        {!entry.state.unread && entry.state.session.status === "active" && <small className="accent">Waiting for your answer</small>}
                      </button>
                    </li>
                  ))}
                </ul>
              )
          )}

          {thread && (
            <MessageThreadView
              key={thread.id}
              entry={thread}
              languageCode={languageCode}
              slotValues={slotValues}
              supportLevel={props.supportLevel}
              playerName={props.playerName}
              thinking={props.thinkingThreadId === thread.id}
              sayChoices={props.sayChoices}
              onHear={props.onHear}
              onInput={(input) => props.onThreadInput(thread.id, input)}
              onRead={() => props.onThreadRead(thread.id)}
            />
          )}

          {app === "map" && <MapView places={props.places} mapLocation={props.mapLocation} placeLabels={props.placeLabels} playerPosition={props.playerPosition} />}

          {app === "contacts" && (
            props.contacts.length === 0
              ? <p className="progress-note">You haven't met anyone yet. Go and say hello!</p>
              : (
                <ul className="phone-list">
                  {props.contacts.map((npc) => {
                    const place = props.places.find((item) => item.location.id === npc.locationId);
                    const conversation = threads.find((entry) => entry.contact.id === npc.id);
                    return (
                      <li key={npc.id}>
                        <strong>{npc.name}</strong>
                        {npc.persona && <small>{sentence(npc.persona.role)}.</small>}
                        {npc.persona && <small lang="en">{REGISTER_NOTE[npc.persona.register]}</small>}
                        {place && <small>Usually at: {props.placeLabels[place.location.id] ?? place.location.name}</small>}
                        {conversation && <button className="assist-chip" onClick={() => openThread(conversation.id)}>Messages</button>}
                      </li>
                    );
                  })}
                </ul>
              )
          )}

          {app === "phrasebook" && (
            props.summary.vocabulary.length === 0
              ? <p className="progress-note">Words and phrases you meet will be kept here.</p>
              : (
                <>
                  <ul className="phone-list phrasebook">
                    {props.summary.vocabulary.map(({ item, produced }) => (
                      <li key={item.id} className={produced > 0 ? "used" : undefined}>
                        <div className="phrase-head">
                          <strong lang={languageCode}>{item.lemma}</strong>
                          <span className="familiarity">{produced > 0 ? "Used" : "Met"}</span>
                          {props.onHear && (
                            <button className="hear" onClick={() => props.onHear?.(item.lemma)} aria-label={`Hear ${item.lemma}`}>
                              <img src={icons["replay-audio"]} alt="" />
                            </button>
                          )}
                        </div>
                        <small>{item.gloss}</small>
                        {item.examples[0] && (
                          <small className="example">
                            <span lang={languageCode}>{item.examples[0].target}</span> — {item.examples[0].translation}
                          </small>
                        )}
                      </li>
                    ))}
                  </ul>
                  {props.expressions.length > 0 && (
                    <section className="quest-section">
                      <h3>Useful expressions</h3>
                      <ul className="phone-list">
                        {props.expressions.map(({ concept, examples }) => (
                          <li key={concept.id}>
                            <small>{concept.description}</small>
                            <strong lang={languageCode}>{examples.join("  ·  ")}</strong>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              )
          )}

          {app === "quests" && <QuestList entries={props.questEntries} items={props.items} />}
          {app === "progress" && (
            <>
              <p className="progress-note">Your {props.languageName}, from what you have done so far. Words are in the Phrasebook.</p>
              <ProgressSummary summary={props.summary} />
            </>
          )}
          {app === "settings" && (
            <>
              <section className="quest-section">
                <h3>Sound</h3>
                <SoundSettings settings={props.audioSettings} available={props.voicesAvailable} onChange={props.onAudioSettingsChange} />
              </section>
              <SavedGame onStartOver={props.onStartOver} />
              <ProblemLog />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
