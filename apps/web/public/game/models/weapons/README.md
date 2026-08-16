# NingAcademy Basic Weapons Asset Pack v01

This folder contains the approved basic/prototype weapon, consumable, deployable, and ability-VFX meshes. Directory names are lowercase to comply with `NingAcademy Games Naming Standard v1.0`; the requested logical groups remain `starter`, `advanced`, `consumables`, `deployables`, and `ability_vfx_mesh`.

## Delivered assets

| Group | Approved designs | Delivered models |
|---|---:|---:|
| Starter weapons | 5 | 10 FP/TP models |
| Advanced weapons | 9 | 18 FP/TP models |
| Consumables | 4 | 8 FP/WorldTP models |
| Deployables and support meshes | 6 | 6 World models |
| Ability VFX meshes | 4 | 4 World models |
| Shared hit-feedback packs | 5 | 4 biome shard packs + 1 weakpoint pack |
| **Total** |  | **51 GLB + 51 Blender source files** |

Each generated asset also has a JSON manifest and an individual QA report. The pack-level result is in `WEAPONS_Catalog_v01.json`.

## Locked authoring contract

- Metric units. One Blender unit equals one meter.
- Weapon forward is local `+Y`; up is local `+Z`.
- Gun and melee origins are at the primary right-hand grip.
- FP and TP are separate files with matching physical dimensions.
- TP meshes expose a `SOCKET_Back` reference for hand/back runtime attachment tests.
- Gameplay and VFX-controlled parts remain separate meshes/nodes.
- VFX trails, heat states, singularity fields, crack states, and multilayer glow are not baked into the weapon mesh.
- Materials use exportable glTF PBR Metallic-Roughness nodes only.

## Important interfaces

The relevant assets expose combinations of:

```text
SOCKET_Grip_R
SOCKET_Grip_L
SOCKET_Muzzle
SOCKET_Eject
SOCKET_ADS
SOCKET_Back
SOCKET_Blade_Start
SOCKET_Blade_End
SOCKET_Sweep_Start
SOCKET_Sweep_End
```

Movable meshes include the firearm magazine/bolt/charging handle, sniper scope lens and bipod, energy cooling parts, plasma accelerator rings, staff focus parts, consumable lids/flaps, turret head/barrel, drone thrusters, and guardian shield shards.

## Rigged World assets

- `PROP_AutoTurret_v01`: `SKEL_AutoTurret`, 3 bones, `ANIM_Idle`, `ANIM_Track`, `ANIM_Fire`.
- `PROP_Drone_v01`: `SKEL_Drone`, 6 bones, `ANIM_Idle`, `ANIM_Move`, `ANIM_Attack`.
- `PROP_GuardianCrystalShield_v01`: `SKEL_GuardianCrystalShield`, 7 bones, `ANIM_Idle`, `ANIM_Break`.

The Slow Trap exports four independent probe meshes and the `Idle -> Trigger -> Active` runtime state contract; animation timing remains gameplay-owned.

## Shared hit-feedback packs

- `ability_vfx_mesh/crystal_shards`: House, Desert, Grass, and Hell packs; each contains 8 independent shard shapes with a shared biome material.
- `ability_vfx_mesh/weakpoint_core`: one independent emissive core plus 6 independently breakable shell parts.

## Stage 3 specification gaps

No arbitrary model was generated for:

- `advanced/laser_stage3`
- `advanced/plasma_stage3`
- `advanced/staff_stage3`

Each folder contains `SPEC_PENDING.md` listing the approvals needed before FP/TP production.

## Rebuild

Run with Blender 5.2 LTS or newer:

```powershell
& 'D:\steam\steamapps\common\Blender\blender.exe' --background --python '.\weapons\build_weapon_assets.py'
```

The generator is deterministic and rewrites only its own v01 deliverables.
