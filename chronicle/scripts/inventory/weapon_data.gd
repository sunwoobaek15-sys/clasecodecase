class_name WeaponData
extends Resource
## A weapon = its whole move set. Every weapon type (sword, greatsword, dual
## blades, staff, spear) gets its own .tres in res://data/items/ with different
## AttackData, so switching weapons changes how the hero fights.
## Phase 1 ships the starting sword (청월검).

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var combo_1: AttackData
@export var combo_2: AttackData
@export var combo_3: AttackData
@export var air_attack: AttackData
@export var heavy_attack: AttackData
@export var skill: AttackData
@export var ultimate: AttackData


func combo() -> Array[AttackData]:
	var list: Array[AttackData] = []
	for a in [combo_1, combo_2, combo_3]:
		if a != null:
			list.append(a)
	return list
