import type { AudioSettings } from "../voice";

type Props = {
  settings: AudioSettings;
  /** Voices can be played right now. */
  available: boolean;
  onChange: (change: Partial<AudioSettings>) => void;
};

/** The listening preferences, shown in a conversation and in the phone's settings. */
export function SoundSettings({ settings, available, onChange }: Props) {
  return (
    <div className="settings-list">
      {!available && <p className="progress-note">Voices aren't available right now, so lines are shown without sound.</p>}
      <label className="setting-row">
        <span>Speak lines aloud</span>
        <input type="checkbox" checked={settings.voice} onChange={(event) => onChange({ voice: event.target.checked })} />
      </label>
      <label className="setting-row">
        <span>Volume</span>
        <input
          type="range" min={0} max={1} step={0.05} value={settings.volume}
          onChange={(event) => onChange({ volume: Number(event.target.value) })}
        />
      </label>
      <label className="setting-row">
        <span>
          Show the French text while listening
          <small>Turn off to listen first; you can still reveal the text.</small>
        </span>
        <input type="checkbox" checked={settings.subtitles} onChange={(event) => onChange({ subtitles: event.target.checked })} />
      </label>
    </div>
  );
}
