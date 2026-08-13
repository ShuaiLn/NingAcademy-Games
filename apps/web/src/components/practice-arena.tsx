"use client";

import { useEffect, useRef, useState } from "react";

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

const deathCue = crystalDeathCues[0];

export function PracticeArena({ authority, effects, state }: PracticeArenaProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectsRef = useRef(effects);
  const [pointerLocked, setPointerLocked] = useState(false);
  const [status, setStatus] = useState<ArenaStatus>("starting");

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
      const shardStates = Array.from({ length: 12 }, (_, index) => {
        const mesh = MeshBuilder.CreatePolyhedron(
          `pooled-shard-${index}`,
          { size: 0.18 + (index % 3) * 0.04, type: index % 2 === 0 ? 1 : 2 },
          scene,
        );
        mesh.material = shardMaterial;
        mesh.isVisible = false;
        return { lifetimeMs: 0, mesh, velocity: new Vector3(0, 0, 0) };
      });

      const governor = new FlashGovernor();
      const keys = new Set<string>();
      let yaw = 0;
      let pitch = 0;
      let simulationAccumulatorMs = 0;
      let flashRemainingMs = 0;
      let fallbackRemainingMs = 0;

      const unsubscribe = authority.subscribe((update) => {
        if (update.state.phase !== "playing" && document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }

        for (const event of update.events) {
          if (event.type === "enemy.damaged") {
            flashRemainingMs = Math.max(flashRemainingMs, 55);
          }
          if (event.type !== "enemy.killed") {
            continue;
          }

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
        fallbackRing.isVisible = fallbackRemainingMs > 0;
        const flashScale = flashRemainingMs > 0 ? 1 : 0;
        shellMaterial.emissiveColor.set(0.07 + flashScale * 0.2, 0.025 + flashScale * 0.12, 0.2 + flashScale * 0.35);

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
      </div>
      {!state.player.alive && (
        <div className="respawn-banner">重新结晶中… {(state.player.respawnRemainingMs / 1_000).toFixed(1)}s</div>
      )}
    </div>
  );
}
