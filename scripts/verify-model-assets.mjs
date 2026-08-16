import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const modelsRoot = path.join(repositoryRoot, "apps", "web", "public", "game", "models");
const registryPath = path.join(
  repositoryRoot,
  "apps",
  "web",
  "src",
  "game-assets",
  "model-asset-registry.ts",
);

const JSON_CHUNK = 0x4e4f534a;
const expectedBosses = new Map([
  ["boss/hunter/CHR_BOSS_Hunter_v01.glb", "boss/hunter/CHR_BOSS_Hunter_v01_manifest.json"],
  ["boss/ironshell/CHR_BOSS_IronShell_v01.glb", "boss/ironshell/CHR_BOSS_IronShell_v01_manifest.json"],
  ["boss/plague/CHR_BOSS_Plague_v01.glb", "boss/plague/CHR_BOSS_Plague_v01_manifest.json"],
  ["boss/swarm/CHR_BOSS_Swarm_v01.glb", "boss/swarm/CHR_BOSS_Swarm_v01_manifest.json"],
]);
const expectedSurvivors = new Set([
  "survivors/CHR_SURV_Assassin_v01.glb",
  "survivors/CHR_SURV_Guardian_v01.glb",
  "survivors/CHR_SURV_Mage_v01.glb",
  "survivors/CHR_SURV_Medic_v01.glb",
  "survivors/CHR_SURV_Warrior_v01.glb",
]);
const sourceOnlyModels = new Set([
  "CHR_BOSS_IronShell_v01.glb",
  "boss/Hunter.glb",
  "boss/Plague.glb",
  "boss/Swarm.glb",
  "survivors/NingAcademy_Survivor_Canonical_V4_StateReady.glb",
]);

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function parseGlb(buffer, relativePath) {
  if (buffer.length < 20 || buffer.toString("ascii", 0, 4) !== "glTF") {
    throw new Error(`${relativePath}: invalid GLB magic/header`);
  }
  if (buffer.readUInt32LE(4) !== 2) {
    throw new Error(`${relativePath}: only glTF 2.0 is supported`);
  }
  if (buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error(`${relativePath}: declared GLB length does not match file size`);
  }

  let offset = 12;
  let json = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (end > buffer.length) throw new Error(`${relativePath}: truncated GLB chunk`);
    if (type === JSON_CHUNK) {
      const text = buffer.toString("utf8", start, end).replace(/[\u0000\u0020]+$/u, "");
      json = JSON.parse(text);
      break;
    }
    offset = end;
  }
  if (json === null || typeof json !== "object") {
    throw new Error(`${relativePath}: missing JSON chunk`);
  }
  return json;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function names(items) {
  return array(items).map((item) => item && typeof item.name === "string" ? item.name : "");
}

function assertUniqueNamed(items, kind, relativePath, errors) {
  const itemNames = names(items);
  const missing = itemNames.filter((name) => name.length === 0).length;
  if (missing > 0) errors.push(`${relativePath}: ${missing} unnamed ${kind}`);
  const duplicates = [...new Set(itemNames.filter((name, index) => name && itemNames.indexOf(name) !== index))];
  if (duplicates.length > 0) {
    errors.push(`${relativePath}: duplicate ${kind} names: ${duplicates.join(", ")}`);
  }
}

function validateExternalUris(gltf, absolutePath, relativePath, errors) {
  const uriItems = [...array(gltf.images), ...array(gltf.buffers)];
  for (const item of uriItems) {
    if (!item || typeof item.uri !== "string" || item.uri.startsWith("data:")) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(item.uri);
    } catch {
      errors.push(`${relativePath}: malformed external URI ${item.uri}`);
      continue;
    }
    const target = path.resolve(path.dirname(absolutePath), decoded);
    if (!target.startsWith(`${modelsRoot}${path.sep}`) || !existsSync(target)) {
      errors.push(`${relativePath}: missing or escaping external resource ${item.uri}`);
    }
  }
}

function isRuntimeModel(relativePath) {
  return relativePath.startsWith("weapons/")
    || relativePath.startsWith("zombie/")
    || expectedBosses.has(relativePath)
    || expectedSurvivors.has(relativePath);
}

async function validateManifest(relativeGlb, gltf, errors, warnings) {
  const base = relativeGlb.slice(0, -4);
  const manifestRelative = expectedBosses.get(relativeGlb)
    ?? (relativeGlb.startsWith("weapons/") ? `${base}_manifest.json` : null)
    ?? (relativeGlb === "zombie/CHR_ENEMY_ThrallBase_v01.glb"
      ? "zombie/CHR_ENEMY_ThrallBase_v01_manifest.json"
      : null);
  if (manifestRelative === null) return;
  const manifestPath = path.join(modelsRoot, ...manifestRelative.split("/"));
  if (!existsSync(manifestPath)) {
    errors.push(`${relativeGlb}: companion manifest is missing`);
    return;
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const expectedFile = path.posix.basename(relativeGlb);
  const declaredFile = manifest.file ?? manifest.asset ?? manifest.glb;
  if (declaredFile !== expectedFile) {
    errors.push(`${manifestRelative}: declares ${String(declaredFile)} instead of ${expectedFile}`);
  }

  const animationNames = new Set(names(gltf.animations));
  const requiredAnimations = array(manifest.animation_interface_required);
  for (const animation of requiredAnimations) {
    if (typeof animation === "string" && !animationNames.has(animation)) {
      errors.push(`${relativeGlb}: required animation ${animation} is absent`);
    }
  }

  if (expectedBosses.has(relativeGlb)) {
    if (manifest.biome_bound !== false) {
      errors.push(`${manifestRelative}: Boss must explicitly set biome_bound=false`);
    }
    if (!Array.isArray(manifest.controllers)
      || !manifest.controllers.includes("AIController")
      || !manifest.controllers.includes("PlayerController")) {
      errors.push(`${manifestRelative}: Boss must support AIController and PlayerController`);
    }
    if (array(manifest.breakables).length < 3) {
      warnings.push(`${manifestRelative}: fewer than three declared breakable parts`);
    }
  }
}

async function main() {
  const allFiles = await walk(modelsRoot);
  const glbFiles = allFiles.filter((file) => file.toLowerCase().endsWith(".glb"));
  const relativeGlbs = glbFiles.map((file) => toPosix(path.relative(modelsRoot, file))).sort();
  const errors = [];
  const warnings = [];
  let runtimeBytes = 0;

  if (relativeGlbs.length !== 70) {
    errors.push(`expected 70 delivered GLBs, found ${relativeGlbs.length}`);
  }
  const runtimeModels = relativeGlbs.filter(isRuntimeModel);
  if (runtimeModels.length !== 65) {
    errors.push(`expected 65 approved runtime GLBs, found ${runtimeModels.length}`);
  }
  for (const sourceOnly of sourceOnlyModels) {
    if (!relativeGlbs.includes(sourceOnly)) errors.push(`source/reference GLB missing: ${sourceOnly}`);
  }

  for (let index = 0; index < glbFiles.length; index += 1) {
    const absolute = glbFiles[index];
    const relative = toPosix(path.relative(modelsRoot, absolute));
    try {
      const buffer = await readFile(absolute);
      const gltf = parseGlb(buffer, relative);
      assertUniqueNamed(gltf.nodes, "nodes", relative, errors);
      assertUniqueNamed(gltf.animations, "animations", relative, errors);
      assertUniqueNamed(gltf.materials, "materials", relative, errors);
      validateExternalUris(gltf, absolute, relative, errors);
      if (isRuntimeModel(relative)) runtimeBytes += buffer.length;
      await validateManifest(relative, gltf, errors, warnings);

      const generatedNames = names(gltf.nodes).filter((name) =>
        /^(?:Cube|Sphere|Icosphere|Object|Armature)(?:\.\d+)?$/u.test(name),
      );
      if (isRuntimeModel(relative) && generatedNames.length > 0) {
        warnings.push(`${relative}: review generated node names ${generatedNames.join(", ")}`);
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `${relative}: unknown parser failure`);
    }
  }

  const catalogPath = path.join(modelsRoot, "weapons", "WEAPONS_Catalog_v01.json");
  const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
  if (catalog.generated_model_total !== 51 || !Array.isArray(catalog.assets) || catalog.assets.length !== 51) {
    errors.push("WEAPONS_Catalog_v01.json must contain 51 approved GLBs");
  } else {
    for (const asset of catalog.assets) {
      const relative = `weapons/${asset.folder}/${asset.asset_id}.glb`;
      if (!relativeGlbs.includes(relative)) errors.push(`catalog asset missing: ${relative}`);
      if (asset.status !== "PASS") errors.push(`catalog asset is not approved: ${asset.asset_id}`);
    }
  }

  const registry = await readFile(registryPath, "utf8");
  for (const legacy of ["/boss/Hunter.glb", "/boss/Plague.glb", "/boss/Swarm.glb", " (1).glb"]) {
    if (registry.includes(legacy)) errors.push(`runtime registry references legacy model path: ${legacy}`);
  }

  for (const warning of warnings) process.stdout.write(`MODEL WARNING: ${warning}\n`);
  process.stdout.write(`Model assets: ${relativeGlbs.length} GLB delivered; ${runtimeModels.length} approved for runtime.\n`);
  process.stdout.write(`Approved runtime GLB bytes: ${(runtimeBytes / 1024 / 1024).toFixed(2)} MiB (loaded on demand, never all at once).\n`);
  process.stdout.write(`Source/reference GLBs excluded by the runtime registry: ${sourceOnlyModels.size}.\n`);

  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`MODEL ERROR: ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Model manifest, GLB structure, texture URI, Boss independence and catalog checks passed.\n");
}

await main();
