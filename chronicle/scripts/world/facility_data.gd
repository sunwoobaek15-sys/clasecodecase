class_name FacilityData
extends Resource
## A village facility that can be restored (res://data/village/*.tres).

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
## What restoring it unlocks (shown in the restoration list).
@export var unlock_text: String = ""
@export var cost_gold: int = 0
## Extra materials: {"item_slime_gel": 5}
@export var cost_items: Dictionary = {}
@export var ruined_texture: Texture2D
@export var restored_texture: Texture2D
@export var npc_id: StringName = &""
@export var order: int = 0
