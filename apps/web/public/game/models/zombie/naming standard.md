# NingAcademy Games Naming Standard v1.0

## 1. 总规则

统一使用：

```text
English only
PascalCase + 固定大写前缀
下划线 _ 作为层级分隔
```

禁止：

```text
空格
中文
-
.
特殊符号
自动生成名称
```

正确示例：

```text
CHR_SURV_Warrior
MESH_Body
MAT_Warrior_Armor
ANIM_Idle
SOCKET_Hand_R
```

错误示例：

```text
warrior final
Warrior-01
战士
Cube.001
Material.003
mixamorig:RightHand
Take 001
```

左右方向统一：

```text
_L
_R
```

版本统一：

```text
_v01
_v02
_v03
```

禁止使用：

```text
final
final2
new
latest
fixed
final_final
```

---

## 2. 资产类型前缀

| 类型 | 前缀 |
|---|---|
| Character | `CHR_` |
| Mesh | `MESH_` |
| Skeleton | `SKEL_` |
| Bone | 不加前缀 |
| Socket | `SOCKET_` |
| Animation | `ANIM_` |
| Material | `MAT_` |
| Texture | `T_` |
| Weapon | `WPN_` |
| Attachment | `ATT_` |
| Prop | `PROP_` |
| Projectile | `PROJ_` |
| VFX | `VFX_` |
| Collision | `COL_` |
| Hitbox | `HIT_` |
| Hurtbox | `HURT_` |
| Environment | `ENV_` |
| UI Icon | `ICO_` |

---

## 3. Character GLB 文件名

格式：

```text
CHR_[Faction]_[CharacterName]_v##
```

### Survivor

```text
CHR_SURV_Base_v01.glb
CHR_SURV_Warrior_v01.glb
CHR_SURV_Guardian_v01.glb
CHR_SURV_Medic_v01.glb
CHR_SURV_Mage_v01.glb
CHR_SURV_Assassin_v01.glb
```

以后新增：

```text
CHR_SURV_Ranger_v01.glb
CHR_SURV_Engineer_v01.glb
```

### Enemy

```text
CHR_ENEMY_ZombieBase_v01.glb
CHR_ENEMY_ZombieRunner_v01.glb
CHR_ENEMY_ZombieTank_v01.glb
CHR_ENEMY_ZombieSpitter_v01.glb
CHR_ENEMY_ZombieElite_v01.glb
CHR_ENEMY_PlayerZombie_v01.glb
```

Boss：

```text
CHR_ENEMY_Boss_Brute_v01.glb
CHR_ENEMY_Boss_Overlord_v01.glb
CHR_ENEMY_Boss_HellTitan_v01.glb
```

---

## 4. 生态命名规则

生态差异不要写死进基础 Zombie 名字。

正确：

```text
CHR_ENEMY_ZombieBase_v01
```

不要：

```text
CHR_ENEMY_DesertZombie
CHR_ENEMY_HellZombie
```

生态差异通过：

```text
Base Character
+
Attachment
+
Material
```

例如：

```text
CHR_ENEMY_ZombieBase
+
ATT_Hell_Chest_A
+
ATT_Hell_Back_B
+
MAT_ENEMY_Hell_Body
+
MAT_ENEMY_Hell_Crystal
```

---

## 5. Mesh Naming

格式：

```text
MESH_[Part]
```

基础身体：

```text
MESH_Body
MESH_Head
MESH_Hair
MESH_Beard
MESH_Eyes
```

装备：

```text
MESH_Armor
MESH_ChestArmor
MESH_ShoulderArmor_L
MESH_ShoulderArmor_R
MESH_Bracer_L
MESH_Bracer_R
MESH_Glove_L
MESH_Glove_R
MESH_Boot_L
MESH_Boot_R
MESH_Belt
MESH_Helmet
MESH_Hood
MESH_Robe
MESH_Backpack
```

禁止：

```text
Cube
Cube.001
Object
Object001
mesh_0
mesh_1
```

---

## 6. Skeleton Naming

幸存者统一：

```text
SKEL_Survivor
```

所有幸存者职业必须共用：

```text
SKEL_Survivor
```

禁止：

```text
SKEL_Warrior
SKEL_Guardian
SKEL_Medic
SKEL_Mage
SKEL_Assassin
```

敌人统一：

```text
SKEL_Enemy
```

只有骨骼拓扑真正不同的非人形单位，才建立新的 Skeleton：

```text
SKEL_EnemyQuadruped
SKEL_Boss_HellTitan
```

---

## 7. Survivor Canonical Bone Naming

固定骨骼：

```text
Root
└── Hips
    ├── Spine
    │   └── Chest
    │       ├── Neck
    │       │   └── Head
    │       ├── Shoulder_L
    │       │   └── UpperArm_L
    │       │       └── LowerArm_L
    │       │           └── Hand_L
    │       └── Shoulder_R
    │           └── UpperArm_R
    │               └── LowerArm_R
    │                   └── Hand_R
    ├── UpperLeg_L
    │   └── LowerLeg_L
    │       └── Foot_L
    └── UpperLeg_R
        └── LowerLeg_R
            └── Foot_R
```

固定名称：

```text
Root
Hips
Spine
Chest
Neck
Head
Shoulder_L
UpperArm_L
LowerArm_L
Hand_L
Shoulder_R
UpperArm_R
LowerArm_R
Hand_R
UpperLeg_L
LowerLeg_L
Foot_L
UpperLeg_R
LowerLeg_R
Foot_R
```

如以后确实需要，可以全局增加：

```text
Toe_L
Toe_R
```

但不能只给某一个职业增加。

禁止：

```text
mixamorig:Hips
mixamorig:RightHand
Armature|Hips
hand.R
hand_L
RightHand
LeftHand
Bone001
Bone002
joint1
```

---

## 8. Socket Naming

Survivor 固定核心 Socket：

```text
SOCKET_Hand_L
SOCKET_Hand_R
SOCKET_Back
SOCKET_Hip_L
SOCKET_Hip_R
SOCKET_Head
SOCKET_Chest
```

用途：

```text
SOCKET_Hand_R
主武器、剑、枪、斧、法杖、任务物品

SOCKET_Hand_L
副武器、盾牌、双刀、医疗设备

SOCKET_Back
背包、盾牌、步枪、法杖、装饰

SOCKET_Hip_L
SOCKET_Hip_R
匕首、手枪、药水、手雷、小型医疗包

SOCKET_Head
头盔、帽子、头部晶体、HUD/3D 图标

SOCKET_Chest
胸部晶体、医疗设备、魔法核心、特效
```

禁止按具体武器命名：

```text
SOCKET_Axe
SOCKET_Sword
SOCKET_Rifle
SOCKET_Dagger
```

---

## 9. Enemy Attachment Socket

Enemy 推荐：

```text
SOCKET_Head
SOCKET_Chest
SOCKET_Back
SOCKET_Shoulder_L
SOCKET_Shoulder_R
SOCKET_Leg_L
SOCKET_Leg_R
```

用于：

- 头部结晶
- 胸腔核心
- 肩部晶簇
- 背部晶簇
- 小腿结晶

---

## 10. Animation Naming

基础动画：

```text
ANIM_Idle
ANIM_Walk
ANIM_Run
ANIM_Attack
ANIM_Hit
ANIM_Death
```

推荐完整基础集：

```text
ANIM_Idle
ANIM_Walk
ANIM_Run
ANIM_Jump
ANIM_Fall
ANIM_Land
ANIM_Attack
ANIM_Hit
ANIM_Death
ANIM_Interact
```

多攻击：

```text
ANIM_Attack_Primary
ANIM_Attack_Secondary
ANIM_Attack_Melee_01
ANIM_Attack_Melee_02
ANIM_Attack_Melee_03
ANIM_Fire_Rifle
ANIM_Fire_Pistol
```

职业特殊：

```text
ANIM_Attack_Heavy
ANIM_Block
ANIM_ShieldRaise
ANIM_Heal
ANIM_Revive
ANIM_Cast
ANIM_Dodge
ANIM_Backstab
```

禁止：

```text
Idle.001
Action
Action.001
Take 001
Take 002
ArmatureAction
mixamo.com
animation_0
walkCycleNew
FINAL_RUN
```

---

## 11. Weapon Naming

格式：

```text
WPN_[Type]_[Name]_v##
```

示例：

```text
WPN_Sword_Iron_v01.glb
WPN_Sword_Knight_v01.glb
WPN_Axe_Iron_v01.glb
WPN_Axe_War_v01.glb
WPN_Rifle_Assault_A_v01.glb
WPN_Rifle_Sniper_A_v01.glb
WPN_SMG_A_v01.glb
WPN_Pistol_A_v01.glb
WPN_Shotgun_A_v01.glb
WPN_Lightsaber_A_v01.glb
WPN_LaserRifle_A_v01.glb
WPN_Staff_Fire_A_v01.glb
WPN_Staff_Ice_A_v01.glb
```

角色 GLB 本身禁止携带武器 Mesh。

---

## 12. Weapon 内部节点

例如：

```text
WPN_Rifle_Assault_A
│
├── MESH_Weapon
├── SOCKET_Muzzle
├── SOCKET_Scope
└── SOCKET_Underbarrel
```

可选：

```text
MESH_Magazine
MESH_Scope
SOCKET_Magazine
SOCKET_Underbarrel
```

---

## 13. Projectile Naming

格式：

```text
PROJ_[Type]
```

示例：

```text
PROJ_Bullet_Rifle
PROJ_Bullet_Pistol
PROJ_Rocket
PROJ_Grenade
PROJ_Fireball
PROJ_IceBolt
PROJ_MagicOrb
```

---

## 14. Attachment Naming

格式：

```text
ATT_[Theme]_[Location]_[Variant]
```

Hell：

```text
ATT_Hell_Head_A
ATT_Hell_Head_B
ATT_Hell_Chest_A
ATT_Hell_Chest_B
ATT_Hell_Back_A
ATT_Hell_Back_B
ATT_Hell_Shoulder_A
ATT_Hell_Shoulder_B
ATT_Hell_Leg_A
ATT_Hell_Leg_B
```

Desert：

```text
ATT_Desert_Head_A
ATT_Desert_Chest_A
ATT_Desert_Back_A
ATT_Desert_Shoulder_A
ATT_Desert_Leg_A
```

左右独立：

```text
ATT_Hell_Shoulder_L_A
ATT_Hell_Shoulder_R_A
ATT_Hell_Leg_L_A
ATT_Hell_Leg_R_A
```

固定顺序：

```text
Theme
↓
Location
↓
Side
↓
Variant
```

---

## 15. Material Naming

格式：

```text
MAT_[Owner]_[Purpose]
```

Survivor：

```text
MAT_SURV_Body
MAT_SURV_Hair
```

职业：

```text
MAT_Warrior_Armor
MAT_Guardian_Armor
MAT_Medic_Armor
MAT_Mage_Robe
MAT_Assassin_Armor
```

Enemy：

```text
MAT_ENEMY_Body
MAT_ENEMY_Crystal
```

生态：

```text
MAT_ENEMY_Desert_Body
MAT_ENEMY_Desert_Crystal
MAT_ENEMY_Hell_Body
MAT_ENEMY_Hell_Crystal
```

发光：

```text
MAT_Mage_Emissive
MAT_Medic_Emissive
MAT_ENEMY_Hell_Emissive
```

---

## 16. Texture Naming

格式：

```text
T_[Asset]_[MapType]
```

允许 Map Type：

```text
BaseColor
Normal
MetallicRoughness
Emissive
Occlusion
```

示例：

```text
T_Warrior_BaseColor.png
T_Warrior_Normal.png
T_Warrior_MetallicRoughness.png
T_Mage_BaseColor.png
T_Mage_Normal.png
T_Mage_MetallicRoughness.png
T_Mage_Emissive.png
T_ZombieBase_BaseColor.png
T_ZombieBase_Normal.png
T_ZombieBase_MetallicRoughness.png
```

不推荐缩写：

```text
_D
_N
_R
_M
_AO
_COL
```

---

## 17. Collision Naming

物理碰撞：

```text
COL_[Part]
```

角色：

```text
COL_Body
COL_Torso
COL_Head
COL_Legs
```

环境：

```text
COL_Wall
COL_Floor
COL_Stairs
COL_Rock
```

Collision 与伤害判定必须分开。

---

## 18. Hitbox Naming

用于造成伤害：

```text
HIT_[Part]
```

示例：

```text
HIT_Fist_L
HIT_Fist_R
HIT_Foot_L
HIT_Foot_R
HIT_Weapon
HIT_Claw_L
HIT_Claw_R
HIT_Bite
```

---

## 19. Hurtbox Naming

用于受到伤害：

```text
HURT_[Part]
```

示例：

```text
HURT_Head
HURT_Chest
HURT_Arm_L
HURT_Arm_R
HURT_Leg_L
HURT_Leg_R
```

弱点：

```text
HURT_WeakPoint_Chest
HURT_WeakPoint_Back
```

---

## 20. LOD Naming

格式：

```text
MESH_[Part]_LOD0
MESH_[Part]_LOD1
MESH_[Part]_LOD2
```

定义：

```text
LOD0 = 最高质量
LOD1 = 中等质量
LOD2 = 最低质量
```

禁止反过来使用。

---

## 21. VFX Naming

格式：

```text
VFX_[Category]_[Name]
```

示例：

```text
VFX_MuzzleFlash_Rifle
VFX_Impact_Bullet
VFX_Blood_Hit
VFX_Magic_Fire
VFX_Magic_Ice
VFX_Heal
VFX_Revive
VFX_Zombie_HellAura
```

---

## 22. Environment Naming

格式：

```text
ENV_[Biome]_[Object]
```

示例：

```text
ENV_Desert_Rock_A
ENV_Desert_Rock_B
ENV_Desert_Cactus_A
ENV_Hell_Rock_A
ENV_Hell_LavaColumn_A
ENV_House_Wall_A
ENV_House_Door_A
ENV_Grass_Tree_A
```

模块化建筑：

```text
ENV_House_Wall_Straight_A
ENV_House_Wall_Corner_A
ENV_House_DoorFrame_A
ENV_House_Window_A
```

---

## 23. Prop Naming

格式：

```text
PROP_[Name]
```

示例：

```text
PROP_AmmoBox
PROP_Medkit
PROP_Bandage
PROP_Grenade
PROP_Chest
PROP_Barrel
PROP_Crate
```

变体：

```text
PROP_Crate_A
PROP_Crate_B
PROP_Crate_C
```

---

## 24. Rig Controller Naming

仅 Blender 工作文件使用：

```text
CTRL_[Name]
```

示例：

```text
CTRL_Root
CTRL_Hand_L
CTRL_Hand_R
CTRL_Foot_L
CTRL_Foot_R
```

`CTRL_*` 不应导出进入最终游戏 GLB。

---

## 25. IK Naming

如必须导出 IK Target：

```text
IK_Hand_L
IK_Hand_R
IK_Foot_L
IK_Foot_R
```

如果只用于 Blender 制作动画，则不要导出。

---

## 26. GLB Root Node Naming

文件：

```text
CHR_SURV_Warrior_v01.glb
```

内部 Root Node：

```text
CHR_SURV_Warrior
```

推荐结构：

```text
CHR_SURV_Warrior
├── SKEL_Survivor
├── MESH_Body
├── MESH_Armor
├── MESH_Helmet
└── ...
```

版本号只属于文件名，不写进内部节点。

---

## 27. Survivor 完整结构示例

```text
CHR_SURV_Warrior
│
├── SKEL_Survivor
│   └── Root
│       └── Hips
│           └── ...
│
├── MESH_Body
├── MESH_Hair
├── MESH_Beard
├── MESH_Armor
├── MESH_Helmet
│
├── SOCKET_Hand_L
├── SOCKET_Hand_R
├── SOCKET_Back
├── SOCKET_Hip_L
├── SOCKET_Hip_R
├── SOCKET_Head
└── SOCKET_Chest
```

强制：

```text
角色 GLB 内不得包含武器 Mesh。
```

---

## 28. Zombie 完整结构示例

```text
CHR_ENEMY_ZombieBase
│
├── SKEL_Enemy
├── MESH_Body
├── MESH_Head
│
├── SOCKET_Head
├── SOCKET_Chest
├── SOCKET_Back
├── SOCKET_Shoulder_L
├── SOCKET_Shoulder_R
├── SOCKET_Leg_L
└── SOCKET_Leg_R
```

运行时组合：

```text
CHR_ENEMY_ZombieBase
+
ATT_Hell_Head_A
+
ATT_Hell_Chest_A
+
ATT_Hell_Back_B
+
MAT_ENEMY_Hell_Body
+
MAT_ENEMY_Hell_Crystal
```

---

## 29. 文件夹命名

目录统一使用小写：

```text
assets/
├── characters/
│   ├── survivors/
│   └── enemies/
├── weapons/
├── attachments/
├── props/
├── environments/
├── animations/
├── textures/
├── materials/
├── vfx/
└── audio/
```

不要混用：

```text
Characters
CHARACTERS
CharacterAssets
```

---

## 30. 版本管理

只有文件名带版本：

```text
CHR_SURV_Warrior_v01.glb
CHR_SURV_Warrior_v02.glb
```

内部节点禁止带版本：

```text
MESH_Body_v02
MAT_Body_v03
Root_v05
```

内部永远保持：

```text
MESH_Body
MAT_SURV_Body
Root
```

---

## 31. Variant 与 Version 区别

视觉变体：

```text
_A
_B
_C
```

制作版本：

```text
_v01
_v02
_v03
```

例如：

```text
ATT_Hell_Head_B_v03.glb
```

含义：

```text
Hell Head Attachment
B 视觉变体
第 3 个制作版本
```

A/B/C 和 v01/v02 不能混用。

---

## 32. 禁止把游戏数值写进资产名

禁止：

```text
WPN_Rifle_100Damage
Zombie_500HP
Warrior_Level20
Sword_Rare
Sword_GoldCard
```

游戏属性属于配置数据，不属于 3D 资产命名。

正确：

```text
WPN_Rifle_Assault_A
WPN_Sword_Knight_A
```

---

## 33. Character GLB 禁止包含的资产

Survivor / Enemy Character GLB 原则上禁止嵌入：

```text
WPN_*
PROJ_*
VFX_*
```

角色本体允许：

```text
MESH_Armor
MESH_Hood
MESH_Backpack
MESH_Helmet
```

如果某个装备属于角色永久外观，可以作为 Character Mesh。

如果运行时会随机替换，应作为：

```text
ATT_*
```

---

## 34. AI 自动 QA 命名错误

发现以下名字自动判定：

```text
Naming Standard: FAIL
```

典型错误：

```text
Cube
Cube.001
Sphere
Object
Armature
Material
Material.001
Action
Take 001
mixamorig:*
Bip001*
Bone.*
```

可以可靠映射时允许自动 Rename。

无法可靠确认 Bone 身份时：

```text
FLAG_REVIEW
```

禁止 AI 根据名字随意猜测骨骼用途。

---

## 35. 大小写规则

正确：

```text
Root
Hips
Spine
MESH_Body
MAT_SURV_Body
ANIM_Idle
```

错误：

```text
ROOT
hips
mesh_Body
Mat_SURV_body
anim_idle
```

大小写属于 Naming Standard 的一部分。

---

# NingAcademy Games 核心锁定标准

## Survivor Skeleton

```text
SKEL_Survivor
```

## Enemy Skeleton

```text
SKEL_Enemy
```

## Survivor Canonical Bones

```text
Root
Hips
Spine
Chest
Neck
Head
Shoulder_L
UpperArm_L
LowerArm_L
Hand_L
Shoulder_R
UpperArm_R
LowerArm_R
Hand_R
UpperLeg_L
LowerLeg_L
Foot_L
UpperLeg_R
LowerLeg_R
Foot_R
```

## Survivor Core Sockets

```text
SOCKET_Hand_L
SOCKET_Hand_R
SOCKET_Back
SOCKET_Hip_L
SOCKET_Hip_R
SOCKET_Head
SOCKET_Chest
```

## Enemy Attachment Sockets

```text
SOCKET_Head
SOCKET_Chest
SOCKET_Back
SOCKET_Shoulder_L
SOCKET_Shoulder_R
SOCKET_Leg_L
SOCKET_Leg_R
```

## Core Prefixes

```text
CHR_
MESH_
SKEL_
SOCKET_
ANIM_
MAT_
T_
WPN_
ATT_
PROP_
PROJ_
VFX_
COL_
HIT_
HURT_
ENV_
```

---

# AI 执行要求

任何 AI 生成、修改、修复或检查 NingAcademy Games 3D 资产时必须：

1. 严格遵守本 Naming Standard。
2. 禁止自行新增另一套命名体系。
3. 禁止改变 `SKEL_Survivor` Canonical Bone 名称和层级。
4. 禁止角色 GLB 自带武器 Mesh。
5. 武器必须独立为 `WPN_*` 资产。
6. 可替换生态部件必须使用 `ATT_*`。
7. 自动删除无用节点前必须确认它不参与 Skin、Animation、Socket 或 Mesh。
8. 可以明确判断的非标准名称应自动标准化。
9. 无法可靠判断用途的 Bone / Node 必须标记 `FLAG_REVIEW`，不能猜测。
10. 导出前必须重新执行 Naming QA。

**标准版本：NingAcademy Games Naming Standard v1.0**
