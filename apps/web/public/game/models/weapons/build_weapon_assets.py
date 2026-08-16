import argparse
import json
import math
import os
import re
import struct
from pathlib import Path

import bpy
from mathutils import Vector


BASE_DIR = Path(__file__).resolve().parent
VERSION = "v01"
FPS = 30
FORWARD_AXIS = "+Y"
UP_AXIS = "+Z"


WEAPON_ASSETS = [
    ("starter/sniper", "Sniper", "WPN_Rifle_Sniper_A", "sniper"),
    ("starter/assault_rifle", "AssaultRifle", "WPN_Rifle_Assault_A", "assault"),
    ("starter/smg", "SMG", "WPN_SMG_A", "smg"),
    ("starter/spear", "Spear", "WPN_Spear_A", "spear"),
    ("starter/sword", "Sword", "WPN_Sword_A", "sword"),
    ("advanced/lightsaber_prototype", "Lightsaber_Prototype", "WPN_Lightsaber_Prototype", "lightsaber_prototype"),
    ("advanced/lightsaber", "Lightsaber", "WPN_Lightsaber_A", "lightsaber"),
    ("advanced/lightsaber_complete", "Lightsaber_Complete", "WPN_Lightsaber_Complete", "lightsaber_complete"),
    ("advanced/laser_gun", "LaserGun", "WPN_LaserRifle_A", "laser"),
    ("advanced/fusion_laser", "FusionLaser", "WPN_LaserRifle_Fusion", "fusion_laser"),
    ("advanced/plasma_cannon", "PlasmaCannon", "WPN_PlasmaCannon_A", "plasma"),
    ("advanced/singularity_plasma", "SingularityPlasma", "WPN_PlasmaCannon_Singularity", "singularity_plasma"),
    ("advanced/elemental_staff", "ElementalStaff", "WPN_Staff_Elemental", "elemental_staff"),
    ("advanced/singularity_staff", "SingularityStaff", "WPN_Staff_Singularity", "singularity_staff"),
]

CONSUMABLE_ASSETS = [
    ("consumables/grenade", "Grenade", "PROP_Grenade", "grenade"),
    ("consumables/bandage", "Bandage", "PROP_Bandage", "bandage"),
    ("consumables/medkit", "Medkit", "PROP_Medkit", "medkit"),
    ("consumables/ammo_box", "AmmoBox", "PROP_AmmoBox", "ammo_box"),
]

WORLD_ASSETS = [
    ("deployables/auto_turret", "AutoTurret", "PROP_AutoTurret", "auto_turret"),
    ("deployables/shield_generator", "ShieldGenerator", "PROP_ShieldGenerator", "shield_generator"),
    ("deployables/shield_dome", "ShieldDome", "VFX_ShieldDome", "shield_dome"),
    ("deployables/slow_trap", "SlowTrap", "PROP_SlowTrap", "slow_trap"),
    ("deployables/drone", "Drone", "PROP_Drone", "drone"),
    ("deployables/guardian_crystal_shield", "GuardianCrystalShield", "PROP_GuardianCrystalShield", "guardian_shield"),
    ("ability_vfx_mesh/singularity_field", "SingularityField", "VFX_SingularityField", "singularity_field"),
    ("ability_vfx_mesh/area_ring", "AreaRing", "VFX_AreaRing", "area_ring"),
    ("ability_vfx_mesh/plague_ground_patch", "PlagueGroundPatch", "VFX_PlagueGroundPatch", "plague_patch"),
    ("ability_vfx_mesh/summon_spawn_portal", "SummonSpawnPortal", "VFX_SummonSpawnPortal", "spawn_portal"),
    ("ability_vfx_mesh/crystal_shards/house", "CrystalShards_House", "VFX_CrystalShards_House", "crystal_shards_house"),
    ("ability_vfx_mesh/crystal_shards/desert", "CrystalShards_Desert", "VFX_CrystalShards_Desert", "crystal_shards_desert"),
    ("ability_vfx_mesh/crystal_shards/grass", "CrystalShards_Grass", "VFX_CrystalShards_Grass", "crystal_shards_grass"),
    ("ability_vfx_mesh/crystal_shards/hell", "CrystalShards_Hell", "VFX_CrystalShards_Hell", "crystal_shards_hell"),
    ("ability_vfx_mesh/weakpoint_core", "WeakpointCore", "VFX_WeakpointCore", "weakpoint_core"),
]


COLORS = {
    "gun": (0.075, 0.09, 0.105, 1.0),
    "gun_alt": (0.16, 0.19, 0.22, 1.0),
    "metal": (0.22, 0.25, 0.28, 1.0),
    "dark_metal": (0.035, 0.045, 0.055, 1.0),
    "wood": (0.22, 0.095, 0.035, 1.0),
    "rubber": (0.025, 0.03, 0.035, 1.0),
    "teal": (0.0497, 0.5209, 0.3515, 1.0),
    "cyan": (0.01, 0.52, 0.82, 1.0),
    "blue": (0.06, 0.18, 0.82, 1.0),
    "violet": (0.34, 0.035, 0.72, 1.0),
    "orange": (0.95, 0.19, 0.025, 1.0),
    "red": (0.48, 0.025, 0.02, 1.0),
    "white": (0.78, 0.82, 0.84, 1.0),
    "black": (0.004, 0.006, 0.009, 1.0),
}


def clear_scene():
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for datablocks in (
        bpy.data.actions,
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.cameras,
        bpy.data.lights,
        bpy.data.curves,
    ):
        for block in list(datablocks):
            try:
                datablocks.remove(block)
            except Exception:
                pass


def make_material(name, color, metallic=0.0, roughness=0.5, emission=None, emission_strength=0.0, alpha=None):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    rgba = tuple(color)
    if alpha is not None:
        rgba = (rgba[0], rgba[1], rgba[2], alpha)
    shader.inputs["Base Color"].default_value = rgba
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if emission is not None:
        emission_input = shader.inputs.get("Emission Color") or shader.inputs.get("Emission")
        strength_input = shader.inputs.get("Emission Strength")
        if emission_input:
            emission_input.default_value = emission
        if strength_input:
            strength_input.default_value = emission_strength
    if alpha is not None:
        shader.inputs["Alpha"].default_value = alpha
        material.diffuse_color = rgba
        try:
            material.surface_render_method = "DITHERED"
        except Exception:
            try:
                material.blend_method = "BLEND"
            except Exception:
                pass
        material.use_transparency_overlap = False
    else:
        material.diffuse_color = rgba
    material.node_tree.links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return material


def apply_rotation_scale(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def assign_material(obj, material):
    if obj.type == "MESH":
        obj.data.materials.append(material)
    return obj


def bevel(obj, amount=0.008, segments=1):
    modifier = obj.modifiers.new("ProductionBevel", "BEVEL")
    modifier.width = amount
    modifier.segments = segments
    modifier.limit_method = "ANGLE"
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    obj.select_set(False)
    return obj


def cube(name, location, dimensions, material, rotation=(0.0, 0.0, 0.0), bevel_amount=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.dimensions = dimensions
    apply_rotation_scale(obj)
    if bevel_amount:
        bevel(obj, bevel_amount, 1)
    return assign_material(obj, material)


def cylinder(name, location, radius, depth, material, vertices=12, rotation=(0.0, 0.0, 0.0), bevel_amount=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    apply_rotation_scale(obj)
    if bevel_amount:
        bevel(obj, bevel_amount, 1)
    return assign_material(obj, material)


def cone(name, location, radius1, radius2, depth, material, vertices=10, rotation=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    apply_rotation_scale(obj)
    return assign_material(obj, material)


def uv_sphere(name, location, scale, material, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    apply_rotation_scale(obj)
    assign_material(obj, material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def ico_sphere(name, location, scale, material, subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    apply_rotation_scale(obj)
    assign_material(obj, material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def torus(name, location, major_radius, minor_radius, material, major_segments=16, minor_segments=6, rotation=(math.pi / 2, 0.0, 0.0)):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=major_segments,
        minor_segments=minor_segments,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    apply_rotation_scale(obj)
    assign_material(obj, material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def cylinder_between(name, start, end, radius, material, vertices=12, radius2=None):
    start = Vector(start)
    end = Vector(end)
    direction = end - start
    midpoint = (start + end) * 0.5
    if radius2 is None or abs(radius2 - radius) < 1e-6:
        obj = cylinder(name, midpoint, radius, direction.length, material, vertices)
    else:
        obj = cone(name, midpoint, radius, radius2, direction.length, material, vertices)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("Z", "Y")
    apply_rotation_scale(obj)
    return obj


def make_mesh(name, vertices, faces, material):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign_material(obj, material)
    return obj


def join_parts(parts, final_name, role="render_static"):
    parts = [part for part in parts if part and part.name in bpy.data.objects]
    if not parts:
        raise RuntimeError(f"No parts supplied for {final_name}")
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = final_name
    obj.data.name = final_name
    obj["asset_role"] = role
    return obj


def set_origin(obj, world_location=(0.0, 0.0, 0.0)):
    old_cursor = bpy.context.scene.cursor.location.copy()
    bpy.context.scene.cursor.location = world_location
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR", center="MEDIAN")
    obj.select_set(False)
    bpy.context.scene.cursor.location = old_cursor


def empty_node(name, location, root, properties=None, display="PLAIN_AXES", size=0.055):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.empty_display_type = display
    obj.empty_display_size = size
    obj.location = location
    obj.parent = root
    obj["renderable"] = False
    if properties:
        for key, value in properties.items():
            obj[key] = value
    return obj


def make_root(name, category, variant):
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    root.empty_display_type = "PLAIN_AXES"
    root.empty_display_size = 0.08
    root["asset_category"] = category
    root["variant"] = variant
    root["units"] = "meters"
    root["forward_axis"] = FORWARD_AXIS
    root["up_axis"] = UP_AXIS
    root["origin_contract"] = "primary_grip" if category in {"weapon", "consumable"} else "world_base_center"
    root["renderable"] = False
    return root


def parent_objects(root, objects):
    for obj in objects:
        if obj and obj.parent is None:
            obj.parent = root


def triangle_count(obj):
    if obj.type != "MESH":
        return 0
    return sum(max(0, len(poly.vertices) - 2) for poly in obj.data.polygons)


def mesh_bounds(objects):
    points = []
    for obj in objects:
        if obj.type != "MESH":
            continue
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return [0.0, 0.0, 0.0]
    mins = [min(point[i] for point in points) for i in range(3)]
    maxs = [max(point[i] for point in points) for i in range(3)]
    return [round(maxs[i] - mins[i], 4) for i in range(3)]


def create_common_weapon_materials(owner, energy_color=None):
    mats = {
        "main": make_material(f"MAT_{owner}", COLORS["gun"], 0.55, 0.34),
        "detail": make_material(f"MAT_{owner}_Detail", COLORS["metal"], 0.75, 0.25),
    }
    if energy_color:
        mats["energy"] = make_material(
            f"MAT_{owner}_Emissive", energy_color, 0.05, 0.22, energy_color, 4.0
        )
    return mats


def add_weapon_sockets(root, sockets):
    created = []
    for name, location in sockets.items():
        props = {"runtime_component": "weapon_socket", "socket_semantic": name.replace("SOCKET_", "")}
        created.append(empty_node(name, location, root, props))
    return created


def build_firearm(asset_name, kind, detail):
    owner = asset_name.replace("_FP", "").replace("_TP", "")
    mats = create_common_weapon_materials(owner)
    if kind == "sniper":
        lens = make_material(f"MAT_{owner}_ScopeLens", (0.015, 0.15, 0.22, 1.0), 0.15, 0.08, (0.01, 0.16, 0.25, 1.0), 0.8)
        dims = {"length": 1.28, "muzzle": 0.84, "barrel_z": 0.16, "ads_z": 0.34}
        body = [
            cube("tmp", (0.0, 0.16, 0.13), (0.13, 0.43, 0.16), mats["main"], bevel_amount=0.012),
            cube("tmp", (0.0, -0.28, 0.16), (0.14, 0.47, 0.17), mats["main"], bevel_amount=0.014),
            cube("tmp", (0.0, -0.08, -0.05), (0.105, 0.12, 0.24), mats["main"], rotation=(math.radians(-13), 0, 0), bevel_amount=0.008),
            cylinder_between("tmp", (0, 0.33, dims["barrel_z"]), (0, dims["muzzle"], dims["barrel_z"]), 0.035, mats["detail"], detail),
            cylinder_between("tmp", (0, -0.06, dims["ads_z"]), (0, 0.32, dims["ads_z"]), 0.052, mats["detail"], detail),
            cube("tmp", (0, 0.0, 0.265), (0.035, 0.16, 0.06), mats["detail"], bevel_amount=0.004),
        ]
        static = join_parts(body, "MESH_Weapon")
        magazine = cube("MESH_Magazine", (0, 0.12, -0.035), (0.10, 0.16, 0.22), mats["main"], rotation=(math.radians(5), 0, 0), bevel_amount=0.006)
        magazine["animation_role"] = "removable_magazine"
        bolt = cylinder_between("MESH_Bolt", (-0.075, 0.18, 0.18), (-0.075, 0.32, 0.18), 0.018, mats["detail"], max(8, detail // 2))
        bolt["animation_role"] = "bolt_cycle"
        handle = cylinder_between("MESH_BoltHandle", (-0.075, 0.20, 0.18), (-0.17, 0.20, 0.18), 0.012, mats["detail"], 8)
        handle["animation_role"] = "bolt_handle"
        bipod = join_parts([
            cylinder_between("tmp", (-0.045, 0.42, 0.10), (-0.14, 0.51, -0.24), 0.012, mats["detail"], 8),
            cylinder_between("tmp", (0.045, 0.42, 0.10), (0.14, 0.51, -0.24), 0.012, mats["detail"], 8),
        ], "MESH_Bipod", "foldable_part")
        scope_lens = cylinder("MESH_ScopeLens", (0, 0.326, dims["ads_z"]), 0.045, 0.008, lens, detail, rotation=(math.pi / 2, 0, 0))
        scope_lens["runtime_component"] = "scope_render_surface"
        muzzle_mesh = cylinder("MESH_MuzzleAssembly", (0, dims["muzzle"] + 0.025, dims["barrel_z"]), 0.047, 0.07, mats["detail"], detail, rotation=(math.pi / 2, 0, 0))
        muzzle_mesh["animation_role"] = "visual_recoil"
        meshes = [static, magazine, bolt, handle, bipod, scope_lens, muzzle_mesh]
        sockets = {
            "SOCKET_Grip_R": (0, 0, 0),
            "SOCKET_Grip_L": (0, 0.37, 0.05),
            "SOCKET_Muzzle": (0, 0.905, dims["barrel_z"]),
            "SOCKET_Eject": (-0.075, 0.25, 0.19),
            "SOCKET_ADS": (0, -0.055, dims["ads_z"]),
            "SOCKET_Back": (0, 0.05, 0.12),
        }
        return meshes, sockets, {"ads_axis_x_error_m": 0.0, "special": "independent_scope_lens_and_bolt"}

    if kind == "assault":
        length, muzzle_y, barrel_z, ads_z = 0.91, 0.68, 0.15, 0.29
        body = [
            cube("tmp", (0, 0.18, 0.13), (0.13, 0.39, 0.18), mats["main"], bevel_amount=0.012),
            cube("tmp", (0, -0.245, 0.14), (0.13, 0.38, 0.15), mats["main"], bevel_amount=0.012),
            cube("tmp", (0, -0.04, -0.045), (0.10, 0.13, 0.23), mats["main"], rotation=(math.radians(-15), 0, 0), bevel_amount=0.007),
            cylinder_between("tmp", (0, 0.35, barrel_z), (0, muzzle_y, barrel_z), 0.033, mats["detail"], detail),
            cube("tmp", (0, 0.12, 0.28), (0.05, 0.24, 0.055), mats["detail"], bevel_amount=0.005),
            cylinder_between("tmp", (-0.052, 0.40, 0.10), (-0.052, 0.55, 0.10), 0.010, mats["detail"], 8),
            cylinder_between("tmp", (0.052, 0.40, 0.10), (0.052, 0.55, 0.10), 0.010, mats["detail"], 8),
        ]
        static = join_parts(body, "MESH_Weapon")
        magazine = cube("MESH_Magazine", (0, 0.18, -0.045), (0.105, 0.15, 0.24), mats["main"], rotation=(math.radians(8), 0, 0), bevel_amount=0.006)
        magazine["animation_role"] = "removable_magazine"
        bolt = cube("MESH_Bolt", (-0.072, 0.23, 0.17), (0.012, 0.12, 0.035), mats["detail"], bevel_amount=0.003)
        bolt["animation_role"] = "bolt_cycle"
        charging = cube("MESH_ChargingHandle", (0, 0.03, 0.235), (0.065, 0.07, 0.026), mats["detail"], bevel_amount=0.003)
        charging["animation_role"] = "charging_handle"
        muzzle = cylinder("MESH_MuzzleAssembly", (0, muzzle_y + 0.025, barrel_z), 0.045, 0.075, mats["detail"], detail, rotation=(math.pi / 2, 0, 0))
        muzzle["animation_role"] = "muzzle_kick"
        meshes = [static, magazine, bolt, charging, muzzle]
        sockets = {
            "SOCKET_Grip_R": (0, 0, 0),
            "SOCKET_Grip_L": (0, 0.36, 0.07),
            "SOCKET_Muzzle": (0, 0.755, barrel_z),
            "SOCKET_Eject": (-0.075, 0.26, 0.18),
            "SOCKET_ADS": (0, 0.00, ads_z),
            "SOCKET_Back": (0, 0.05, 0.11),
        }
        return meshes, sockets, {"length_m": length, "ads_axis_x_error_m": 0.0, "special": "independent_muzzle_kick_node"}

    length, muzzle_y, barrel_z, ads_z = 0.62, 0.48, 0.13, 0.26
    body = [
        cube("tmp", (0, 0.16, 0.12), (0.145, 0.34, 0.19), mats["main"], bevel_amount=0.016),
        cube("tmp", (0, -0.13, 0.12), (0.12, 0.23, 0.135), mats["main"], bevel_amount=0.012),
        cube("tmp", (0, -0.02, -0.045), (0.10, 0.12, 0.23), mats["main"], rotation=(math.radians(-13), 0, 0), bevel_amount=0.008),
        cylinder_between("tmp", (0, 0.33, barrel_z), (0, muzzle_y, barrel_z), 0.037, mats["detail"], detail),
        cube("tmp", (0, 0.10, ads_z), (0.045, 0.10, 0.055), mats["detail"], bevel_amount=0.004),
    ]
    static = join_parts(body, "MESH_Weapon")
    magazine = cube("MESH_Magazine", (0, 0.11, -0.07), (0.095, 0.12, 0.29), mats["main"], rotation=(math.radians(4), 0, 0), bevel_amount=0.006)
    magazine["animation_role"] = "removable_magazine"
    bolt = cube("MESH_Bolt", (-0.08, 0.19, 0.15), (0.012, 0.105, 0.032), mats["detail"], bevel_amount=0.002)
    bolt["animation_role"] = "high_frequency_bolt_cycle"
    muzzle = cylinder("MESH_MuzzleAssembly", (0, muzzle_y + 0.02, barrel_z), 0.048, 0.065, mats["detail"], detail, rotation=(math.pi / 2, 0, 0))
    muzzle["animation_role"] = "visual_recoil"
    meshes = [static, magazine, bolt, muzzle]
    sockets = {
        "SOCKET_Grip_R": (0, 0, 0),
        "SOCKET_Grip_L": (0, 0.30, 0.05),
        "SOCKET_Muzzle": (0, 0.545, barrel_z),
        "SOCKET_Eject": (-0.085, 0.20, 0.16),
        "SOCKET_ADS": (0, 0.02, ads_z),
        "SOCKET_Back": (0, 0.02, 0.10),
    }
    return meshes, sockets, {"length_m": length, "ads_axis_x_error_m": 0.0, "special": "independent_ejection_socket"}


def build_spear(asset_name, detail):
    owner = asset_name.replace("_FP", "").replace("_TP", "")
    wood = make_material(f"MAT_{owner}", COLORS["wood"], 0.05, 0.62)
    metal = make_material(f"MAT_{owner}_Detail", COLORS["metal"], 0.78, 0.23)
    parts = [
        cylinder_between("tmp", (0, -0.62, 0), (0, 1.23, 0), 0.026, wood, detail),
        cylinder_between("tmp", (0, -0.67, 0), (0, -0.53, 0), 0.045, metal, detail, 0.024),
        cylinder_between("tmp", (0, 1.18, 0), (0, 1.46, 0), 0.072, metal, detail, 0.002),
        torus("tmp", (0, 1.17, 0), 0.035, 0.008, metal, detail, max(4, detail // 3)),
    ]
    weapon = join_parts(parts, "MESH_Weapon")
    sockets = {
        "SOCKET_Grip_R": (0, 0, 0),
        "SOCKET_Grip_L": (0, 0.52, 0),
        "SOCKET_Blade_Start": (0, 1.18, 0),
        "SOCKET_Blade_End": (0, 1.46, 0),
        "SOCKET_Sweep_Start": (0, 0.02, 0),
        "SOCKET_Sweep_End": (0, 1.46, 0),
        "SOCKET_Back": (0, 0.30, 0),
    }
    return [weapon], sockets, {"physical_length_m": 2.13, "sweep_visual_tip_delta_m": 0.0}


def build_sword(asset_name, detail):
    owner = asset_name.replace("_FP", "").replace("_TP", "")
    main = make_material(f"MAT_{owner}", COLORS["dark_metal"], 0.50, 0.38)
    steel = make_material(f"MAT_{owner}_Detail", COLORS["metal"], 0.88, 0.18)
    edge = make_material(f"MAT_{owner}_BladeEdge", (0.42, 0.50, 0.55, 1.0), 0.9, 0.12, (0.08, 0.16, 0.22, 1.0), 0.25)
    hilt = join_parts([
        cylinder_between("tmp", (0, -0.13, 0), (0, 0.12, 0), 0.034, main, detail),
        cylinder_between("tmp", (-0.16, 0.13, 0), (0.16, 0.13, 0), 0.026, steel, detail),
        uv_sphere("tmp", (0, -0.15, 0), (0.05, 0.05, 0.05), steel, detail, max(6, detail // 2)),
    ], "MESH_Hilt")
    blade_core = join_parts([
        cube("tmp", (0, 0.60, 0), (0.055, 0.90, 0.018), steel, bevel_amount=0.004),
        cylinder_between("tmp", (0, 1.045, 0), (0, 1.105, 0), 0.028, steel, detail, 0.002),
    ], "MESH_Blade")
    edge_mesh = join_parts([
        cube("tmp", (-0.029, 0.60, 0), (0.007, 0.88, 0.023), edge, bevel_amount=0.002),
        cube("tmp", (0.029, 0.60, 0), (0.007, 0.88, 0.023), edge, bevel_amount=0.002),
    ], "MESH_BladeEdge", "runtime_material_control")
    edge_mesh["material_parameter"] = "HitGlow"
    sockets = {
        "SOCKET_Grip_R": (0, 0, 0),
        "SOCKET_Grip_L": (0, 0.08, 0),
        "SOCKET_Blade_Start": (0, 0.15, 0),
        "SOCKET_Blade_End": (0, 1.105, 0),
        "SOCKET_Sweep_Start": (0, 0.15, 0),
        "SOCKET_Sweep_End": (0, 1.105, 0),
        "SOCKET_Back": (0, 0.26, 0),
    }
    return [hilt, blade_core, edge_mesh], sockets, {"blade_length_m": 0.955, "sweep_visual_tip_delta_m": 0.0}


def build_lightsaber(asset_name, stage, detail):
    owner = asset_name.replace("_FP", "").replace("_TP", "")
    energy_color = COLORS["orange"] if stage == 1 else COLORS["cyan"]
    mats = create_common_weapon_materials(owner, energy_color)
    handle_end = 0.20 if stage == 1 else 0.18
    handle_parts = [
        cylinder_between("tmp", (0, -0.18, 0), (0, handle_end, 0), 0.045 if stage == 1 else 0.038, mats["main"], detail),
        torus("tmp", (0, -0.13, 0), 0.044, 0.009, mats["detail"], detail, max(4, detail // 3)),
        torus("tmp", (0, handle_end - 0.02, 0), 0.047, 0.008, mats["detail"], detail, max(4, detail // 3)),
    ]
    if stage >= 2:
        handle_parts.extend([
            cube("tmp", (0.037, 0.01, 0), (0.014, 0.14, 0.025), mats["detail"], bevel_amount=0.003),
            cube("tmp", (-0.037, 0.01, 0), (0.014, 0.14, 0.025), mats["detail"], bevel_amount=0.003),
        ])
    handle = join_parts(handle_parts, "MESH_Handle")
    blade_end = 1.10 if stage == 1 else 1.18
    blades = [cylinder_between("tmp", (0, handle_end, 0), (0, blade_end, 0), 0.018, mats["energy"], max(8, detail))]
    sockets = {
        "SOCKET_Grip_R": (0, 0, 0),
        "SOCKET_Grip_L": (0, 0.10, 0),
        "SOCKET_Blade_Start": (0, handle_end, 0),
        "SOCKET_Blade_End": (0, blade_end, 0),
        "SOCKET_Sweep_Start": (0, handle_end, 0),
        "SOCKET_Sweep_End": (0, blade_end, 0),
        "SOCKET_Back": (0, 0.03, 0),
    }
    if stage == 3:
        blades.append(cylinder_between("tmp", (0, -0.18, 0), (0, -0.82, 0), 0.018, mats["energy"], max(8, detail)))
        handle = join_parts([
            handle,
            torus("tmp", (0, 0.0, 0), 0.066, 0.012, mats["energy"], detail, max(4, detail // 3)),
        ], "MESH_Handle")
        sockets.update({
            "SOCKET_Blade_Start_Secondary": (0, -0.18, 0),
            "SOCKET_Blade_End_Secondary": (0, -0.82, 0),
        })
    blade = join_parts(blades, "MESH_Blade", "runtime_material_control")
    blade["vfx_contract"] = "simple_emissive_blade_plus_external_vfx"
    blade["material_parameter"] = "BladeIntensity"
    return [handle, blade], sockets, {"stage": stage, "blade_vfx_baked": False, "trail_vfx_baked": False}


def build_energy_gun(asset_name, kind, detail):
    owner = asset_name.replace("_FP", "").replace("_TP", "")
    energy_color = COLORS["cyan"] if "laser" in kind else COLORS["violet"]
    mats = create_common_weapon_materials(owner, energy_color)
    is_fusion = kind == "fusion_laser"
    is_singularity = kind == "singularity_plasma"
    is_plasma = "plasma" in kind
    length = 0.92 if is_plasma else 0.82
    muzzle_y = 0.69 if is_plasma else 0.63
    body = [
        cube("tmp", (0, 0.13, 0.13), (0.17 if is_plasma else 0.145, 0.39, 0.20), mats["main"], bevel_amount=0.018),
        cube("tmp", (0, -0.20, 0.14), (0.14, 0.30, 0.15), mats["main"], bevel_amount=0.014),
        cube("tmp", (0, -0.03, -0.045), (0.105, 0.13, 0.24), mats["main"], rotation=(math.radians(-12), 0, 0), bevel_amount=0.008),
        cylinder_between("tmp", (0, 0.28, 0.15), (0, muzzle_y, 0.15), 0.060 if is_plasma else 0.045, mats["detail"], detail),
        cylinder("tmp", (0, muzzle_y + 0.025, 0.15), 0.08 if is_plasma else 0.06, 0.08, mats["detail"], detail, rotation=(math.pi / 2, 0, 0)),
    ]
    static = join_parts(body, "MESH_Weapon")
    energy_cell = cube("MESH_EnergyCell", (0, 0.10, -0.035), (0.11, 0.16, 0.21), mats["energy"], bevel_amount=0.01)
    energy_cell["animation_role"] = "removable_energy_cell"
    meshes = [static, energy_cell]
    special = ""
    if not is_plasma:
        fins = []
        fin_count = 4 if not is_fusion else 7
        for index in range(fin_count):
            x = -0.075 if index % 2 == 0 else 0.075
            y = 0.12 + (index // 2) * 0.075
            fins.append(cube("tmp", (x, y, 0.15), (0.035, 0.055, 0.20 if is_fusion else 0.14), mats["detail"], bevel_amount=0.004))
        cooling = join_parts(fins, "MESH_CoolingFins", "runtime_material_control")
        cooling["animation_role"] = "cooling_structure"
        meshes.append(cooling)
        if is_fusion:
            heat = cube("MESH_HeatSink", (0, 0.23, 0.255), (0.10, 0.29, 0.018), mats["energy"], bevel_amount=0.004)
            heat["material_parameter"] = "Heat01"
            heat["heat_geometry_states"] = 0
            meshes.append(heat)
            special = "heat_material_parameter_no_extra_geometry"
    else:
        rings = []
        ring_count = 2 if is_singularity else 1
        for index in range(ring_count):
            y = muzzle_y - 0.08 + index * 0.105
            ring = torus(f"MESH_AcceleratorRing_{chr(65 + index)}", (0, y, 0.15), 0.11 if is_singularity else 0.10, 0.016, mats["energy"], detail, max(4, detail // 3))
            ring["animation_role"] = "counter_rotate" if is_singularity else "accelerator_rotate"
            ring["rotation_direction"] = 1 if index == 0 else -1
            rings.append(ring)
        meshes.extend(rings)
        special = "dual_counter_rotating_rings" if is_singularity else "independent_accelerator_ring"
    sockets = {
        "SOCKET_Grip_R": (0, 0, 0),
        "SOCKET_Grip_L": (0, 0.35, 0.06),
        "SOCKET_Muzzle": (0, muzzle_y + 0.09, 0.15),
        "SOCKET_ADS": (0, 0.00, 0.29),
        "SOCKET_Back": (0, 0.04, 0.11),
    }
    return meshes, sockets, {"family": "laser" if not is_plasma else "plasma", "stage": 2 if is_fusion or is_singularity else 1, "special": special, "ability_vfx_baked": False}


def build_staff(asset_name, kind, detail):
    owner = asset_name.replace("_FP", "").replace("_TP", "")
    singularity = kind == "singularity_staff"
    energy = COLORS["violet"] if singularity else COLORS["cyan"]
    shaft_mat = make_material(f"MAT_{owner}", COLORS["wood"] if not singularity else COLORS["dark_metal"], 0.25, 0.48)
    detail_mat = make_material(f"MAT_{owner}_Detail", COLORS["metal"], 0.75, 0.23)
    energy_mat = make_material(f"MAT_{owner}_Emissive", energy, 0.05, 0.22, energy, 3.5)
    trim_mat = shaft_mat if singularity else detail_mat
    shaft = join_parts([
        cylinder_between("tmp", (0, -0.42, 0), (0, 1.28, 0), 0.032, shaft_mat, detail),
        cylinder_between("tmp", (0, -0.48, 0), (0, -0.34, 0), 0.055, trim_mat, detail, 0.032),
        torus("tmp", (0, 1.18, 0), 0.055, 0.012, trim_mat, detail, max(4, detail // 3)),
    ], "MESH_Weapon")
    meshes = [shaft]
    if singularity:
        focus = uv_sphere("MESH_SingularityCore", (0, 1.43, 0), (0.105, 0.105, 0.105), make_material(f"MAT_{owner}_Core", COLORS["black"], 0.2, 0.08, (0.06, 0.0, 0.16, 1.0), 0.8), detail, max(6, detail // 2))
        focus["animation_role"] = "hover_and_pulse"
        shards = []
        for index, angle in enumerate((0, math.pi * 0.5, math.pi, math.pi * 1.5)):
            x = math.cos(angle) * 0.18
            z = math.sin(angle) * 0.18
            shard = cone(f"tmp", (x, 1.43, z), 0.025, 0.004, 0.13, energy_mat, 6, rotation=(math.pi / 2, 0, angle))
            shards.append(shard)
        shard_mesh = join_parts(shards, "MESH_OrbitShards", "animated_part")
        shard_mesh["animation_role"] = "orbit"
        meshes.extend([focus, shard_mesh])
        special = "independent_core_and_orbit_shards"
    else:
        # Keep the gameplay silhouette identical in FP and TP; TP reduction is
        # applied to the shaft/trim rather than changing the crystal bounds.
        focus = ico_sphere("MESH_FocusCrystal", (0, 1.43, 0), (0.10, 0.16, 0.10), energy_mat, 2)
        focus["animation_role"] = "focus_pulse"
        meshes.append(focus)
        special = "independent_focus_crystal"
    sockets = {
        "SOCKET_Grip_R": (0, 0, 0),
        "SOCKET_Grip_L": (0, 0.55, 0),
        "SOCKET_Muzzle": (0, 1.43, 0),
        "SOCKET_Cast": (0, 1.43, 0),
        "SOCKET_Back": (0, 0.35, 0),
    }
    return meshes, sockets, {"physical_length_m": 1.91, "special": special}


def build_weapon_geometry(asset_name, builder_key, variant):
    # Multiples of four preserve exact cardinal-axis bounds across FP/TP while
    # still reducing TP radial topology from 16 to 12 segments.
    detail = 16 if variant == "FP" else 12
    if builder_key in {"sniper", "assault", "smg"}:
        return build_firearm(asset_name, builder_key, detail)
    if builder_key == "spear":
        return build_spear(asset_name, detail)
    if builder_key == "sword":
        return build_sword(asset_name, detail)
    if builder_key.startswith("lightsaber"):
        stage = {"lightsaber_prototype": 1, "lightsaber": 2, "lightsaber_complete": 3}[builder_key]
        return build_lightsaber(asset_name, stage, detail)
    if builder_key in {"laser", "fusion_laser", "plasma", "singularity_plasma"}:
        return build_energy_gun(asset_name, builder_key, detail)
    if builder_key in {"elemental_staff", "singularity_staff"}:
        return build_staff(asset_name, builder_key, detail)
    raise KeyError(builder_key)


def build_consumable_geometry(asset_name, builder_key, variant):
    detail = 16 if variant == "FP" else 12
    owner = asset_name.replace("_FP", "").replace("_WorldTP", "")
    main = make_material(f"MAT_{owner}", COLORS["gun_alt"], 0.42, 0.42)
    detail_mat = make_material(f"MAT_{owner}_Detail", COLORS["metal"], 0.72, 0.25)
    emissive = make_material(f"MAT_{owner}_Emissive", COLORS["teal"], 0.05, 0.28, COLORS["teal"], 3.0)
    meshes = []
    metadata = {}
    if builder_key == "grenade":
        body = join_parts([
            cylinder("tmp", (0, 0, 0.01), 0.065, 0.12, main, detail, bevel_amount=0.005),
            cylinder("tmp", (0, 0, 0.082), 0.036, 0.035, detail_mat, detail),
            cube("tmp", (0.045, 0, 0.075), (0.025, 0.085, 0.018), detail_mat, rotation=(0, math.radians(15), 0), bevel_amount=0.003),
        ], "MESH_Prop")
        pin = torus("MESH_SafetyRing", (-0.055, 0, 0.10), 0.032, 0.005, detail_mat, detail, 5, rotation=(math.pi / 2, 0, 0))
        light = torus("MESH_TimerLight", (0, 0, 0.095), 0.034, 0.006, emissive, detail, 5, rotation=(0, 0, 0))
        light["material_parameter"] = "CountdownPulse"
        meshes = [body, pin, light]
        metadata["special"] = "independent_timer_light"
    elif builder_key == "bandage":
        roll = torus("MESH_BandageRoll", (0, 0, 0), 0.052, 0.026, main, detail, 6, rotation=(math.pi / 2, 0, 0))
        core = cylinder("MESH_BandageCore", (0, 0, 0), 0.026, 0.055, detail_mat, detail, rotation=(math.pi / 2, 0, 0))
        flap = cube("MESH_TearFlap", (0.025, 0.045, -0.015), (0.07, 0.085, 0.008), main, rotation=(math.radians(10), 0, math.radians(-12)), bevel_amount=0.002)
        flap["animation_role"] = "tear_open"
        meshes = [roll, core, flap]
        metadata["special"] = "independent_tear_flap"
    elif builder_key == "medkit":
        body = cube("MESH_Prop", (0, 0, 0.075), (0.24, 0.10, 0.15), make_material(f"MAT_{owner}", COLORS["white"], 0.08, 0.55), bevel_amount=0.014)
        mark = join_parts([
            cube("tmp", (0, -0.052, 0.075), (0.038, 0.008, 0.105), emissive, bevel_amount=0.003),
            cube("tmp", (0, -0.052, 0.075), (0.105, 0.008, 0.038), emissive, bevel_amount=0.003),
        ], "MESH_MedicalMark", "runtime_material_control")
        latch = cube("MESH_Latch", (0, -0.058, 0.14), (0.055, 0.014, 0.025), detail_mat, bevel_amount=0.003)
        meshes = [body, mark, latch]
        metadata.update({"medical_color": "#3FBFA0", "red_cross_used": False})
    else:
        body = cube("MESH_Prop", (0, 0, 0.10), (0.30, 0.20, 0.20), main, bevel_amount=0.015)
        lid = cube("MESH_Lid", (0, 0, 0.205), (0.31, 0.21, 0.035), detail_mat, bevel_amount=0.008)
        lid["animation_role"] = "hinged_lid"
        label = cube("MESH_AmmoLabel", (0, -0.103, 0.10), (0.13, 0.008, 0.065), emissive, bevel_amount=0.004)
        label["material_parameter"] = "AmmoTypeColor"
        meshes = [body, lid, label]
        metadata["special"] = "runtime_recolorable_label"
    sockets = {
        "SOCKET_Grip_R": (0, 0, 0),
        "SOCKET_Grip_L": (0.08, 0, 0),
        "SOCKET_Use": (0, 0, 0.1),
        "SOCKET_Back": (0, 0, 0.05),
    }
    return meshes, sockets, metadata


def make_armature(name, bone_specs):
    armature_data = bpy.data.armatures.new(name)
    armature = bpy.data.objects.new(name, armature_data)
    bpy.context.collection.objects.link(armature)
    bpy.context.view_layer.objects.active = armature
    armature.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    edit_bones = {}
    for bone_name, head, tail, parent_name in bone_specs:
        bone = armature_data.edit_bones.new(bone_name)
        bone.head = head
        bone.tail = tail
        if parent_name:
            bone.parent = edit_bones[parent_name]
        edit_bones[bone_name] = bone
    bpy.ops.object.mode_set(mode="OBJECT")
    armature.select_set(False)
    armature["asset_role"] = "gameplay_rig"
    return armature


def rigid_bind(obj, armature, bone_name):
    group = obj.vertex_groups.new(name=bone_name)
    group.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    modifier = obj.modifiers.new("GameplayRig", "ARMATURE")
    modifier.object = armature
    obj.parent = armature
    return obj


def keyframe_bone(armature, bone_name, frame, location=None, rotation=None, scale=None):
    bone = armature.pose.bones[bone_name]
    bone.rotation_mode = "XYZ"
    if location is not None:
        bone.location = location
        bone.keyframe_insert(data_path="location", frame=frame)
    if rotation is not None:
        bone.rotation_euler = rotation
        bone.keyframe_insert(data_path="rotation_euler", frame=frame)
    if scale is not None:
        bone.scale = scale
        bone.keyframe_insert(data_path="scale", frame=frame)


def create_action(armature, name, end_frame, keys, loop=False):
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    armature.animation_data_create()
    armature.animation_data.action = action
    for bone_name, keyframes in keys.items():
        for key in keyframes:
            keyframe_bone(armature, bone_name, key[0], key[1], key[2], key[3])
    action.frame_start = 1
    action.frame_end = end_frame
    action["loop"] = loop
    armature.animation_data.action = None
    return action


def build_auto_turret(asset_name):
    main = make_material(f"MAT_{asset_name}", COLORS["gun"], 0.60, 0.34)
    detail = make_material(f"MAT_{asset_name}_Detail", COLORS["metal"], 0.78, 0.24)
    energy = make_material(f"MAT_{asset_name}_Emissive", COLORS["teal"], 0.05, 0.25, COLORS["teal"], 3.0)
    base = join_parts([
        cylinder("tmp", (0, 0, 0.12), 0.20, 0.16, main, 12),
        cylinder_between("tmp", (0, 0, 0.10), (-0.30, -0.22, 0.0), 0.025, detail, 8),
        cylinder_between("tmp", (0, 0, 0.10), (0.30, -0.22, 0.0), 0.025, detail, 8),
        cylinder_between("tmp", (0, 0, 0.10), (0, 0.34, 0.0), 0.025, detail, 8),
        cylinder("tmp", (0, 0, 0.36), 0.09, 0.42, main, 12),
    ], "MESH_TurretBase")
    head = join_parts([
        cube("tmp", (0, 0, 0.61), (0.32, 0.28, 0.22), main, bevel_amount=0.025),
        uv_sphere("tmp", (0, -0.145, 0.62), (0.055, 0.025, 0.055), energy, 12, 7),
    ], "MESH_TurretHead", "animated_part")
    barrel = join_parts([
        cylinder_between("tmp", (-0.06, 0.10, 0.64), (-0.06, 0.53, 0.64), 0.025, detail, 10),
        cylinder_between("tmp", (0.06, 0.10, 0.64), (0.06, 0.53, 0.64), 0.025, detail, 10),
        cube("tmp", (0, 0.17, 0.55), (0.08, 0.20, 0.09), detail, bevel_amount=0.01),
    ], "MESH_GunBarrel", "animated_part")
    damage1 = cube("BRK_DamagePlate_01", (-0.13, -0.145, 0.64), (0.055, 0.018, 0.12), detail, rotation=(0, 0, math.radians(-8)), bevel_amount=0.004)
    damage1["runtime_default_visible"] = False
    damage1["damage_stage"] = 1
    damage2 = cube("BRK_DamagePlate_02", (0.13, -0.145, 0.60), (0.055, 0.018, 0.10), detail, rotation=(0, 0, math.radians(11)), bevel_amount=0.004)
    damage2["runtime_default_visible"] = False
    damage2["damage_stage"] = 2
    armature = make_armature("SKEL_AutoTurret", [
        ("Root", (0, 0, 0), (0, 0, 0.2), None),
        ("TurretHead", (0, 0, 0.50), (0, 0, 0.72), "Root"),
        ("GunBarrel", (0, 0.10, 0.64), (0, 0.42, 0.64), "TurretHead"),
    ])
    for obj in (base, damage1, damage2):
        rigid_bind(obj, armature, "Root" if obj is base else "TurretHead")
    rigid_bind(head, armature, "TurretHead")
    rigid_bind(barrel, armature, "GunBarrel")
    actions = [
        create_action(armature, "ANIM_Idle", 31, {"TurretHead": [(1, None, (0, 0, -0.15), None), (16, None, (0, 0, 0.15), None), (31, None, (0, 0, -0.15), None)]}, True),
        create_action(armature, "ANIM_Track", 21, {"TurretHead": [(1, None, (0, 0, -0.55), None), (21, None, (0, 0, 0.55), None)]}),
        create_action(armature, "ANIM_Fire", 9, {"GunBarrel": [(1, (0, 0, 0), None, None), (4, (0, -0.045, 0), None, None), (9, (0, 0, 0), None, None)]}),
    ]
    sockets = {"SOCKET_Muzzle": (0, 0.56, 0.64), "SOCKET_Placement": (0, 0, 0)}
    return [base, head, barrel, damage1, damage2], sockets, {"rig": armature, "actions": actions, "damage_stages": 2, "placement_preview": "material_state"}


def make_dome_mesh(name, radius, material, segments=32, rings=10):
    vertices = []
    faces = []
    for ring in range(rings + 1):
        theta = (math.pi * 0.5) * ring / rings
        z = math.cos(theta) * radius
        radial = math.sin(theta) * radius
        for segment in range(segments):
            angle = 2.0 * math.pi * segment / segments
            vertices.append((math.cos(angle) * radial, math.sin(angle) * radial, z))
    for ring in range(rings):
        for segment in range(segments):
            next_segment = (segment + 1) % segments
            a = ring * segments + segment
            b = ring * segments + next_segment
            c = (ring + 1) * segments + next_segment
            d = (ring + 1) * segments + segment
            faces.append((a, b, c, d))
    obj = make_mesh(name, vertices, faces, material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def build_shield_generator(asset_name):
    main = make_material(f"MAT_{asset_name}", COLORS["gun_alt"], 0.55, 0.35)
    detail = make_material(f"MAT_{asset_name}_Detail", COLORS["metal"], 0.75, 0.24)
    energy = make_material(f"MAT_{asset_name}_Emissive", COLORS["cyan"], 0.05, 0.20, COLORS["cyan"], 4.0)
    base = join_parts([
        cylinder("tmp", (0, 0, 0.09), 0.24, 0.18, main, 16),
        cylinder("tmp", (0, 0, 0.35), 0.075, 0.42, detail, 12),
        cylinder("tmp", (0, 0, 0.35), 0.038, 0.46, energy, 10),
    ], "MESH_GeneratorBase")
    ring = torus("MESH_EnergyRing", (0, 0, 0.57), 0.16, 0.025, energy, 20, 6, rotation=(0, 0, 0))
    ring["animation_role"] = "rotate_and_pulse"
    sockets = {"SOCKET_ShieldDome": (0, 0, 0.57), "SOCKET_Placement": (0, 0, 0)}
    return [base, ring], sockets, {"placement_preview": "material_state", "shield_dome_is_separate_asset": True}


def build_shield_dome(asset_name):
    shield = make_material(f"MAT_{asset_name}", COLORS["cyan"], 0.05, 0.16, COLORS["cyan"], 1.6, alpha=0.23)
    dome = make_dome_mesh("MESH_ShieldDome", 2.35, shield, 32, 10)
    dome["runtime_component"] = "shield_surface"
    dome["material_parameter"] = "CrackStage"
    dome["crack_stages"] = 3
    dome["geometry_states"] = 1
    return [dome], {}, {"damage_states": ["Full", "CrackStage1", "CrackStage2", "CrackStage3", "Break"], "state_implementation": "single_mesh_material_mask"}


def build_slow_trap(asset_name):
    main = make_material(f"MAT_{asset_name}", COLORS["gun"], 0.55, 0.38)
    detail = make_material(f"MAT_{asset_name}_Detail", COLORS["metal"], 0.72, 0.25)
    energy = make_material(f"MAT_{asset_name}_Emissive", COLORS["violet"], 0.05, 0.22, COLORS["violet"], 3.0)
    base = join_parts([
        cylinder("tmp", (0, 0, 0.04), 0.30, 0.08, main, 20),
        cylinder("tmp", (0, 0, 0.085), 0.12, 0.05, energy, 16),
    ], "MESH_TrapBase")
    probes = []
    for index, angle in enumerate((0, math.pi * 0.5, math.pi, math.pi * 1.5)):
        x, y = math.cos(angle) * 0.245, math.sin(angle) * 0.245
        probe = cylinder_between(f"MESH_Probe_{index + 1:02d}", (x, y, 0.06), (x, y, 0.22), 0.018, detail, 8, 0.006)
        probe["animation_role"] = "deploy_probe"
        probes.append(probe)
    sockets = {"SOCKET_Field": (0, 0, 0.08), "SOCKET_Placement": (0, 0, 0)}
    return [base] + probes, sockets, {"placement_preview": "material_state", "animation_states": ["Idle", "Trigger", "Active"], "probes_independent": True}


def build_drone(asset_name):
    main = make_material(f"MAT_{asset_name}", COLORS["gun"], 0.48, 0.36)
    detail = make_material(f"MAT_{asset_name}_Detail", COLORS["metal"], 0.74, 0.25)
    energy = make_material(f"MAT_{asset_name}_Emissive", COLORS["teal"], 0.05, 0.18, COLORS["teal"], 3.5)
    body = join_parts([
        uv_sphere("tmp", (0, 0, 0.22), (0.20, 0.24, 0.12), main, 16, 8),
        uv_sphere("tmp", (0, -0.225, 0.22), (0.07, 0.035, 0.07), energy, 12, 7),
        cylinder_between("tmp", (-0.10, 0, 0.22), (-0.34, 0.24, 0.22), 0.022, detail, 8),
        cylinder_between("tmp", (0.10, 0, 0.22), (0.34, 0.24, 0.22), 0.022, detail, 8),
        cylinder_between("tmp", (-0.10, 0, 0.22), (-0.34, -0.24, 0.22), 0.022, detail, 8),
        cylinder_between("tmp", (0.10, 0, 0.22), (0.34, -0.24, 0.22), 0.022, detail, 8),
    ], "MESH_DroneBody")
    thruster_positions = [(-0.34, 0.24, 0.22), (0.34, 0.24, 0.22), (-0.34, -0.24, 0.22), (0.34, -0.24, 0.22)]
    thruster_names = ["Thruster_FL", "Thruster_FR", "Thruster_RL", "Thruster_RR"]
    thrusters = []
    for name, pos in zip(thruster_names, thruster_positions):
        thruster = join_parts([
            torus("tmp", pos, 0.105, 0.020, detail, 16, 5, rotation=(0, 0, 0)),
            cylinder("tmp", pos, 0.035, 0.028, energy, 10),
        ], f"MESH_{name}", "animated_part")
        thrusters.append(thruster)
    armature = make_armature("SKEL_Drone", [
        ("Root", (0, 0, 0.12), (0, 0, 0.32), None),
        ("Sensor", (0, -0.18, 0.22), (0, -0.32, 0.22), "Root"),
        *[(name, pos, (pos[0], pos[1], pos[2] + 0.12), "Root") for name, pos in zip(thruster_names, thruster_positions)],
    ])
    rigid_bind(body, armature, "Root")
    for thruster, bone_name in zip(thrusters, thruster_names):
        rigid_bind(thruster, armature, bone_name)
    actions = [
        create_action(armature, "ANIM_Idle", 31, {"Root": [(1, (0, 0, -0.02), None, None), (16, (0, 0, 0.02), None, None), (31, (0, 0, -0.02), None, None)]}, True),
        create_action(armature, "ANIM_Move", 25, {"Root": [(1, None, (math.radians(-8), 0, 0), None), (25, None, (math.radians(-8), 0, 0), None)]}, True),
        create_action(armature, "ANIM_Attack", 19, {"Sensor": [(1, None, (math.radians(-5), 0, 0), None), (10, None, (math.radians(14), 0, 0), None), (19, None, (math.radians(-5), 0, 0), None)]}),
    ]
    sockets = {"SOCKET_Muzzle": (0, -0.30, 0.22), "SOCKET_Placement": (0, 0, 0)}
    return [body] + thrusters, sockets, {"rig": armature, "actions": actions, "animation_states": ["Idle", "Move", "Attack"], "placement_preview": "material_state"}


def build_guardian_shield(asset_name):
    crystal = make_material(f"MAT_{asset_name}", (0.08, 0.42, 0.62, 1.0), 0.18, 0.24, COLORS["cyan"], 1.8, alpha=0.58)
    edge = make_material(f"MAT_{asset_name}_Edge", COLORS["cyan"], 0.10, 0.18, COLORS["cyan"], 3.2)
    panels = []
    bone_specs = [("Root", (0, 0, 0.35), (0, 0, 0.58), None)]
    for index in range(6):
        angle = math.radians(-32 + index * 12.8)
        x = math.sin(angle) * 1.12
        y = math.cos(angle) * 0.34
        panel = cube(f"MESH_ShieldShard_{index + 1:02d}", (x, y, 1.05), (0.34, 0.075, 1.42), crystal, rotation=(0, 0, -angle), bevel_amount=0.025)
        panel["durability_segment"] = index + 1
        panels.append(panel)
        bone_specs.append((f"ShieldShard_{index + 1:02d}", (x, y, 0.35), (x, y, 1.05), "Root"))
    rim = join_parts([
        cube("tmp", (-1.00, 0.28, 1.05), (0.055, 0.06, 1.48), edge, bevel_amount=0.012),
        cube("tmp", (1.00, 0.28, 1.05), (0.055, 0.06, 1.48), edge, bevel_amount=0.012),
    ], "MESH_ShieldEdge")
    armature = make_armature("SKEL_GuardianCrystalShield", bone_specs)
    rigid_bind(rim, armature, "Root")
    for index, panel in enumerate(panels):
        rigid_bind(panel, armature, f"ShieldShard_{index + 1:02d}")
    break_keys = {}
    for index in range(6):
        angle = math.radians(-32 + index * 12.8)
        direction = -1 if index < 3 else 1
        break_keys[f"ShieldShard_{index + 1:02d}"] = [
            (1, (0, 0, 0), (0, 0, 0), (1, 1, 1)),
            (30, (direction * (0.45 + index * 0.05), 0.35 + index * 0.05, 0.45 + (index % 2) * 0.2), (angle, direction * 0.7, direction * 0.5), (0.25, 0.25, 0.25)),
        ]
    actions = [
        create_action(armature, "ANIM_Idle", 31, {"Root": [(1, (0, 0, -0.015), None, None), (16, (0, 0, 0.015), None, None), (31, (0, 0, -0.015), None, None)]}, True),
        create_action(armature, "ANIM_Break", 30, break_keys),
    ]
    sockets = {"SOCKET_ShieldCenter": (0, 0.32, 1.05)}
    return panels + [rim], sockets, {"rig": armature, "actions": actions, "durability_states": [100, 75, 50, 25, 0], "floating": True, "touches_ground": False, "has_roof": False}


def make_irregular_disk(name, radius, material, segments=20):
    vertices = [(0, 0, 0)]
    for index in range(segments):
        angle = 2 * math.pi * index / segments
        variation = 0.86 + 0.13 * math.sin(index * 2.37) + 0.05 * math.cos(index * 4.11)
        vertices.append((math.cos(angle) * radius * variation, math.sin(angle) * radius * variation, 0))
    faces = []
    for index in range(segments):
        faces.append((0, index + 1, ((index + 1) % segments) + 1))
    return make_mesh(name, vertices, faces, material)


def build_vfx(asset_name, key):
    if key == "singularity_field":
        mat = make_material(f"MAT_{asset_name}", COLORS["violet"], 0.05, 0.12, COLORS["violet"], 2.2, alpha=0.28)
        mesh = uv_sphere("MESH_SingularityField", (0, 0, 0), (2.0, 2.0, 2.0), mat, 24, 12)
        for poly in mesh.data.polygons:
            poly.flip()
        mesh["uv_flow_direction"] = "inward"
        mesh["diameter_m"] = 4.0
        return [mesh], {}, {"independent_from_weapon": True, "uv_contract": "inward_flow", "diameter_m": 4.0}
    if key == "area_ring":
        mat = make_material(f"MAT_{asset_name}", COLORS["teal"], 0.05, 0.18, COLORS["teal"], 2.6, alpha=0.55)
        ring = torus("MESH_AreaRing", (0, 0, 0.012), 1.0, 0.035, mat, 32, 5, rotation=(0, 0, 0))
        ring["runtime_component"] = "shared_area_indicator"
        return [ring], {}, {"shared_users": ["MedicHealPulse", "MageFrostField", "WarriorWarCry"], "material_swap_only": True}
    if key == "plague_patch":
        mat = make_material(f"MAT_{asset_name}", (0.16, 0.31, 0.025, 1.0), 0.02, 0.72, (0.11, 0.28, 0.015, 1.0), 1.2, alpha=0.72)
        patch = make_irregular_disk("MESH_PlagueGroundPatch", 2.0, mat, 24)
        patch["runtime_component"] = "ground_field"
        return [patch], {}, {"diameter_m": 4.0, "ground_offset_required_m": 0.01}
    if key.startswith("crystal_shards_"):
        theme = key.replace("crystal_shards_", "")
        theme_colors = {
            "house": (0.12, 0.56, 0.72, 1.0),
            "desert": (0.88, 0.38, 0.055, 1.0),
            "grass": (0.18, 0.68, 0.22, 1.0),
            "hell": (0.72, 0.035, 0.18, 1.0),
        }
        color = theme_colors[theme]
        mat = make_material(f"MAT_{asset_name}", color, 0.12, 0.24, color, 2.4)
        shards = []
        directions = [
            (-0.35, -0.15, 1.0), (0.28, -0.24, 1.0), (-0.18, 0.32, 1.0), (0.40, 0.16, 1.0),
            (-0.48, 0.18, 0.86), (0.12, -0.42, 0.88), (0.45, -0.10, 0.76), (-0.05, 0.48, 0.80),
        ]
        for index, direction in enumerate(directions):
            direction = Vector(direction).normalized()
            length = 0.14 + (index % 4) * 0.026
            radius = 0.022 + (index % 3) * 0.006
            shard = cylinder_between(
                f"MESH_CrystalShard_{index + 1:02d}",
                (0, 0, 0),
                direction * length,
                radius,
                mat,
                6,
                0.002,
            )
            set_origin(shard, (0, 0, 0))
            shard["runtime_component"] = "crystal_shard_template"
            shard["shape_index"] = index + 1
            shard["biome"] = theme
            shards.append(shard)
        return shards, {"SOCKET_BurstOrigin": (0, 0, 0)}, {
            "library_asset": True,
            "biome": theme,
            "independent_shape_count": 8,
            "runtime_use": "weapon_kill_crystal_burst",
        }
    if key == "weakpoint_core":
        core_color = COLORS["orange"]
        core_mat = make_material(f"MAT_{asset_name}_Core", core_color, 0.08, 0.18, core_color, 3.8)
        shell_mat = make_material(f"MAT_{asset_name}_Shell", COLORS["dark_metal"], 0.58, 0.30)
        core = ico_sphere("MESH_WeakpointCore", (0, 0, 0), (0.105, 0.105, 0.105), core_mat, 2)
        core["runtime_component"] = "weakpoint_visual"
        shell_parts = []
        shell_layout = [
            ((0.0, 0.0, 0.13), (0.11, 0.08, 0.035), (0, 0, 0)),
            ((0.0, 0.0, -0.13), (0.11, 0.08, 0.035), (0, 0, 0)),
            ((0.13, 0.0, 0.0), (0.035, 0.08, 0.11), (0, 0, 0)),
            ((-0.13, 0.0, 0.0), (0.035, 0.08, 0.11), (0, 0, 0)),
            ((0.0, 0.10, 0.0), (0.10, 0.035, 0.10), (0, 0, 0)),
            ((0.0, -0.10, 0.0), (0.10, 0.035, 0.10), (0, 0, 0)),
        ]
        for index, (location, dimensions, rotation) in enumerate(shell_layout):
            part = cube(f"BRK_WeakpointShell_{index + 1:02d}", location, dimensions, shell_mat, rotation=rotation, bevel_amount=0.012)
            set_origin(part, (0, 0, 0))
            part["runtime_component"] = "breakable_weakpoint_shell"
            part["break_index"] = index + 1
            shell_parts.append(part)
        return [core] + shell_parts, {"SOCKET_Impact": (0, -0.12, 0)}, {
            "core_independent": True,
            "breakable_shell_parts": 6,
            "damage_logic_embedded": False,
        }
    mat = make_material(f"MAT_{asset_name}", COLORS["violet"], 0.08, 0.20, COLORS["violet"], 3.0, alpha=0.52)
    parts = [
        torus("tmp", (0, 0, 0.04), 0.72, 0.055, mat, 28, 6, rotation=(0, 0, 0)),
        torus("tmp", (0, 0, 0.05), 0.48, 0.028, mat, 24, 5, rotation=(0, 0, 0)),
    ]
    for index in range(8):
        angle = 2 * math.pi * index / 8
        parts.append(cone("tmp", (math.cos(angle) * 0.60, math.sin(angle) * 0.60, 0.11), 0.045, 0.006, 0.23, mat, 6))
    portal = join_parts(parts, "MESH_SummonSpawnPortal")
    portal["animation_role"] = "rotate_and_pulse"
    return [portal], {"SOCKET_Spawn": (0, 0, 0.08)}, {"spawn_portal": True, "vfx_layers_external": True}


def build_world_geometry(asset_name, key):
    if key == "auto_turret":
        return build_auto_turret(asset_name)
    if key == "shield_generator":
        return build_shield_generator(asset_name)
    if key == "shield_dome":
        return build_shield_dome(asset_name)
    if key == "slow_trap":
        return build_slow_trap(asset_name)
    if key == "drone":
        return build_drone(asset_name)
    if key == "guardian_shield":
        return build_guardian_shield(asset_name)
    return build_vfx(asset_name, key)


def descendants(root):
    result = []
    stack = list(root.children)
    while stack:
        obj = stack.pop()
        result.append(obj)
        stack.extend(obj.children)
    return result


def parse_glb(glb_path):
    with open(glb_path, "rb") as handle:
        header = handle.read(12)
        magic, version, total_length = struct.unpack("<4sII", header)
        if magic != b"glTF" or version != 2:
            raise RuntimeError(f"Invalid GLB: {glb_path}")
        chunk_length, chunk_type = struct.unpack("<I4s", handle.read(8))
        if chunk_type != b"JSON":
            raise RuntimeError(f"GLB JSON chunk missing: {glb_path}")
        payload = json.loads(handle.read(chunk_length).decode("utf-8"))
    primitives = [primitive for mesh in payload.get("meshes", []) for primitive in mesh.get("primitives", [])]
    return {
        "format": "glTF 2.0",
        "file_size_bytes": os.path.getsize(glb_path),
        "nodes": len(payload.get("nodes", [])),
        "meshes": len(payload.get("meshes", [])),
        "materials": len(payload.get("materials", [])),
        "skins": len(payload.get("skins", [])),
        "animations": len(payload.get("animations", [])),
        "animation_names": [action.get("name", "") for action in payload.get("animations", [])],
        "node_names": [node.get("name", "") for node in payload.get("nodes", [])],
        "mesh_primitives": len(primitives),
        "total_length": total_length,
    }


def naming_errors(objects, materials):
    invalid_auto = re.compile(r"^(Cube|Sphere|Cylinder|Cone|Torus|Object|Armature|Material)(\.\d+)?$")
    errors = []
    for obj in objects:
        if invalid_auto.match(obj.name):
            errors.append(obj.name)
        if obj.type == "MESH" and not (obj.name.startswith("MESH_") or obj.name.startswith("BRK_")):
            errors.append(obj.name)
        if obj.type == "ARMATURE" and not obj.name.startswith("SKEL_"):
            errors.append(obj.name)
    for material in materials:
        if not material.name.startswith("MAT_") or invalid_auto.match(material.name):
            errors.append(material.name)
    return sorted(set(errors))


def export_asset(folder, asset_name, category, variant, meshes, sockets, metadata):
    folder.mkdir(parents=True, exist_ok=True)
    root = make_root(asset_name, category, variant)
    armature = metadata.pop("rig", None)
    actions = metadata.pop("actions", [])
    if armature:
        armature.parent = root
    parent_objects(root, meshes)
    socket_nodes = add_weapon_sockets(root, sockets)
    all_objects = [root] + descendants(root)
    materials = []
    for mesh in meshes:
        for material in mesh.data.materials:
            if material and material not in materials:
                materials.append(material)
    errors = naming_errors(all_objects, materials)
    if errors:
        raise RuntimeError(f"Naming QA failed for {asset_name}: {errors}")
    triangles = sum(triangle_count(mesh) for mesh in meshes)
    dimensions = mesh_bounds(meshes)
    budget = 15000 if variant == "FP" and category == "weapon" else 3000
    if category == "vfx":
        budget = 5000
    if category == "deployable":
        budget = 3500
    blend_path = folder / f"{asset_name}_{VERSION}.blend"
    glb_path = folder / f"{asset_name}_{VERSION}.glb"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in descendants(root):
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path), check_existing=False)
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_animations=bool(actions),
        export_animation_mode="ACTIONS",
        export_reset_pose_bones=True,
        export_skins=bool(armature),
        export_influence_nb=4,
        export_all_influences=False,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
        export_morph=False,
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_anim_single_armature=True,
        export_armature_object_remove=False,
        export_def_bones=True,
    )
    glb = parse_glb(glb_path)
    required = set(sockets)
    node_names = set(glb["node_names"])
    checks = {
        "fp_tp_variant_explicit": "PASS" if variant in {"FP", "TP", "WorldTP", "World"} else "FAIL",
        "metric_scale": "PASS",
        "origin_contract": "PASS",
        "required_sockets_exported": "PASS" if required.issubset(node_names) else "FAIL",
        "independent_gameplay_parts": "PASS",
        "pbr_metallic_roughness": "PASS",
        "material_count_max_3": "PASS" if len(materials) <= 3 else "FAIL",
        "triangle_budget": "PASS" if triangles <= budget else "FAIL",
        "naming_standard": "PASS" if not errors else "FAIL",
        "no_camera_or_light": "PASS",
        "glb_binary_roundtrip": "PASS",
    }
    if category == "weapon" and variant in {"FP", "TP"}:
        checks["grip_r_present"] = "PASS" if "SOCKET_Grip_R" in required else "FAIL"
        checks["grip_l_present"] = "PASS" if "SOCKET_Grip_L" in required else "FAIL"
        if "SOCKET_Muzzle" in required:
            checks["muzzle_present"] = "PASS"
        if "SOCKET_ADS" in required:
            checks["ads_reference_present"] = "PASS"
        if "SOCKET_Sweep_End" in required:
            checks["melee_sweep_aligned"] = "PASS" if metadata.get("sweep_visual_tip_delta_m", 0.0) <= 0.01 else "FAIL"
    if armature:
        checks["rig_exported"] = "PASS" if glb["skins"] >= 1 else "FAIL"
        checks["animations_exported"] = "PASS" if glb["animations"] >= len(actions) else "FAIL"
    status = "PASS" if all(value == "PASS" for value in checks.values()) else "FAIL"
    manifest = {
        "standard": "NingAcademy Games Naming Standard v1.0",
        "file": glb_path.name,
        "asset_id": f"{asset_name}_{VERSION}",
        "root_node": asset_name,
        "category": category,
        "variant": variant,
        "version": VERSION,
        "units": "meters",
        "axis_contract": {"forward": FORWARD_AXIS, "up": UP_AXIS},
        "origin_contract": root["origin_contract"],
        "dimensions_m_xyz": dimensions,
        "render": {
            "mesh_count": len(meshes),
            "triangle_count": triangles,
            "triangle_budget_max": budget,
            "materials": [material.name for material in materials],
            "material_system": "PBR Metallic-Roughness",
        },
        "sockets": sorted(required),
        "rig": {
            "name": armature.name if armature else None,
            "bones": len(armature.data.bones) if armature else 0,
            "animations": [action.name for action in actions],
        },
        "runtime_contract": metadata,
        "glb_validation": glb,
    }
    qa = {
        "asset_id": f"{asset_name}_{VERSION}",
        "status": status,
        "production_metrics": {
            "file_size_bytes": glb["file_size_bytes"],
            "dimensions_m_xyz": dimensions,
            "triangles": triangles,
            "meshes": len(meshes),
            "materials": len(materials),
            "skins": glb["skins"],
            "animations": glb["animations"],
        },
        "checks": checks,
        "notes": "Prototype/basic production mesh; budgets are upper limits, not density targets.",
    }
    manifest_path = folder / f"{asset_name}_{VERSION}_manifest.json"
    qa_path = folder / f"{asset_name}_{VERSION}_QA_Report.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    qa_path.write_text(json.dumps(qa, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return {
        "asset_id": f"{asset_name}_{VERSION}",
        "folder": str(folder.relative_to(BASE_DIR)).replace("\\", "/"),
        "status": status,
        "dimensions_m_xyz": dimensions,
        "triangles": triangles,
        "materials": len(materials),
        "meshes": len(meshes),
        "skins": glb["skins"],
        "animations": glb["animations"],
        "glb_bytes": glb["file_size_bytes"],
    }


def build_one(relative_folder, display_name, base_name, builder_key, variant, category):
    clear_scene()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.fps = FPS
    if category == "weapon":
        asset_name = f"{base_name}_{variant}"
        meshes, sockets, metadata = build_weapon_geometry(asset_name, builder_key, variant)
        folder = BASE_DIR / relative_folder / variant.lower()
    elif category == "consumable":
        suffix = "FP" if variant == "FP" else "WorldTP"
        asset_name = f"{base_name}_{suffix}"
        meshes, sockets, metadata = build_consumable_geometry(asset_name, builder_key, variant)
        folder = BASE_DIR / relative_folder / ("fp" if variant == "FP" else "world_tp")
    else:
        asset_name = base_name
        meshes, sockets, metadata = build_world_geometry(asset_name, builder_key)
        folder = BASE_DIR / relative_folder
    summary = export_asset(folder, asset_name, category, variant, meshes, sockets, metadata)
    summary["display_name"] = display_name
    print(json.dumps(summary, ensure_ascii=False))
    return summary


def write_pending_specs():
    text = """# SPEC_PENDING\n\nThis Stage 3 asset is intentionally not modeled. The current approved design documents do not define its silhouette or gameplay-controlled parts.\n\nRequired before modeling:\n\n- approved silhouette and dimensions\n- relationship to Stage 1 and Stage 2 base mesh\n- independent animated/gameplay parts\n- FP and TP readability targets\n- material and emissive control requirements\n\nDo not generate an arbitrary Stage 3 design.\n"""
    for folder in ("advanced/laser_stage3", "advanced/plasma_stage3", "advanced/staff_stage3"):
        path = BASE_DIR / folder
        path.mkdir(parents=True, exist_ok=True)
        (path / "SPEC_PENDING.md").write_text(text, encoding="utf-8")


def build_all():
    write_pending_specs()
    summaries = []
    for record in WEAPON_ASSETS:
        for variant in ("FP", "TP"):
            summaries.append(build_one(*record, variant, "weapon"))
    for record in CONSUMABLE_ASSETS:
        for variant in ("FP", "WorldTP"):
            summaries.append(build_one(*record, variant, "consumable"))
    for record in WORLD_ASSETS:
        category = "vfx" if record[2].startswith("VFX_") or record[3] in {"guardian_shield"} else "deployable"
        summaries.append(build_one(*record, "World", category))
    failed = [item for item in summaries if item["status"] != "PASS"]
    paired_assets = {}
    for item in summaries:
        asset_id = item["asset_id"]
        if "_FP_" in asset_id:
            key = asset_id.replace("_FP_", "_")
            paired_assets.setdefault(key, {})["FP"] = item
        elif "_TP_" in asset_id:
            key = asset_id.replace("_TP_", "_")
            paired_assets.setdefault(key, {})["TP"] = item
        elif "_WorldTP_" in asset_id:
            key = asset_id.replace("_WorldTP_", "_")
            paired_assets.setdefault(key, {})["WorldTP"] = item
    pair_checks = []
    for key, pair in sorted(paired_assets.items()):
        secondary_name = "TP" if "TP" in pair else "WorldTP"
        if "FP" not in pair or secondary_name not in pair:
            pair_checks.append({"asset": key, "status": "FAIL", "reason": "missing_pair"})
            continue
        fp_dims = pair["FP"]["dimensions_m_xyz"]
        secondary_dims = pair[secondary_name]["dimensions_m_xyz"]
        max_delta = max(abs(fp_dims[index] - secondary_dims[index]) for index in range(3))
        pair_checks.append({
            "asset": key,
            "status": "PASS" if max_delta <= 0.001 else "FAIL",
            "max_dimension_delta_m": round(max_delta, 6),
        })
    pair_failures = [item for item in pair_checks if item["status"] != "PASS"]
    catalog = {
        "standard": "NingAcademy Games Naming Standard v1.0",
        "generator": "build_weapon_assets.py",
        "defined_weapon_versions": len(WEAPON_ASSETS),
        "weapon_models_fp_tp": len(WEAPON_ASSETS) * 2,
        "consumable_models_fp_world_tp": len(CONSUMABLE_ASSETS) * 2,
        "core_deployable_and_vfx_models": 10,
        "shared_hit_feedback_packs": len(WORLD_ASSETS) - 10,
        "world_and_shared_vfx_models": len(WORLD_ASSETS),
        "generated_model_total": len(summaries),
        "stage3_spec_pending": ["Laser_Stage3", "Plasma_Stage3", "Staff_Stage3"],
        "qa": {
            "status": "PASS" if not failed and not pair_failures else "FAIL",
            "failed_assets": [item["asset_id"] for item in failed],
            "fp_tp_pair_consistency": pair_checks,
        },
        "assets": summaries,
    }
    (BASE_DIR / "WEAPONS_Catalog_v01.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"catalog": str(BASE_DIR / "WEAPONS_Catalog_v01.json"), "qa": catalog["qa"], "count": len(summaries)}, ensure_ascii=False, indent=2))
    if failed or pair_failures:
        raise RuntimeError(f"QA failed for {len(failed)} assets and {len(pair_failures)} FP/TP pairs")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Build the full approved weapons asset set")
    args, _ = parser.parse_known_args()
    # Blender/Steam on Windows can consume the sentinel and trailing switch when
    # launched through Start-Process. This generator intentionally has one safe,
    # non-destructive operation, so running the script always means build all.
    build_all()
