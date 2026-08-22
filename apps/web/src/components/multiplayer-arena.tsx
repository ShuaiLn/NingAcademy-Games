"use client";

import { useEffect, useRef, useState } from "react";
import type { Authority } from "@ningacademy/authority";
import {
  COMBAT_TICK_RATE,
  isCompatibleCombatMapLayout,
  type GameState,
  type SurvivorInputState,
  type ThrallState,
} from "@ningacademy/game-core";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import {
  ASSAULT_RIFLE_FP,
  ASSAULT_RIFLE_TP,
  SURVIVOR_MODELS,
  THRALL_BIOME_ATTACHMENTS,
  THRALL_MODEL,
  type AnimationSemantic,
  type ModelAssetDefinition,
} from "@/game-assets/model-asset-registry";
import {
  applyThrallBiomeMaterials,
  loadModelAsset,
  type LoadedModelAsset,
} from "@/game-assets/model-runtime";
import { MultiplayerPresentationTimeline } from "@/gameplay/multiplayer-presentation";
import { supportsWebGl2 } from "@/lib/browser-capabilities";
import type { WebRtcStarNetwork } from "@/p2p/webrtc-star";

export interface MultiplayerArenaProps {
  readonly authority: Authority;
  readonly localMemberId: string;
  readonly network: WebRtcStarNetwork;
  readonly snapshot: Readonly<GameState>;
}

type ArenaStatus = "starting" | "ready" | "unsupported" | "failed";
type AssetStatus = "loading" | "ready" | "fallback";

interface SurvivorAvatar {
  animationHoldMs: number;
  body: LoadedModelAsset | null;
  readonly fallback: AbstractMesh;
  lastAlive: boolean;
  readonly root: TransformNode;
  weapon: LoadedModelAsset | null;
}

interface EnemyAvatar {
  animationHoldMs: number;
  attachment: LoadedModelAsset | null;
  body: LoadedModelAsset | null;
  readonly fallback: AbstractMesh;
  flashRemainingMs: number;
  lastAnimationRevision: number;
  readonly root: TransformNode;
}

const survivorDefinitions = Object.values(SURVIVOR_MODELS);

function modelForPlayer(playerId: string): ModelAssetDefinition {
  let hash = 0;
  for (let index = 0; index < playerId.length; index += 1) {
    hash = ((hash * 31) + playerId.charCodeAt(index)) >>> 0;
  }
  return survivorDefinitions[hash % survivorDefinitions.length] ?? SURVIVOR_MODELS.warrior;
}

function wrapAimYaw(value: number): number {
  const fullTurn = Math.PI * 2;
  return ((((value + Math.PI) % fullTurn) + fullTurn) % fullTurn) - Math.PI;
}

export function MultiplayerArena({
  authority,
  localMemberId,
  network,
  snapshot,
}: MultiplayerArenaProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestSnapshotRef = useRef(snapshot);
  const timelineRef = useRef(new MultiplayerPresentationTimeline(localMemberId));
  const [actionError, setActionError] = useState<string | null>(null);
  const [assetStatus, setAssetStatus] = useState<AssetStatus>("loading");
  const [pointerLocked, setPointerLocked] = useState(false);
  const [status, setStatus] = useState<ArenaStatus>("starting");

  latestSnapshotRef.current = snapshot;

  useEffect(() => {
    timelineRef.current.pushSnapshot(snapshot, performance.now());
  }, [snapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || !supportsWebGl2(document.createElement("canvas"))) {
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    const start = async (): Promise<void> => {
      const [
        { Engine },
        { Scene },
        { FreeCamera },
        { HemisphericLight },
        { MeshBuilder },
        { StandardMaterial },
        { Color3, Color4 },
        { Vector3 },
        { TransformNode: BabylonTransformNode },
      ] = await Promise.all([
        import("@babylonjs/core/Engines/engine"),
        import("@babylonjs/core/scene"),
        import("@babylonjs/core/Cameras/freeCamera"),
        import("@babylonjs/core/Lights/hemisphericLight"),
        import("@babylonjs/core/Meshes/meshBuilder"),
        import("@babylonjs/core/Materials/standardMaterial"),
        import("@babylonjs/core/Maths/math.color"),
        import("@babylonjs/core/Maths/math.vector"),
        import("@babylonjs/core/Meshes/transformNode"),
      ]);

      if (cancelled) return;

      const engine = new Engine(canvas, true, {
        alpha: false,
        antialias: true,
        audioEngine: false,
        depth: true,
        disableWebGL2Support: false,
        failIfMajorPerformanceCaveat: true,
        powerPreference: "high-performance",
        stencil: false,
      });
      if (engine.webGLVersion < 2) {
        engine.dispose();
        setStatus("unsupported");
        return;
      }

      const scene = new Scene(engine);
      scene.clearColor = new Color4(0.012, 0.02, 0.046, 1);
      const camera = new FreeCamera("multiplayer-camera", new Vector3(0, 1.6, 0), scene);
      camera.fov = 1.08;
      camera.minZ = 0.05;

      const ambient = new HemisphericLight("multiplayer-ambient", new Vector3(-0.2, 1, -0.3), scene);
      ambient.intensity = 0.92;
      ambient.diffuse = new Color3(0.58, 0.65, 0.96);
      ambient.groundColor = new Color3(0.04, 0.06, 0.14);

      const floorMaterial = new StandardMaterial("multiplayer-floor-material", scene);
      floorMaterial.diffuseColor = new Color3(0.035, 0.065, 0.095);
      floorMaterial.emissiveColor = new Color3(0.006, 0.014, 0.03);
      floorMaterial.specularColor = new Color3(0.05, 0.12, 0.2);
      const mapLayout = snapshot.combat?.map;
      if (mapLayout === undefined || !isCompatibleCombatMapLayout(mapLayout)) {
        scene.dispose();
        engine.dispose();
        setActionError("资源版本不匹配，请刷新");
        setStatus("failed");
        return;
      }
      const floor = MeshBuilder.CreateGround("multiplayer-floor", {
        height: mapLayout.navigationBounds.halfExtents.z * 2,
        width: mapLayout.navigationBounds.halfExtents.x * 2,
      }, scene);
      floor.material = floorMaterial;

      const boundaryMaterial = new StandardMaterial("multiplayer-boundary-material", scene);
      boundaryMaterial.diffuseColor = new Color3(0.07, 0.1, 0.17);
      boundaryMaterial.emissiveColor = new Color3(0.012, 0.026, 0.07);
      const halfX = mapLayout.navigationBounds.halfExtents.x;
      const halfZ = mapLayout.navigationBounds.halfExtents.z;
      for (const [id, width, depth, x, z] of [
        ["north", halfX * 2 + 1, 0.6, 0, -halfZ],
        ["south", halfX * 2 + 1, 0.6, 0, halfZ],
        ["west", 0.6, halfZ * 2 + 1, -halfX, 0],
        ["east", 0.6, halfZ * 2 + 1, halfX, 0],
      ] as const) {
        const wall = MeshBuilder.CreateBox(`multiplayer-boundary-${id}`, { depth, height: 2.7, width }, scene);
        wall.position.set(x, 1.35, z);
        wall.material = boundaryMaterial;
      }

      const moduleMaterials = {
        arena_open: floorMaterial,
        boss_reserve: new StandardMaterial("greybox-boss-reserve", scene),
        cover_l: boundaryMaterial,
        enemy_gate: new StandardMaterial("greybox-enemy-gate", scene),
        player_spawn: new StandardMaterial("greybox-player-spawn", scene),
        supply_reserve: new StandardMaterial("greybox-supply-reserve", scene),
      } as const;
      moduleMaterials.player_spawn.diffuseColor = new Color3(0.08, 0.34, 0.5);
      moduleMaterials.player_spawn.emissiveColor = new Color3(0.01, 0.1, 0.18);
      moduleMaterials.enemy_gate.diffuseColor = new Color3(0.4, 0.08, 0.48);
      moduleMaterials.enemy_gate.emissiveColor = new Color3(0.14, 0.01, 0.2);
      moduleMaterials.supply_reserve.diffuseColor = new Color3(0.12, 0.38, 0.24);
      moduleMaterials.supply_reserve.emissiveColor = new Color3(0.02, 0.12, 0.05);
      moduleMaterials.boss_reserve.diffuseColor = new Color3(0.52, 0.2, 0.08);
      moduleMaterials.boss_reserve.emissiveColor = new Color3(0.17, 0.045, 0.01);
      for (const [index, placement] of mapLayout.modulePlacements.entries()) {
        const tile = MeshBuilder.CreateBox(`greybox-module-${index}-${placement.moduleId}`, {
          depth: mapLayout.gridSize - 0.18,
          height: 0.06,
          width: mapLayout.gridSize - 0.18,
        }, scene);
        tile.position.set(placement.gridX * mapLayout.gridSize, 0.03, placement.gridZ * mapLayout.gridSize);
        tile.rotation.y = placement.rotation * Math.PI / 180;
        tile.material = moduleMaterials[placement.moduleId];
      }
      for (const boundary of mapLayout.collisionBoundaries) {
        const obstacle = MeshBuilder.CreateBox(`greybox-collision-${boundary.id}`, {
          depth: boundary.halfExtents.z * 2,
          height: 2.4,
          width: boundary.halfExtents.x * 2,
        }, scene);
        obstacle.position.set(boundary.center.x, 1.2, boundary.center.z);
        obstacle.material = boundaryMaterial;
      }

      const survivorMaterial = new StandardMaterial("survivor-fallback-material", scene);
      survivorMaterial.diffuseColor = new Color3(0.13, 0.42, 0.76);
      survivorMaterial.emissiveColor = new Color3(0.025, 0.1, 0.25);
      const muzzleMaterial = new StandardMaterial("multiplayer-muzzle-material", scene);
      muzzleMaterial.diffuseColor = new Color3(1, 0.72, 0.18);
      muzzleMaterial.emissiveColor = new Color3(1, 0.38, 0.04);
      muzzleMaterial.disableLighting = true;
      const muzzleFlash = MeshBuilder.CreateSphere(
        "multiplayer-muzzle-flash",
        { diameter: 0.09, segments: 6 },
        scene,
      );
      muzzleFlash.material = muzzleMaterial;
      muzzleFlash.isPickable = false;
      muzzleFlash.isVisible = false;

      const keys = new Set<string>();
      const avatars = new Map<string, SurvivorAvatar>();
      const enemies = new Map<string, EnemyAvatar>();
      let fpWeapon: LoadedModelAsset | null = null;
      let yaw = snapshot.combat?.survivors[localMemberId]?.input.aimYaw ?? 0;
      let pitch = snapshot.combat?.survivors[localMemberId]?.input.aimPitch ?? 0;
      let inputSequence = snapshot.combat?.survivors[localMemberId]?.input.sequence ?? -1;
      let shotSequence = snapshot.combat?.survivors[localMemberId]?.lastShotSequence ?? -1;
      let inputAccumulatorMs = 0;
      let recoilRemainingMs = 0;
      let muzzleRemainingMs = 0;

      const createAvatar = (playerId: string): SurvivorAvatar => {
        const root = new BabylonTransformNode(`survivor-root-${playerId}`, scene);
        const fallback = MeshBuilder.CreateCapsule(
          `survivor-fallback-${playerId}`,
          { height: 1.75, radius: 0.34, tessellation: 10 },
          scene,
        );
        fallback.parent = root;
        fallback.position.y = 0.88;
        fallback.material = survivorMaterial;
        fallback.isPickable = false;
        const avatar: SurvivorAvatar = {
          animationHoldMs: 0,
          body: null,
          fallback,
          lastAlive: true,
          root,
          weapon: null,
        };
        avatars.set(playerId, avatar);

        void Promise.allSettled([
          loadModelAsset(scene, modelForPlayer(playerId)),
          loadModelAsset(scene, ASSAULT_RIFLE_TP),
        ]).then(([bodyResult, weaponResult]) => {
          if (cancelled || avatars.get(playerId) !== avatar) {
            if (bodyResult.status === "fulfilled") bodyResult.value.dispose();
            if (weaponResult.status === "fulfilled") weaponResult.value.dispose();
            return;
          }
          if (bodyResult.status === "fulfilled") {
            avatar.body = bodyResult.value;
            avatar.body.root.parent = root;
            avatar.body.root.position.setAll(0);
            avatar.body.playAnimation("idle", true);
            fallback.isVisible = false;
          }
          if (weaponResult.status === "fulfilled") {
            avatar.weapon = weaponResult.value;
            const socket = avatar.body?.findNode("SOCKET_Weapon_R")
              ?? avatar.body?.findNode("SOCKET_Hand_R")
              ?? root;
            avatar.weapon.root.parent = socket;
            if (socket === root) {
              avatar.weapon.root.position.set(0.31, 1.18, 0.18);
              avatar.weapon.root.scaling.setAll(0.72);
            } else {
              avatar.weapon.root.position.setAll(0);
            }
          }
        });
        return avatar;
      };

      const removeAvatar = (playerId: string): void => {
        const avatar = avatars.get(playerId);
        if (avatar === undefined) return;
        avatars.delete(playerId);
        avatar.body?.dispose();
        avatar.weapon?.dispose();
        avatar.fallback.dispose();
        avatar.root.dispose();
      };

      const createEnemyAvatar = (enemy: Readonly<ThrallState>): EnemyAvatar => {
        const root = new BabylonTransformNode(`enemy-root-${enemy.entityId}`, scene);
        const fallbackMaterial = new StandardMaterial(`enemy-fallback-material-${enemy.entityId}`, scene);
        fallbackMaterial.diffuseColor = new Color3(0.3, 0.12, 0.58);
        fallbackMaterial.emissiveColor = new Color3(0.09, 0.02, 0.22);
        const fallback = MeshBuilder.CreatePolyhedron(
          `enemy-fallback-${enemy.entityId}`,
          { size: 1.45, type: 2 },
          scene,
        );
        fallback.parent = root;
        fallback.position.y = 1.1;
        fallback.scaling.set(0.82, 1.25, 0.76);
        fallback.material = fallbackMaterial;
        fallback.isPickable = false;
        const avatar: EnemyAvatar = {
          animationHoldMs: 0,
          attachment: null,
          body: null,
          fallback,
          flashRemainingMs: 0,
          lastAnimationRevision: -1,
          root,
        };
        enemies.set(enemy.entityId, avatar);
        void Promise.allSettled([
          loadModelAsset(scene, THRALL_MODEL),
          loadModelAsset(scene, THRALL_BIOME_ATTACHMENTS[snapshot.combat?.biome ?? "house"]),
        ]).then(([bodyResult, attachmentResult]) => {
          if (cancelled || enemies.get(enemy.entityId) !== avatar) {
            if (bodyResult.status === "fulfilled") bodyResult.value.dispose();
            if (attachmentResult.status === "fulfilled") attachmentResult.value.dispose();
            return;
          }
          if (bodyResult.status === "fulfilled") {
            avatar.body = bodyResult.value;
            avatar.body.root.parent = root;
            avatar.body.root.position.setAll(0);
            avatar.lastAnimationRevision = -1;
            fallback.isVisible = false;
          }
          if (attachmentResult.status === "fulfilled" && avatar.body !== null) {
            avatar.attachment = attachmentResult.value;
            avatar.attachment.root.parent = avatar.body.root;
            avatar.attachment.root.position.setAll(0);
          } else if (attachmentResult.status === "fulfilled") {
            attachmentResult.value.dispose();
          }
          if (avatar.body !== null) {
            applyThrallBiomeMaterials(
              avatar.attachment === null ? [avatar.body] : [avatar.body, avatar.attachment],
              snapshot.combat?.biome ?? "house",
            );
            setAssetStatus("ready");
          }
        });
        return avatar;
      };

      const removeEnemyAvatar = (entityId: string): void => {
        const avatar = enemies.get(entityId);
        if (avatar === undefined) return;
        enemies.delete(entityId);
        avatar.attachment?.dispose();
        avatar.body?.dispose();
        avatar.fallback.material?.dispose();
        avatar.fallback.dispose();
        avatar.root.dispose();
      };

      const loadCoreAssets = async (): Promise<void> => {
        const results = await Promise.allSettled([loadModelAsset(scene, ASSAULT_RIFLE_FP)] as const);
        if (cancelled) {
          for (const result of results) {
            if (result.status === "fulfilled") result.value.dispose();
          }
          return;
        }

        const [weaponResult] = results;
        if (weaponResult.status === "fulfilled") {
          fpWeapon = weaponResult.value;
          fpWeapon.root.parent = camera;
          fpWeapon.root.position.set(0.27, -0.26, 0.48);
          fpWeapon.root.scaling.setAll(0.78);
          const muzzle = fpWeapon.findNode("SOCKET_Muzzle");
          if (muzzle !== null) {
            muzzleFlash.parent = muzzle;
            muzzleFlash.position.setAll(0);
          }
        }
        setAssetStatus(fpWeapon !== null ? "ready" : "fallback");
      };

      const showCommandResult = async (
        command: Parameters<Authority["dispatch"]>[0],
      ): Promise<void> => {
        try {
          const result = await authority.dispatch(command);
          if (!result.ack.accepted && !cancelled) setActionError(result.ack.error.message);
          else if (!cancelled) setActionError(null);
        } catch (error) {
          if (!cancelled) setActionError(error instanceof Error ? error.message : "Host command failed");
        }
      };

      const unsubscribe = authority.subscribe((envelope) => {
        const event = envelope.payload;
        if (event.type === "combat.shot_fired") {
          const avatar = avatars.get(event.playerId);
          avatar?.body?.playAnimation("attack", false);
          if (avatar !== undefined) avatar.animationHoldMs = 180;
          if (event.playerId === localMemberId) {
            recoilRemainingMs = 85;
            muzzleRemainingMs = 38;
          }
        } else if (event.type === "combat.entity_damaged") {
          const damagedEnemy = enemies.get(event.targetEntityId);
          if (damagedEnemy !== undefined) {
            damagedEnemy.flashRemainingMs = 80;
            damagedEnemy.animationHoldMs = 210;
            damagedEnemy.body?.playAnimation("hit", false);
          }
          const attackingEnemy = enemies.get(event.sourceEntityId);
          if (attackingEnemy !== undefined) {
            attackingEnemy.animationHoldMs = 350;
            attackingEnemy.body?.playAnimation("attack", false);
          }
        } else if (event.type === "combat.entity_killed" && event.entityKind === "thrall") {
          const enemy = enemies.get(event.entityId);
          if (enemy !== undefined) {
            enemy.animationHoldMs = 900;
            enemy.body?.playAnimation("death", false);
          }
        } else if (event.type === "combat.enemy_spawned") {
          const enemyState = latestSnapshotRef.current.combat?.enemies[event.entityId];
          if (enemyState !== undefined) createEnemyAvatar(enemyState);
        } else if (event.type === "combat.enemy_despawned") {
          removeEnemyAvatar(event.entityId);
        }
      });

      void loadCoreAssets();

      const handleKeyDown = (event: KeyboardEvent): void => {
        if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyR"].includes(event.code)) {
          keys.add(event.code);
          if (document.pointerLockElement === canvas) event.preventDefault();
        }
        if (event.code === "KeyR" && !event.repeat) {
          void showCommandResult({ type: "combat.reload" });
        }
      };
      const handleKeyUp = (event: KeyboardEvent): void => { keys.delete(event.code); };
      const clearKeys = (): void => { keys.clear(); };
      const handleMouseMove = (event: MouseEvent): void => {
        if (document.pointerLockElement !== canvas) return;
        yaw = wrapAimYaw(yaw + event.movementX * 0.0022);
        pitch = Math.min(1.25, Math.max(-1.25, pitch + event.movementY * 0.0022));
      };
      const handlePointerLockChange = (): void => {
        const locked = document.pointerLockElement === canvas;
        setPointerLocked(locked);
        if (!locked) clearKeys();
      };
      const handleCanvasClick = (): void => {
        canvas.focus();
        const combat = latestSnapshotRef.current.combat;
        if (combat?.survivors[localMemberId]?.alive !== true) return;
        if (document.pointerLockElement !== canvas) {
          void canvas.requestPointerLock();
          return;
        }
        shotSequence += 1;
        void showCommandResult({
          clientShotTimeMs: Date.now(),
          shotSequence,
          type: "combat.fire",
        });
      };
      const resize = (): void => engine.resize();

      window.addEventListener("blur", clearKeys);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("resize", resize, { passive: true });
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("pointerlockchange", handlePointerLockChange);
      canvas.addEventListener("click", handleCanvasClick);

      engine.runRenderLoop(() => {
        const deltaMs = Math.min(engine.getDeltaTime(), 50);
        inputAccumulatorMs += deltaMs;
        while (inputAccumulatorMs >= 1_000 / COMBAT_TICK_RATE) {
          inputSequence += 1;
          const rawForward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
          const rawRight = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
          const movementMagnitude = Math.hypot(rawForward, rawRight);
          const input: SurvivorInputState = {
            aimPitch: pitch,
            aimYaw: yaw,
            clientTimeMs: Date.now(),
            moveForward: movementMagnitude > 1 ? rawForward / movementMagnitude : rawForward,
            moveRight: movementMagnitude > 1 ? rawRight / movementMagnitude : rawRight,
            sequence: inputSequence,
          };
          timelineRef.current.queueLocalInput(input);
          network.sendRealtimeInput({
            aimPitch: input.aimPitch,
            aimYaw: input.aimYaw,
            clientTimeMs: input.clientTimeMs,
            moveForward: input.moveForward,
            moveRight: input.moveRight,
          }, input.sequence);
          inputAccumulatorMs -= 1_000 / COMBAT_TICK_RATE;
        }

        const frame = timelineRef.current.sample(performance.now());
        if (frame === null) return;
        const local = frame.localSurvivor;
        if (local !== null) {
          camera.position.set(local.position.x, local.alive ? 1.6 : 0.55, local.position.z);
          camera.rotation.set(pitch, yaw, 0);
        }

        const remoteIds = new Set(
          Object.keys(frame.survivors).filter((playerId) => playerId !== localMemberId),
        );
        for (const playerId of remoteIds) {
          const survivor = frame.survivors[playerId];
          if (survivor === undefined) continue;
          const avatar = avatars.get(playerId) ?? createAvatar(playerId);
          avatar.root.position.set(survivor.position.x, 0, survivor.position.z);
          avatar.root.rotation.y = survivor.input.aimYaw;
          avatar.root.rotation.z = survivor.alive ? 0 : -1.45;
          const moving = Math.hypot(survivor.velocity.x, survivor.velocity.z) > 0.08;
          if (avatar.lastAlive && !survivor.alive) avatar.body?.playAnimation("death", false);
          else if (!avatar.lastAlive && survivor.alive) avatar.body?.playAnimation("idle", true);
          else if (survivor.alive && avatar.animationHoldMs === 0) {
            const semantic: AnimationSemantic = moving ? "run" : "idle";
            avatar.body?.playAnimation(semantic, true);
          }
          avatar.animationHoldMs = Math.max(0, avatar.animationHoldMs - deltaMs);
          avatar.lastAlive = survivor.alive;
          avatar.body?.setDistanceFromCamera(Math.hypot(
            survivor.position.x - (local?.position.x ?? 0),
            survivor.position.z - (local?.position.z ?? 0),
          ));
          avatar.weapon?.setDistanceFromCamera(Math.hypot(
            survivor.position.x - (local?.position.x ?? 0),
            survivor.position.z - (local?.position.z ?? 0),
          ));
        }
        for (const playerId of [...avatars.keys()]) {
          if (!remoteIds.has(playerId)) removeAvatar(playerId);
        }

        const enemyIds = new Set(Object.keys(frame.enemies));
        for (const entityId of enemyIds) {
          const enemy = frame.enemies[entityId];
          if (enemy === undefined) continue;
          const avatar = enemies.get(entityId) ?? createEnemyAvatar(enemy);
          avatar.root.position.set(enemy.position.x, 0, enemy.position.z);
          const target = enemy.targetPlayerId === null
            ? undefined
            : frame.survivors[enemy.targetPlayerId];
          if (target !== undefined) {
            avatar.root.rotation.y = Math.atan2(
              -(target.position.x - enemy.position.x),
              -(target.position.z - enemy.position.z),
            );
          } else if (Math.hypot(enemy.velocity.x, enemy.velocity.z) > 0.01) {
            avatar.root.rotation.y = Math.atan2(-enemy.velocity.x, -enemy.velocity.z);
          }
          if (avatar.lastAnimationRevision !== enemy.animationRevision && avatar.body !== null) {
            const semantic: AnimationSemantic = enemy.animationState === "moving"
              ? "move"
              : enemy.animationState === "attacking"
                ? "attack"
                : enemy.animationState === "hit"
                  ? "hit"
                  : enemy.animationState === "dead"
                    ? "death"
                    : enemy.animationState === "spawning"
                      ? "spawn"
                      : "idle";
            avatar.body.playAnimation(
              semantic,
              semantic === "idle" || semantic === "move",
            );
            avatar.lastAnimationRevision = enemy.animationRevision;
          }
          avatar.animationHoldMs = Math.max(0, avatar.animationHoldMs - deltaMs);
          avatar.flashRemainingMs = Math.max(0, avatar.flashRemainingMs - deltaMs);
          const distance = Math.hypot(
            enemy.position.x - (local?.position.x ?? 0),
            enemy.position.z - (local?.position.z ?? 0),
          );
          avatar.body?.setDistanceFromCamera(distance);
          avatar.attachment?.setDistanceFromCamera(distance);
          avatar.fallback.isVisible = avatar.body === null;
          const flash = avatar.flashRemainingMs > 0 ? 1 : 0;
          avatar.fallback.scaling.set(0.82 + flash * 0.08, 1.25 + flash * 0.12, 0.76 + flash * 0.08);
          if (avatar.body !== null) {
            applyThrallBiomeMaterials(
              avatar.attachment === null ? [avatar.body] : [avatar.body, avatar.attachment],
              frame.combat.biome,
              flash,
            );
          }
        }
        for (const entityId of [...enemies.keys()]) {
          if (!enemyIds.has(entityId)) removeEnemyAvatar(entityId);
        }

        recoilRemainingMs = Math.max(0, recoilRemainingMs - deltaMs);
        muzzleRemainingMs = Math.max(0, muzzleRemainingMs - deltaMs);
        const recoil = recoilRemainingMs / 85;
        if (fpWeapon !== null) {
          fpWeapon.root.position.set(0.27, -0.26, 0.48 - recoil * 0.055);
          fpWeapon.root.rotation.x = recoil * 0.035;
          fpWeapon.root.setEnabled(local?.alive === true);
        }
        muzzleFlash.isVisible = muzzleRemainingMs > 0 && local?.alive === true;

        scene.render();
      });

      setStatus("ready");
      cleanup = () => {
        unsubscribe();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        canvas.removeEventListener("click", handleCanvasClick);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("pointerlockchange", handlePointerLockChange);
        window.removeEventListener("blur", clearKeys);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        window.removeEventListener("resize", resize);
        for (const playerId of [...avatars.keys()]) removeAvatar(playerId);
        for (const entityId of [...enemies.keys()]) removeEnemyAvatar(entityId);
        fpWeapon?.dispose();
        engine.stopRenderLoop();
        scene.dispose();
        engine.dispose();
      };
    };

    void start().catch((error: unknown) => {
      if (!cancelled) {
        setActionError(error instanceof Error ? error.message : "Babylon scene failed to start");
        setStatus("failed");
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [authority, localMemberId, network]);

  const local = snapshot.combat?.survivors[localMemberId] ?? null;
  const respawnSeconds = local?.respawnAtTick === null || snapshot.combat === null
    ? 0
    : Math.max(0, (local?.respawnAtTick ?? 0) - snapshot.combat.tick) / COMBAT_TICK_RATE;

  return (
    <div className="arena-frame multiplayer-arena-frame">
      <canvas
        aria-label="Host 权威 WebRTC 多人结晶体射击场"
        className="game-canvas"
        data-layout-hash={snapshot.combat?.map.layoutHash}
        ref={canvasRef}
        tabIndex={0}
      />
      <div aria-hidden="true" className="crosshair"><i /><i /></div>
      <div className="arena-status" aria-live="polite">
        {status === "ready"
          ? pointerLocked
            ? "WASD 移动 · 鼠标瞄准 · 点击射击 · R 换弹"
            : `点击进入战斗 · ${assetStatus === "ready" ? "多人模型已载入" : assetStatus === "loading" ? "模型载入中" : "部分模型使用安全替身"}`
          : status === "unsupported"
            ? "此浏览器或显卡不支持所需 WebGL2"
            : status === "failed"
              ? "多人 3D 场景启动失败"
              : "正在建立 Babylon 多人世界…"}
      </div>
      {local?.alive === false && (
        <div className="respawn-banner" role="status">
          已倒下 · {respawnSeconds.toFixed(1)} 秒后由 Host 重生
        </div>
      )}
      {actionError && <div className="arena-command-error" role="alert">{actionError}</div>}
    </div>
  );
}
