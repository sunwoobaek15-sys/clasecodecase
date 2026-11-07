class_name ItemData
extends Resource
## One item definition (res://data/items/item_*.tres).
## Equipment bonuses use the same stat keys as skill-tree nodes
## (see Profile.STAT_KEYS), so both feed one modifier table.

enum Type { CONSUMABLE, WEAPON, ARMOR, ACCESSORY, MATERIAL }

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var type: Type = Type.MATERIAL
@export var icon: Texture2D
@export var max_stack: int = 1
@export var price: int = 0
## Only one copy can be owned (boss rewards are not dropped twice).
@export var unique: bool = false
@export var heal_hp: int = 0
@export var heal_mp: int = 0
## Stat modifiers while equipped, e.g. {"attack": 4, "defense_pct": 0.05}.
@export var bonuses: Dictionary = {}
## Move set for weapons (different weapons fight differently).
@export var weapon: WeaponData


func is_equipment() -> bool:
	return type == Type.WEAPON or type == Type.ARMOR or type == Type.ACCESSORY


func slot() -> StringName:
	match type:
		Type.WEAPON:
			return &"weapon"
		Type.ARMOR:
			return &"armor"
		Type.ACCESSORY:
			return &"accessory"
	return &""


func type_name() -> String:
	return ["소모품", "무기", "방어구", "장신구", "재료"][type]


## Human readable bonus list, e.g. "공격력 +4, 피해 감소 5%".
func bonus_text() -> String:
	var parts: PackedStringArray = []
	for key in bonuses:
		parts.append(Profile.describe_stat(StringName(key), float(bonuses[key])))
	if heal_hp > 0:
		parts.append("HP %d 회복" % heal_hp)
	if heal_mp > 0:
		parts.append("MP %d 회복" % heal_mp)
	return ", ".join(parts)
