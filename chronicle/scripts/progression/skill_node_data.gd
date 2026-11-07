class_name SkillNodeData
extends Resource
## One node of the skill tree (res://data/skills/tree/*.tres).
## Each rank adds `per_level` to the hero's modifier table
## (same stat keys as equipment, see Profile.STAT_KEYS).

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var icon: Texture2D
@export var max_level: int = 3
@export var cost: int = 1
@export var required_level: int = 1
@export var order: int = 0
@export var per_level: Dictionary = {}


func effect_text(rank: int) -> String:
	var parts: PackedStringArray = []
	for key in per_level:
		parts.append(Profile.describe_stat(StringName(key), float(per_level[key]) * rank))
	return ", ".join(parts)
