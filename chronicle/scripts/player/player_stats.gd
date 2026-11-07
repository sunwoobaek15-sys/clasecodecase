class_name PlayerStats
extends Resource
## Tunable numbers for the hero. Lives in res://data/player/hero_stats.tres.
## Phase 2 (levels, equipment) will modify a runtime copy of this resource.

@export_group("Vitals")
@export var max_hp: int = 120
@export var max_mp: float = 60.0
@export var mp_regen: float = 3.0          ## per second
@export var mp_on_hit: float = 2.0         ## per basic attack hit
@export var attack: int = 10
@export_range(0.0, 1.0) var crit_chance: float = 0.1
@export var crit_multiplier: float = 1.5

@export_group("Movement")
@export var run_speed: float = 125.0
@export var walk_speed: float = 62.0
@export var ground_accel: float = 1300.0
@export var ground_friction: float = 1500.0
@export var air_accel: float = 900.0
@export var jump_velocity: float = 365.0
@export var gravity_up: float = 980.0
@export var gravity_down: float = 1650.0
@export var jump_cut: float = 0.45         ## vertical speed kept when jump is released early
@export var max_fall_speed: float = 480.0
@export var coyote_time: float = 0.1
@export var jump_buffer: float = 0.13

@export_group("Dodge")
@export var dodge_speed: float = 310.0
@export var dodge_time: float = 0.24
@export var dodge_iframes: float = 0.28
@export var dodge_cooldown: float = 0.42

@export_group("Damage taken")
@export var hurt_stun: float = 0.3
@export var hurt_iframes: float = 1.0

@export_group("Ultimate gauge")
@export var ult_max: float = 100.0
@export var ult_per_damage: float = 0.28   ## gauge per point of damage dealt
@export var ult_per_hit_taken: float = 6.0
@export var heavy_charge_min: float = 0.3  ## attack held this long -> charge stance
@export var heavy_charge_full: float = 0.9
