"""Render quick visual QA contact sheets from the generated GLB files."""

import math
from pathlib import Path

import bpy
from mathutils import Vector


BASE_DIR = Path(__file__).resolve().parent
PREVIEW_DIR = BASE_DIR / "previews"

STARTER = [
    ("Sniper FP", "starter/sniper/fp/WPN_Rifle_Sniper_A_FP_v01.glb"),
    ("Assault FP", "starter/assault_rifle/fp/WPN_Rifle_Assault_A_FP_v01.glb"),
    ("SMG FP", "starter/smg/fp/WPN_SMG_A_FP_v01.glb"),
    ("Spear FP", "starter/spear/fp/WPN_Spear_A_FP_v01.glb"),
    ("Sword FP", "starter/sword/fp/WPN_Sword_A_FP_v01.glb"),
]

ADVANCED = [
    ("Saber Proto", "advanced/lightsaber_prototype/fp/WPN_Lightsaber_Prototype_FP_v01.glb"),
    ("Lightsaber", "advanced/lightsaber/fp/WPN_Lightsaber_A_FP_v01.glb"),
    ("Saber Complete", "advanced/lightsaber_complete/fp/WPN_Lightsaber_Complete_FP_v01.glb"),
    ("Laser Gun", "advanced/laser_gun/fp/WPN_LaserRifle_A_FP_v01.glb"),
    ("Fusion Laser", "advanced/fusion_laser/fp/WPN_LaserRifle_Fusion_FP_v01.glb"),
    ("Plasma Cannon", "advanced/plasma_cannon/fp/WPN_PlasmaCannon_A_FP_v01.glb"),
    ("Singularity Plasma", "advanced/singularity_plasma/fp/WPN_PlasmaCannon_Singularity_FP_v01.glb"),
    ("Elemental Staff", "advanced/elemental_staff/fp/WPN_Staff_Elemental_FP_v01.glb"),
    ("Singularity Staff", "advanced/singularity_staff/fp/WPN_Staff_Singularity_FP_v01.glb"),
]

WORLD = [
    ("Grenade", "consumables/grenade/world_tp/PROP_Grenade_WorldTP_v01.glb"),
    ("Bandage", "consumables/bandage/world_tp/PROP_Bandage_WorldTP_v01.glb"),
    ("Medkit", "consumables/medkit/world_tp/PROP_Medkit_WorldTP_v01.glb"),
    ("Ammo Box", "consumables/ammo_box/world_tp/PROP_AmmoBox_WorldTP_v01.glb"),
    ("Auto Turret", "deployables/auto_turret/PROP_AutoTurret_v01.glb"),
    ("Shield Generator", "deployables/shield_generator/PROP_ShieldGenerator_v01.glb"),
    ("Shield Dome", "deployables/shield_dome/VFX_ShieldDome_v01.glb"),
    ("Slow Trap", "deployables/slow_trap/PROP_SlowTrap_v01.glb"),
    ("Drone", "deployables/drone/PROP_Drone_v01.glb"),
    ("Guardian Shield", "deployables/guardian_crystal_shield/PROP_GuardianCrystalShield_v01.glb"),
    ("Singularity Field", "ability_vfx_mesh/singularity_field/VFX_SingularityField_v01.glb"),
    ("Area Ring", "ability_vfx_mesh/area_ring/VFX_AreaRing_v01.glb"),
    ("Plague Patch", "ability_vfx_mesh/plague_ground_patch/VFX_PlagueGroundPatch_v01.glb"),
    ("Spawn Portal", "ability_vfx_mesh/summon_spawn_portal/VFX_SummonSpawnPortal_v01.glb"),
    ("House Shards", "ability_vfx_mesh/crystal_shards/house/VFX_CrystalShards_House_v01.glb"),
    ("Desert Shards", "ability_vfx_mesh/crystal_shards/desert/VFX_CrystalShards_Desert_v01.glb"),
    ("Grass Shards", "ability_vfx_mesh/crystal_shards/grass/VFX_CrystalShards_Grass_v01.glb"),
    ("Hell Shards", "ability_vfx_mesh/crystal_shards/hell/VFX_CrystalShards_Hell_v01.glb"),
    ("Weakpoint Core", "ability_vfx_mesh/weakpoint_core/VFX_WeakpointCore_v01.glb"),
]


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights, bpy.data.curves):
        for block in list(datablocks):
            try:
                datablocks.remove(block)
            except Exception:
                pass


def bounds(objects):
    points = []
    for obj in objects:
        if obj.type == "MESH":
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    mins = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maxs = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return mins, maxs


def import_group(path, label, target, rotate_weapon, cell_width, cell_height):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    master = bpy.data.objects.new(f"PREVIEW_{label.replace(' ', '_')}", None)
    bpy.context.collection.objects.link(master)
    for obj in imported:
        if obj.parent is None:
            obj.parent = master
    if rotate_weapon:
        master.rotation_euler.x = math.pi / 2
    bpy.context.view_layer.update()
    mins, maxs = bounds(imported)
    extent = max(maxs.x - mins.x, maxs.z - mins.z, 0.001)
    fit_scale = min(1.0, min(cell_width * 0.78, cell_height * 0.70) / extent)
    master.scale = (fit_scale, fit_scale, fit_scale)
    bpy.context.view_layer.update()
    mins, maxs = bounds(imported)
    center = (mins + maxs) * 0.5
    master.location += Vector((target[0] - center.x, -center.y, target[1] - center.z + 0.12))

    bpy.ops.object.text_add(location=(target[0], -0.55, target[1] - cell_height * 0.40), rotation=(math.pi / 2, 0, 0))
    text = bpy.context.object
    text.name = f"LABEL_{label.replace(' ', '_')}"
    text.data.body = label
    text.data.align_x = "CENTER"
    text.data.align_y = "CENTER"
    text.data.size = 0.18
    text.data.extrude = 0.004


def look_at(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def render_sheet(name, records, columns, rotate_weapon):
    clear_scene()
    rows = math.ceil(len(records) / columns)
    cell_width = 3.0
    cell_height = 2.65
    width = columns * cell_width
    height = rows * cell_height
    for index, (label, relative_path) in enumerate(records):
        column = index % columns
        row = index // columns
        x = (column + 0.5) * cell_width
        z = height - (row + 0.5) * cell_height
        import_group(BASE_DIR / relative_path, label, (x, z), rotate_weapon, cell_width, cell_height)

    bpy.ops.object.camera_add(location=(width * 0.5, -24.0, height * 0.5))
    camera = bpy.context.object
    camera.name = "PREVIEW_Camera"
    camera.data.type = "ORTHO"
    # Blender's orthographic scale is the horizontal span for this camera fit.
    # Include enough width for all columns; the 16:10 render then also fits rows.
    camera.data.ortho_scale = max(width * 1.05, height * 1.6 * 1.05)
    look_at(camera, (width * 0.5, 0, height * 0.5))
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(width * 0.25, -6, height + 5))
    key = bpy.context.object
    key.name = "PREVIEW_Key"
    key.data.energy = 1600
    key.data.shape = "DISK"
    key.data.size = 8
    look_at(key, (width * 0.5, 0, height * 0.5))
    bpy.ops.object.light_add(type="AREA", location=(width * 0.85, 3, height * 0.65))
    fill = bpy.context.object
    fill.name = "PREVIEW_Fill"
    fill.data.energy = 1100
    fill.data.size = 7
    look_at(fill, (width * 0.5, 0, height * 0.5))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.018, 0.022, 0.030)
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.filepath = str(PREVIEW_DIR / f"{name}.png")
    bpy.ops.render.render(write_still=True)


def main():
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)
    render_sheet("starter_fp_contact_sheet", STARTER, 5, True)
    render_sheet("advanced_fp_contact_sheet", ADVANCED, 5, True)
    render_sheet("world_assets_contact_sheet", WORLD, 5, False)


if __name__ == "__main__":
    main()
