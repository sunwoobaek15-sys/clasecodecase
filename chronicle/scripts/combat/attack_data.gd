class_name AttackData
extends Resource
## Data for one player attack (combo hits, air slash, heavy, skill, ultimate).
## Stored as .tres files in res://data/skills/ so balance changes need no code.
## All times are in seconds from the start of the attack.

@export var id: StringName = &""
@export var display_name: String = ""
@export var animation: StringName = &"attack1"
@export var duration: float = 0.32
@export var active_start: float = 0.06
@export var active_end: float = 0.16
## From this time the next combo input is accepted (buffered input is kept).
@export var chain_time: float = 0.12
## From this time dodge / skill can interrupt the attack.
@export var cancel_time: float = 0.2
@export var damage_multiplier: float = 1.0
## Push applied to the target, x is mirrored with the attacker's facing.
@export var knockback: Vector2 = Vector2(110, -40)
@export var hit_stop: float = 0.04
@export var stagger: float = 10.0
@export var shake: float = 0.0
## Hitbox rectangle relative to the character origin (feet), facing right.
@export var hitbox: Rect2 = Rect2(6, -44, 44, 36)
## Forward movement during the attack.
@export var step_speed: float = 0.0
@export var step_time: float = 0.0
@export var mp_cost: float = 0.0
@export var cooldown: float = 0.0
## Optional projectile (skills): damage multiplier, speed and lifetime.
@export var projectile_multiplier: float = 0.0
@export var projectile_speed: float = 0.0
@export var projectile_lifetime: float = 0.0
