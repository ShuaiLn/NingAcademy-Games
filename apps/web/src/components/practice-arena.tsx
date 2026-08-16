"use client";

import { useEffect, useRef, useState } from "react";
import type { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import {
  ASSAULT_RIFLE_FP,
  HOUSE_SHARD_PACK,
  THRALL_BIOME_ATTACHMENTS,
  THRALL_MODEL,
  type AnimationSemantic,
} from "@/game-assets/model-asset-registry";
import {
  applyThrallBiomeMaterials,
  loadModelAsset,
  type LoadedModelAsset,
} from "@/game-assets/model-runtime";
import { supportsWebGl2 } from "@/lib/browser-capabilities";
import type { EffectsPreferences } from "@/lib/effects-preferences";
import { FlashGovernor } from "@/lib/flash-governor";
import { crystalDeathCues } from "@/lib/vfx-manifest";
import type { PracticeAuthority, PracticeState } from "@/practice/types";

export interface PracticeArenaProps {
  readonly authority: PracticeAuthority;
  readonly effects: EffectsPreferences;
  readonly state: PracticeState;
}

type ArenaStatus = "starting" | "ready" | "unsupported" | "failed";
type AssetStatus = "loading" | "ready" | "fallback";

interface PooledShard {
  lifetimeMs: number;
  mesh: AbstractMesh;
  velocity: Vector3;
}

const deathCue = crystalDeathCues[0];

export function PracticeArena({ authority, effects, state }: PracticeArenaProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef(effects);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [status, setStatus] = useState<ArenaStatus>("starting");
  const [assetStatus, setAssetStatus] = useState<AssetStatus>("loading");

  effectsRef.current = effects;

  useEffect(() => {
    if (state.phase !== "playing" && document.pointerLockElement === canvasRef.current) {
      document.exitPointerLock();
    }
  }, [state.phase]);

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
      ] = await Promise.all([
        import("@babylonjs/core/Engines/engine"),
        import("@babylonjs/core/scene"),
        import("@babylonjs/core/Cameras/freeCamera"),
        import("@babylonjs/core/Lights/hemisphericLight"),
        import("@babylonjs/core/Meshes/meshBuilder"),
        import("@babylonjs/core/Materials/standardMaterial"),
        import("@babylonjs/core/Maths/math.color"),
        import("@babylonjs/core/Maths/math.vector"),
      ]);

      if (cancelled) {
        return;
      }

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
      scene.clearColor = new Color4(0.018, 0.027, 0.06, 1);
      const camera = new FreeCamera("practice-camera", new Vector3(0, 1.6, 0), scene);
      camera.fov = 1.08;
      camera.minZ = 0.05;

      const ambient = new HemisphericLight("practice-ambient", new Vector3(-0.3, 1, -0.2), scene);
      ambient.intensity = 0.9;
      ambient.diffuse = new Color3(0.54, 0.61, 0.96);
      ambient.groundColor = new Color3(0.06, 0.08, 0.18);

      const floorMaterial = new StandardMaterial("practice-floor-material", scene);
      floorMaterial.diffuseColor = new Color3(0.045, 0.07, 0.115);
      floorMaterial.emissiveColor = new Color3(0.008, 0.015, 0.04);
      floorMaterial.specularColor = new Color3(0.08, 0.13, 0.24);
      const floor = MeshBuilder.CreateGround("practice-floor", { height: 30, width: 30 }, scene);
      floor.material = floorMaterial;

      const boundaryMaterial = new StandardMaterial("boundary-material", scene);
      boundaryMaterial.diffuseColor = new Color3(0.08, 0.11, 0.2);
      boundaryMaterial.emissiveColor = new Color3(0.015, 0.025, 0.08);
      for (let index = 0; index < 12; index += 1) {
        const angle = (index / 12) * Math.PI * 2;
        const pillar = MeshBuilder.CreateBox(`boundary-${index}`, { height: 2.4, size: 0.7 }, scene);
        pillar.position.set(Math.sin(angle) * 13.2, 1.2, Math.cos(angle) * 13.2);
        pillar.rotation.y = angle;
        pillar.material = boundaryMaterial;
      }

      const shellMaterial = new StandardMaterial("thrall-shell-material", scene);
      shellMaterial.diffuseColor = new Color3(0.24, 0.12, 0.55);
      shellMaterial.emissiveColor = new Color3(0.07, 0.025, 0.2);
      shellMaterial.specularColor = new Color3(0.78, 0.68, 1);
      shellMaterial.specularPower = 96;
      const shell = MeshBuilder.CreatePolyhedron("practice-thrall-shell", { size: 1.45, type: 2 }, scene);
      shell.scaling.set(0.82, 1.25, 0.76);
      shell.material = shellMaterial;

      const coreMaterial = new StandardMaterial("thrall-core-material", scene);
      coreMaterial.diffuseColor = new Color3(0.52, 0.3, 0.98);
      coreMaterial.emissiveColor = new Color3(0.46, 0.2, 0.92);
      coreMaterial.specularColor = new Color3(1, 0.94, 1);
      const core = MeshBuilder.CreateSphere("practice-thrall-core", { diameter: 0.55, segments: 12 }, scene);
      core.parent = shell;
      core.position.set(0, 0, -0.62);
      core.material = coreMaterial;

      const fallbackRingMaterial = new StandardMaterial("fallback-ring-material", scene);
      fallbackRingMaterial.diffuseColor = new Color3(0.45, 0.38, 0.9);
      fallbackRingMaterial.emissiveColor = new Color3(0.2, 0.13, 0.55);
      fallbackRingMaterial.disableLighting = true;
      const fallbackRing = MeshBuilder.CreateTorus(
        "death-fallback-outline",
        { diameter: 1.8, tessellation: 24, thickness: 0.045 },
        scene,
      );
      fallbackRing.material = fallbackRingMaterial;
      fallbackRing.isVisible = false;

      const shardMaterial = new StandardMaterial("pooled-shard-material", scene);
      shardMaterial.diffuseColor = new Color3(0.34, 0.2, 0.74);
      shardMaterial.emissiveColor = new Color3(0.08, 0.035, 0.23);
      const shardStates: PooledShard[] = Array.from({ length: 12 }, (_, index) => {
        const mesh = MeshBuilder.CreatePolyhedron(
          `pooled-shard-${index}`,
          { size: 0.18 + (index % 3) * 0.04, type: index % 2 === 0 ? 1 : 2 },
          scene,
        );
        mesh.material = shardMaterial;
        mesh.isVisible = false;
        return { lifetimeMs: 0, mesh, velocity: new Vector3(0, 0, 0) };
      });

      const muzzleMaterial = new StandardMaterial("rifle-muzzle-flash-material", scene);
      muzzleMaterial.diffuseColor = new Color3(1, 0.74, 0.2);
      muzzleMaterial.emissiveColor = new Color3(1, 0.42, 0.06);
      muzzleMaterial.disableLighting = true;
      const muzzleFlash = MeshBuilder.CreateSphere(
        "rifle-muzzle-flash",
        { diameter: 0.085, segments: 6 },
        scene,
      );
      muzzleFlash.material = muzzleMaterial;
      muzzleFlash.isPickable = false;
      muzzleFlash.isVisible = false;

      const governor = new FlashGovernor();
      const keys = new Set<string>();
      let thrallModel: LoadedModelAsset | null = null;
      let thrallAttachment: LoadedModelAsset | null = null;
      let weaponModel: LoadedModelAsset | null = null;
      let magazineNode: TransformNode | null = null;
      let magazineBasePosition: Vector3 | null = null;
      let yaw = 0;
      let pitch = 0;
      let simulationAccumulatorMs = 0;
      let flashRemainingMs = 0;
      let fallbackRemainingMs = 0;
      let enemyAnimationHoldMs = 0;
      let enemyAnimationSemantic: AnimationSemantic | null = null;
      let muzzleFlashRemainingMs = 0;
      let recoilRemainingMs = 0;
      let previousDamageFlash = -1;
      let previousEnemyX = authority.getSnapshot().enemy.position.x;
      let previousEnemyZ = authority.getSnapshot().enemy.position.z;

      const playEnemyAnimation = (semantic: AnimationSemantic, holdMs: number): void => {
        enemyAnimationSemantic = semantic;
        enemyAnimationHoldMs = Math.max(enemyAnimationHoldMs, holdMs);
        thrallModel?.playAnimation(semantic, semantic === "idle" || semantic === "move");
      };

      const loadPresentationAssets = async (): Promise<void> => {
        const definitions = [
          THRALL_MODEL,
          THRALL_BIOME_ATTACHMENTS.house,
          ASSAULT_RIFLE_FP,
          HOUSE_SHARD_PACK,
        ] as const;
        const results = await Promise.allSettled([
          loadModelAsset(scene, THRALL_MODEL),
          loadModelAsset(scene, THRALL_BIOME_ATTACHMENTS.house),
          loadModelAsset(scene, ASSAULT_RIFLE_FP),
          loadModelAsset(scene, HOUSE_SHARD_PACK),
        ] as const);

        if (cancelled) {
          for (const result of results) {
            if (result.status === "fulfilled") result.value.dispose();
          }
          return;
        }

        const [thrallResult, attachmentResult, weaponResult, shardResult] = results;
        if (thrallResult.status === "fulfilled") {
          const loadedThrall = thrallResult.value;
          thrallModel = loadedThrall;
          shell.setEnabled(false);
          core.setEnabled(false);
          const initialAnimation = enemyAnimationSemantic ?? "spawn";
          loadedThrall.playAnimation(
            initialAnimation,
            initialAnimation === "idle" || initialAnimation === "move",
          );
        }
        if (attachmentResult.status === "fulfilled" && thrallModel !== null) {
          const loadedAttachment = attachmentResult.value;
          thrallAttachment = loadedAttachment;
          loadedAttachment.root.parent = thrallModel.root;
          loadedAttachment.root.position.setAll(0);
        } else if (attachmentResult.status === "fulfilled") {
          attachmentResult.value.dispose();
        }
        if (thrallModel !== null) {
          applyThrallBiomeMaterials(
            thrallAttachment === null ? [thrallModel] : [thrallModel, thrallAttachment],
            "house",
          );
        }

        if (weaponResult.status === "fulfilled") {
          const loadedWeapon = weaponResult.value;
          weaponModel = loadedWeapon;
          loadedWeapon.root.parent = camera;
          loadedWeapon.root.position.set(0.27, -0.26, 0.48);
          loadedWeapon.root.scaling.setAll(0.78);
          const magazine = loadedWeapon.findNode("MESH_Magazine");
          if (magazine !== null && "position" in magazine) {
            magazineNode = magazine as TransformNode;
            magazineBasePosition = magazineNode.position.clone();
          }
          const muzzle = loadedWeapon.findNode("SOCKET_Muzzle");
          if (muzzle !== null) {
            muzzleFlash.parent = muzzle;
            muzzleFlash.position.setAll(0);
          }
        }

        if (shardResult.status === "fulfilled") {
          const loadedShardPack = shardResult.value;
          const templates = loadedShardPack.renderMeshes.filter((mesh) => mesh.getTotalVertices() > 0);
          if (templates.length > 0) {
            shardStates.forEach((shard, index) => {
              const template = templates[index % templates.length];
              const clone = template?.clone(`pooled-model-shard-${index}`, null, true) ?? null;
              if (clone === null) return;
              shard.mesh.dispose();
              clone.parent = null;
              clone.checkCollisions = false;
              clone.isPickable = false;
              clone.isVisible = false;
              clone.setEnabled(true);
              shard.mesh = clone;
            });
          }
          loadedShardPack.root.setEnabled(false);
        }

        results.forEach((result, index) => {
          if (result.status === "rejected") {
            const reason = result.reason instanceof Error ? result.reason.message : "unknown loader error";
            console.warn(`[models] ${definitions[index]?.assetId ?? "unknown"}: ${reason}`);
          }
        });
        setAssetStatus(thrallModel !== null && weaponModel !== null ? "ready" : "fallback");
      };

      const unsubscribe = authority.subscribe((update) => {
        if (update.state.phase !== "playing" && document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }

        for (const event of update.events) {
          if (event.type === "shot.fired") {
            recoilRemainingMs = 85;
            muzzleFlashRemainingMs = 38;
          }
          if (event.type === "enemy.damaged") {
            flashRemainingMs = Math.max(flashRemainingMs, 55);
            playEnemyAnimation("hit", 210);
          }
          if (event.type === "enemy.respawned") {
            playEnemyAnimation("spawn", 720);
          }
          if (event.type !== "enemy.killed") {
            continue;
          }

          playEnemyAnimation("death", 900);

          const currentEffects = effectsRef.current;
          governor.setMode(currentEffects.flashMode);
          const decision = governor.request({
            atMs: performance.now(),
            cueId: deathCue.id,
            highContrast: deathCue.flashClass === "local_high_contrast",
            saturatedRed: deathCue.saturatedRed,
          });
          flashRemainingMs = decision.kind === "render" ? 90 : 0;
          fallbackRemainingMs = 380;
          fallbackRing.position.set(event.position.x, 1.1, event.position.z);

          if (currentEffects.shardMode === "normal") {
            shardStates.forEach((shard, index) => {
              const angle = (index / shardStates.length) * Math.PI * 2;
              shard.mesh.position.set(event.position.x, 1.1, event.position.z);
              shard.mesh.isVisible = true;
              shard.lifetimeMs = 620;
              shard.velocity.set(Math.sin(angle) * 2.5, 1.7 + (index % 3) * 0.35, Math.cos(angle) * 2.5);
            });
          }
        }
      });

      void loadPresentationAssets();

      const handleKeyDown = (event: KeyboardEvent): void => {
        if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyR"].includes(event.code)) {
          keys.add(event.code);
          if (document.pointerLockElement === canvas) {
            event.preventDefault();
          }
        }
        if (event.code === "KeyR" && !event.repeat) {
          authority.dispatch({ type: "weapon.reload" });
        }
      };
      const handleKeyUp = (event: KeyboardEvent): void => {
        keys.delete(event.code);
      };
      const handleMouseMove = (event: MouseEvent): void => {
        if (document.pointerLockElement !== canvas) {
          return;
        }
        yaw += event.movementX * 0.0022;
        pitch = Math.min(1.25, Math.max(-1.25, pitch + event.movementY * 0.0022));
      };
      const handlePointerLockChange = (): void => {
        setPointerLocked(document.pointerLockElement === canvas);
      };
      const handleCanvasClick = (): void => {
        canvas.focus();
        if (authority.getSnapshot().phase !== "playing") {
          return;
        }
        if (document.pointerLockElement !== canvas) {
          void canvas.requestPointerLock();
        }
        authority.dispatch({ type: "weapon.fire", pitch, yaw });
      };
      const resize = (): void => engine.resize();

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", handleKeyUp);
      window.addEventListener("resize", resize, { passive: true });
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("pointerlockchange", handlePointerLockChange);
      canvas.addEventListener("click", handleCanvasClick);

      engine.runRenderLoop(() => {
        const deltaMs = Math.min(engine.getDeltaTime(), 50);
        simulationAccumulatorMs += deltaMs;
        while (simulationAccumulatorMs >= 1_000 / 30) {
          authority.dispatch({
            type: "simulation.step",
            deltaMs: 1_000 / 30,
            input: {
              forward: (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
              right: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
              yaw,
            },
          });
          simulationAccumulatorMs -= 1_000 / 30;
        }

        const snapshot = authority.getSnapshot();
        camera.position.set(snapshot.player.position.x, 1.6, snapshot.player.position.z);
        camera.rotation.set(pitch, yaw, 0);
        shell.position.set(snapshot.enemy.position.x, 1.1, snapshot.enemy.position.z);
        shell.isVisible = snapshot.enemy.alive;
        core.isVisible = snapshot.enemy.alive;

        flashRemainingMs = Math.max(0, flashRemainingMs - deltaMs);
        fallbackRemainingMs = Math.max(0, fallbackRemainingMs - deltaMs);
        enemyAnimationHoldMs = Math.max(0, enemyAnimationHoldMs - deltaMs);
        muzzleFlashRemainingMs = Math.max(0, muzzleFlashRemainingMs - deltaMs);
        recoilRemainingMs = Math.max(0, recoilRemainingMs - deltaMs);
        fallbackRing.isVisible = fallbackRemainingMs > 0;
        const flashScale = flashRemainingMs > 0 ? 1 : 0;
        shellMaterial.emissiveColor.set(0.07 + flashScale * 0.2, 0.025 + flashScale * 0.12, 0.2 + flashScale * 0.35);

        if (thrallModel !== null) {
          const enemyDelta = Math.hypot(
            snapshot.enemy.position.x - previousEnemyX,
            snapshot.enemy.position.z - previousEnemyZ,
          );
          const directionX = snapshot.player.position.x - snapshot.enemy.position.x;
          const directionZ = snapshot.player.position.z - snapshot.enemy.position.z;
          const cameraDistance = Math.hypot(directionX, directionZ);
          thrallModel.root.position.set(snapshot.enemy.position.x, 0, snapshot.enemy.position.z);
          thrallModel.root.rotation.y = Math.atan2(-directionX, -directionZ);
          thrallModel.setDistanceFromCamera(cameraDistance);
          thrallAttachment?.setDistanceFromCamera(cameraDistance);

          if (!snapshot.enemy.alive && enemyAnimationHoldMs === 0) {
            thrallModel.root.setEnabled(false);
            thrallAttachment?.root.setEnabled(false);
          } else if (snapshot.enemy.alive && enemyAnimationHoldMs === 0) {
            const semantic: AnimationSemantic = enemyDelta > 0.002 ? "move" : "idle";
            enemyAnimationSemantic = semantic;
            thrallModel.playAnimation(semantic, true);
          }

          if (previousDamageFlash !== flashScale) {
            applyThrallBiomeMaterials(
              thrallAttachment === null ? [thrallModel] : [thrallModel, thrallAttachment],
              "house",
              flashScale,
            );
            previousDamageFlash = flashScale;
          }
        }
        previousEnemyX = snapshot.enemy.position.x;
        previousEnemyZ = snapshot.enemy.position.z;

        if (weaponModel !== null) {
          const recoil = recoilRemainingMs / 85;
          weaponModel.root.position.set(0.27, -0.26, 0.48 - recoil * 0.055);
          weaponModel.root.rotation.x = recoil * 0.035;
          weaponModel.root.setEnabled(snapshot.phase === "playing" && snapshot.player.alive);
          muzzleFlash.isVisible = muzzleFlashRemainingMs > 0 && snapshot.player.alive;
        }
        if (magazineNode !== null && magazineBasePosition !== null) {
          magazineNode.position.copyFrom(magazineBasePosition);
          if (snapshot.weapon.reloadRemainingMs > 0) {
            const reloadProgress = 1 - Math.min(1, snapshot.weapon.reloadRemainingMs / 800);
            magazineNode.position.y -= Math.sin(reloadProgress * Math.PI) * 0.24;
          }
        }

        const moveShards = effectsRef.current.shardMode === "normal";
        for (const shard of shardStates) {
          if (!shard.mesh.isVisible) {
            continue;
          }
          shard.lifetimeMs = Math.max(0, shard.lifetimeMs - deltaMs);
          if (shard.lifetimeMs === 0 || !moveShards) {
            shard.mesh.isVisible = false;
            continue;
          }
          const seconds = deltaMs / 1_000;
          shard.velocity.y -= 5.8 * seconds;
          shard.mesh.position.addInPlace(shard.velocity.scale(seconds));
          shard.mesh.rotation.y += seconds * 3;
        }

        scene.render();
      });

      setStatus("ready");
      cleanup = () => {
        unsubscribe();
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
        canvas.removeEventListener("click", handleCanvasClick);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("pointerlockchange", handlePointerLockChange);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", handleKeyUp);
        window.removeEventListener("resize", resize);
        engine.stopRenderLoop();
        scene.dispose();
        engine.dispose();
      };
    };

    void start().catch(() => {
      if (!cancelled) {
        setStatus("failed");
      }
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [authority]);

  return (
    <div className="arena-frame">
      <canvas
        aria-label="本地结晶体射击练习场 / local Thrall shooting range"
        className="game-canvas"
        ref={canvasRef}
        tabIndex={0}
      />
      <div aria-hidden="true" className="crosshair"><i /><i /></div>
      <div className="arena-status">
        {status === "ready"
          ? pointerLocked
            ? "WASD 移动 · 鼠标瞄准 · 点击射击 · R 换弹"
            : "点击场景锁定鼠标并射击 / Click to enter"
          : status === "starting"
            ? "正在启动 WebGL2…"
            : status === "unsupported"
              ? "此设备不支持 WebGL2"
              : "渲染器启动失败"}
        {status === "ready" && (
          <span>
            {assetStatus === "loading"
              ? " · 模型加载中"
              : assetStatus === "ready"
                ? " · GLB 模型已接入"
                : " · 部分模型失败，已使用安全回退"}
          </span>
        )}
      </div>
      {!state.player.alive && (
        <div className="respawn-banner">重新结晶中… {(state.player.respawnRemainingMs / 1_000).toFixed(1)}s</div>
      )}
    </div>
  );
}
