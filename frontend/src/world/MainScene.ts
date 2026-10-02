import Phaser from "phaser";
import type { WorldVisual } from "../characters/types";
import type { Location, NPC, Player } from "../core/models";
import { Character, type WorldCharacter } from "./Character";
import { gameEvents } from "./events";
import { advanceToward, toNormalizedPoint, toWorldPoint, type CircleBlocker, type Point } from "./geometry";
import { findPath } from "./navigation";
import { renderLocation } from "./renderLocation";
import { SpriteCharacter } from "./SpriteCharacter";

export interface WorldSceneConfig {
  location: Location;
  npcs: NPC[];
  player: Player;
  placeLabels: Record<string, string>;
  /** Sprite art by appearance ID, with frame paths already resolved to URLs. */
  characterVisuals: Record<string, WorldVisual>;
  /** A painted picture of this location, when one exists. Otherwise it is drawn from shapes. */
  backdropUrl?: string;
  /** Cut-outs of the painting that characters can walk behind, with image URLs. */
  props?: NonNullable<Location["props"]>;
}

/** Sent while a conversation is on screen so the world frames it instead of vanishing. */
export interface ConversationFocus {
  npcId: string;
  /** True when a close-up portrait stands in for the NPC's world sprite. */
  hideNpc: boolean;
}

/** How much room the player's feet take up on the street; it grows with the figure indoors. */
const PLAYER_RADIUS = 16;
const WALK_SPEED = 185;
const WAVE_DURATION = 1300;
const FOCUS_ZOOM = 1.18;

// Entrances are a one-time flourish per session, not per visit to a location.
const playedEntrances = new Set<string>();
const PLAYER_APPEARANCE = "player";

export class MainScene extends Phaser.Scene {
  private playerEntity!: WorldCharacter;
  private npcEntities = new Map<string, WorldCharacter>();
  private npcLabels = new Map<string, Phaser.GameObjects.Text>();
  private npcBlockers: CircleBlocker[] = [];
  private nearbyNpcIds = new Set<string>();
  private nearbyPortalIds = new Set<string>();
  private noticedNpcIds = new Set<string>();
  private enteringNpcIds = new Set<string>();
  private waveRemaining = new Map<string, number>();
  private path: Point[] = [];
  /** A blocked route is replanned once per tap before the walk is given up. */
  private replanned = false;
  private moving = false;
  private movementLocked = false;
  private positionReportElapsed = 0;
  private playerRadius = PLAYER_RADIUS;
  private baseZoom = 1;
  private focus: ConversationFocus | null = null;

  constructor(private readonly world: WorldSceneConfig) {
    super("main");
  }

  private localNpcs() {
    return this.world.npcs.filter((npc) => npc.locationId === this.world.location.id);
  }

  preload() {
    for (const npc of this.localNpcs()) {
      const visual = this.world.characterVisuals[npc.appearanceId];
      if (visual) SpriteCharacter.preload(this, visual);
    }
    const player = this.world.characterVisuals[PLAYER_APPEARANCE];
    if (player) SpriteCharacter.preload(this, player);
    const backdrop = this.world.backdropUrl;
    if (backdrop && !this.textures.exists(backdrop)) this.load.image(backdrop, backdrop);
    for (const prop of this.world.props ?? []) {
      if (!this.textures.exists(prop.image)) this.load.image(prop.image, prop.image);
    }
  }

  create() {
    const { location } = this.world;
    this.npcEntities.clear();
    this.npcLabels.clear();
    this.npcBlockers = [];
    this.nearbyNpcIds.clear();
    this.nearbyPortalIds.clear();
    this.noticedNpcIds.clear();
    this.enteringNpcIds.clear();
    this.waveRemaining.clear();
    this.path = [];
    this.focus = null;
    this.cameras.main.setBackgroundColor("#c5d4bf");
    renderLocation(this, location, this.world.placeLabels, this.world.backdropUrl, this.world.props);
    const figureScale = location.figureScale ?? 1;
    this.playerRadius = Math.round(PLAYER_RADIUS * figureScale);

    for (const npc of this.localNpcs()) {
      const point = toWorldPoint(location, npc.position);
      const visual = this.world.characterVisuals[npc.appearanceId];
      const entity: WorldCharacter = visual
        ? new SpriteCharacter(this, point.x, point.y, visual, figureScale)
        : new Character(this, point.x, point.y, npc.appearanceId);
      entity.setMotion("idle", "down");
      if (npc.state === "busy") entity.setAlpha(0.65);
      this.npcEntities.set(npc.id, entity);
      // The blocker sits at the NPC's standing spot even while an entrance plays.
      this.npcBlockers.push({ ...point, radius: 17 });
      this.npcLabels.set(npc.id, this.add.text(point.x, point.y - entity.labelOffset, npc.name, {
        fontFamily: "Arial", fontSize: "15px", fontStyle: "bold", color: "#1f2a44",
        backgroundColor: "#fff9f5", padding: { x: 6, y: 3 }
      }).setOrigin(0.5));
      if (npc.entrance && entity instanceof SpriteCharacter && !playedEntrances.has(npc.id)) {
        this.playEntrance(npc, entity, point);
      }
    }

    const spawn = toWorldPoint(location, this.world.player.position);
    const playerVisual = this.world.characterVisuals[PLAYER_APPEARANCE];
    this.playerEntity = playerVisual
      ? new SpriteCharacter(this, spawn.x, spawn.y, playerVisual, figureScale)
      : new Character(this, spawn.x, spawn.y, PLAYER_APPEARANCE);
    this.playerEntity.setMotion("idle", "down");
    this.configureCamera();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.movementLocked) return;
      const target = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.path = findPath(location, this.position(), { x: target.x, y: target.y }, this.playerRadius, this.npcBlockers);
      this.replanned = false;
      this.setMoving(this.path.length > 0);
      if (!this.path.length) this.playerEntity.setMotion("idle");
    });

    const onCancel = () => this.cancelMovement();
    const onLock = (locked: boolean) => {
      this.movementLocked = locked;
      if (locked) this.cancelMovement();
    };
    const onFocus = (focus: ConversationFocus | null) => this.setConversationFocus(focus);
    const onResize = () => this.configureCamera();
    gameEvents.on("cancel-movement", onCancel);
    gameEvents.on("movement-lock", onLock);
    gameEvents.on("conversation-focus", onFocus);
    this.scale.on("resize", onResize);
    // Destroying the game (a location change) skips SHUTDOWN, so release the bridge on either.
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      gameEvents.off("cancel-movement", onCancel);
      gameEvents.off("movement-lock", onLock);
      gameEvents.off("conversation-focus", onFocus);
      this.scale.off("resize", onResize);
      for (const id of this.nearbyNpcIds) gameEvents.emit("npc-proximity", id, false);
      for (const id of this.nearbyPortalIds) gameEvents.emit("portal-proximity", id, false);
      this.setMoving(false);
    };
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, release);
    this.events.once(Phaser.Scenes.Events.DESTROY, release);
  }

  private playEntrance(npc: NPC, entity: SpriteCharacter, destination: Point) {
    if (!npc.entrance) return;
    playedEntrances.add(npc.id);
    const from = toWorldPoint(this.world.location, npc.entrance.from);
    entity.setPosition(from.x, from.y);
    const dx = destination.x - from.x;
    const dy = destination.y - from.y;
    entity.setPose("walking", Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down"));
    this.enteringNpcIds.add(npc.id);
    this.tweens.add({
      targets: entity,
      x: destination.x,
      y: destination.y,
      duration: npc.entrance.durationMs,
      onComplete: () => {
        this.enteringNpcIds.delete(npc.id);
        entity.setPose("idle", "down");
      }
    });
  }

  private configureCamera() {
    const camera = this.cameras.main;
    const { width, height } = this.scale;
    const location = this.world.location;
    const desiredWidth = location.kind === "neighborhood" ? 440 : 520;
    this.baseZoom = Math.max(width / desiredWidth, height / location.size.height);
    camera.setSize(width, height);
    camera.setBounds(0, 0, location.size.width, location.size.height);
    if (this.focus) {
      this.frameConversation(this.focus, 0);
      return;
    }
    camera.setZoom(this.baseZoom);
    this.followPlayer();
    camera.centerOn(this.playerEntity.x, this.playerEntity.y);
  }

  private followPlayer() {
    const camera = this.cameras.main;
    camera.startFollow(this.playerEntity, true, 0.12, 0.12);
    camera.setDeadzone(Math.min(70, this.scale.width / 5), Math.min(90, this.scale.height / 6));
  }

  /** Ease the camera in on a conversation, or back to following the player. */
  private setConversationFocus(focus: ConversationFocus | null) {
    const camera = this.cameras.main;
    const previous = this.focus;
    this.focus = focus;

    if (previous?.hideNpc) this.fadeNpc(previous.npcId, 1);
    // A close-up fills the middle of the screen, so the small figures step out of its way:
    // the person talking is the portrait, and the player is the one looking at them.
    this.tweens.add({ targets: this.playerEntity, alpha: focus?.hideNpc ? 0 : 1, duration: 220 });
    if (!focus) {
      if (!previous) return;
      camera.zoomTo(this.baseZoom, 320, "Sine.easeInOut", true);
      camera.pan(this.playerEntity.x, this.playerEntity.y, 320, "Sine.easeInOut", true, (_camera, progress) => {
        if (progress === 1 && !this.focus) this.followPlayer();
      });
      return;
    }
    if (focus.hideNpc) this.fadeNpc(focus.npcId, 0);
    this.frameConversation(focus, 420);
  }

  private frameConversation(focus: ConversationFocus, duration: number) {
    const entity = this.npcEntities.get(focus.npcId);
    if (!entity) return;
    const camera = this.cameras.main;
    const zoom = this.baseZoom * FOCUS_ZOOM;
    // Aim below the pair so they sit in the upper part of the screen, clear of the dialogue card.
    const x = (entity.x + this.playerEntity.x) / 2;
    const y = Math.min(entity.y, this.playerEntity.y) + this.scale.height * 0.16 / zoom;
    camera.stopFollow();
    if (duration === 0) {
      camera.setZoom(zoom);
      camera.centerOn(x, y);
      return;
    }
    camera.pan(x, y, duration, "Sine.easeInOut", true);
    camera.zoomTo(zoom, duration, "Sine.easeInOut", true);
  }

  private fadeNpc(npcId: string, alpha: number) {
    const targets = [this.npcEntities.get(npcId), this.npcLabels.get(npcId)].filter((item) => item !== undefined);
    if (targets.length) this.tweens.add({ targets, alpha, duration: 260 });
  }

  private position(): Point {
    return { x: this.playerEntity.x, y: this.playerEntity.y };
  }

  private reportPosition() {
    gameEvents.emit("player-position", this.world.location.id, toNormalizedPoint(this.world.location, this.position()));
  }

  private setMoving(moving: boolean) {
    if (moving === this.moving) return;
    this.moving = moving;
    gameEvents.emit("movement-state", moving);
    if (!moving) this.reportPosition();
  }

  private cancelMovement() {
    this.path = [];
    this.playerEntity.setMotion("idle");
    this.setMoving(false);
  }

  update(_: number, delta: number) {
    if (this.path.length && !this.movementLocked) {
      const target = this.path[0];
      const from = this.position();
      const distance = Math.hypot(target.x - from.x, target.y - from.y);
      const step = Math.min(WALK_SPEED * Math.min(delta, 50) / 1000, distance);
      if (distance <= 3) {
        this.path.shift();
      } else {
        const next = advanceToward(this.world.location, from, target, step, this.playerRadius, this.npcBlockers);
        if (!next) {
          // Nothing gets closer from here: follow grid cells to the same place instead.
          const destination = this.path[this.path.length - 1];
          this.path = this.replanned ? [] : findPath(this.world.location, from, destination, this.playerRadius, this.npcBlockers, { smooth: false });
          this.replanned = true;
          if (!this.path.length) this.cancelMovement();
        } else {
          const dx = next.x - from.x;
          const dy = next.y - from.y;
          this.playerEntity.setPosition(next.x, next.y);
          const facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
          this.playerEntity.setMotion("walking", facing);
          this.positionReportElapsed += delta;
          if (this.positionReportElapsed >= 120) {
            this.positionReportElapsed = 0;
            this.reportPosition();
          }
        }
      }
      if (!this.path.length) {
        this.playerEntity.setMotion("idle");
        this.setMoving(false);
      }
    }

    this.playerEntity.tick(delta);
    for (const [id, entity] of this.npcEntities) {
      entity.tick(delta);
      this.npcLabels.get(id)?.setPosition(entity.x, entity.y - entity.labelOffset).setDepth(entity.y + 1);
    }
    this.updateGreetings(delta);
    this.updateProximity();
  }

  /** NPCs with a greeting pose wave once each time the player comes into view. */
  private updateGreetings(delta: number) {
    const player = this.position();
    for (const npc of this.localNpcs()) {
      const entity = this.npcEntities.get(npc.id);
      if (!(entity instanceof SpriteCharacter) || !npc.interaction.noticeRadius) continue;

      const remaining = this.waveRemaining.get(npc.id);
      if (remaining !== undefined) {
        if (remaining <= delta) {
          this.waveRemaining.delete(npc.id);
          entity.setPose("idle");
        } else {
          this.waveRemaining.set(npc.id, remaining - delta);
        }
      }

      const within = Math.hypot(player.x - entity.x, player.y - entity.y) <= npc.interaction.noticeRadius;
      if (!within) {
        this.noticedNpcIds.delete(npc.id);
      } else if (!this.noticedNpcIds.has(npc.id) && !this.enteringNpcIds.has(npc.id) && !this.focus) {
        this.noticedNpcIds.add(npc.id);
        this.waveRemaining.set(npc.id, WAVE_DURATION);
        entity.setPose("waving");
      }
    }
  }

  private updateProximity() {
    const player = this.position();
    for (const npc of this.world.npcs) {
      const entity = this.npcEntities.get(npc.id);
      if (!entity) continue;
      const near = npc.state === "available" && Math.hypot(player.x - entity.x, player.y - entity.y) <= npc.interaction.radius;
      if (near === this.nearbyNpcIds.has(npc.id)) continue;
      if (near) this.nearbyNpcIds.add(npc.id);
      else this.nearbyNpcIds.delete(npc.id);
      gameEvents.emit("npc-proximity", npc.id, near);
    }

    for (const portal of this.world.location.portals) {
      const point = toWorldPoint(this.world.location, portal.position);
      const near = Math.hypot(player.x - point.x, player.y - point.y) <= portal.interactionRadius;
      if (near === this.nearbyPortalIds.has(portal.id)) continue;
      if (near) this.nearbyPortalIds.add(portal.id);
      else this.nearbyPortalIds.delete(portal.id);
      gameEvents.emit("portal-proximity", portal.id, near);
    }
  }
}
