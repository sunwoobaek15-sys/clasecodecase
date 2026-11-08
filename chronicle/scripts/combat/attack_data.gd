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
## Optional projectile: damage multiplier, speed and lifetime. On normal
## attacks a projectile_tex makes the attack ranged (staff bolts).
@export var projectile_multiplier: float = 0.0
@export var projectile_speed: float = 0.0
@export var projectile_lifetime: float = 0.0
@export var projectile_tex: Texture2D
@export var projectile_count: int = 1
@export var projectile_spread: float = 0.0
@export var projectile_pierce: bool = false

# --- Phase 4: weapon identity ------------------------------------------------
## Playback speed of the hero animation (greatsword slow, dual blades fast).
@export var anim_speed: float = 1.0
## Several hits inside the active window (dual blades, spear double thrust).
@export var hits: int = 1
@export var hit_interval: float = 0.0
## Extra critical chance for this attack.
@export var crit_bonus: float = 0.0
## Slash / thrust effect shown when the attack becomes active.
@export var fx_tex: Texture2D
@export var fx_tint: Color = Color(1, 1, 1, 1)
@export var fx_scale: float = 1.0
@export var fx_offset: Vector2 = Vector2(30, -30)
## Skills only: "projectile" (default), "dash" (rush forward hitting along
## the way, invulnerable), "shockwave" (blasts running along the ground) or
## "nova" (delayed explosion in front of the hero).
@export var skill_kind: StringName = &"projectile"
## shockwave: number of blasts / nova: distance in front of the hero.
@export var skill_count: int = 5
@export var skill_range: float = 90.0
