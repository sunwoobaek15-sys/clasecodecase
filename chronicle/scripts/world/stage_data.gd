class_name StageData
extends Resource
## One stage (res://data/stages/*.tres): level map, art set, boss and texts.
## The generic stage scene (scripts/world/stage.gd) builds everything from it.

@export var id: String = ""
@export var title: String = ""
@export var region: String = ""
@export_file("*.txt") var level_path: String = ""
@export var tiles: Texture2D
@export var bg_sky: Texture2D
@export var bg_far: Texture2D
@export var bg_mid: Texture2D
@export var bg_near: Texture2D
@export var foreground: Texture2D
@export var arena_wall: Texture2D
## Small props scattered on the ground and the occasional tall prop.
@export var props: Array[Texture2D] = []
@export var tall_prop: Texture2D
@export var tall_prop_tint: Color = Color(0.72, 0.8, 0.78)
## "forest" (fireflies + leaves) or "clock" (blue time motes + sparks)
@export var particles: String = "forest"
@export var boss_scene: PackedScene
@export_multiline var clear_text: String = ""
## Slime look/stats for the n/s/e markers: "forest", "clockwork" or "cloud".
@export var slime_theme: String = "forest"
## Reward of the stage's hidden chest ($ marker).
@export var chest_gold: int = 50
@export var chest_items: Dictionary = {}
