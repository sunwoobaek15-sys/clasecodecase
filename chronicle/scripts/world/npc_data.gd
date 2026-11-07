class_name NpcData
extends Resource
## A village NPC (res://data/npcs/*.tres): look, portrait and small talk.

@export var id: StringName = &""
@export var display_name: String = ""
@export var role: String = ""
@export var sprite: Texture2D
@export var portrait: Texture2D
## Random small talk (one line per conversation).
@export var lines: PackedStringArray = []
## First words when the player meets this NPC for the first time.
@export var intro: PackedStringArray = []
## The NPC only appears once this facility is restored (&"" = always there).
@export var requires_facility: StringName = &""
