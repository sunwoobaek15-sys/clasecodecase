class_name PetData
extends Resource
## One pet (res://data/pets/pet_*.tres). Passive bonuses use the same stat
## keys as equipment and skills (Profile.STAT_KEYS) and grow with pet level.

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var frames: SpriteFrames
@export var icon: Texture2D
@export var art: Texture2D
@export var flying: bool = false
@export var passive_name: String = ""
## Bonus at level 1 and the increase per level after that.
@export var base_bonuses: Dictionary = {}
@export var per_level: Dictionary = {}
## Extra behaviour of the pet node: &"regen", &"fireball", &"magnet" or &"".
@export var active: StringName = &""
@export var unlock_hint: String = ""
@export var order: int = 0


func bonuses_at(lv: int) -> Dictionary:
	var b := {}
	for key in base_bonuses:
		b[StringName(key)] = float(base_bonuses[key])
	for key in per_level:
		b[StringName(key)] = float(b.get(StringName(key), 0.0)) + float(per_level[key]) * (lv - 1)
	return b


func bonus_text(lv: int) -> String:
	var parts: PackedStringArray = []
	var b := bonuses_at(lv)
	for key in b:
		parts.append(Profile.describe_stat(key, float(b[key])))
	return ", ".join(parts)
