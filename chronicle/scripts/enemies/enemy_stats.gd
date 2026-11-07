class_name EnemyStats
extends Resource
## Monster/boss numbers, stored in res://data/enemies/*.tres.

@export var id: StringName = &""
@export var display_name: String = ""
@export var max_hp: int = 40
@export var contact_damage: int = 6
@export var attack_damage: int = 8
@export var move_speed: float = 32.0
@export var chase_speed: float = 62.0
@export var aggro_range: float = 190.0
@export var lose_range: float = 320.0
@export var attack_range: float = 42.0
@export var shot_range: float = 210.0
@export var attack_cooldown: float = 1.6
@export_range(0.0, 1.0) var knockback_resist: float = 0.0
@export var poise: float = 0.0             ## 0 = always flinches
@export_range(0.0, 1.0) var heal_drop_chance: float = 0.35
