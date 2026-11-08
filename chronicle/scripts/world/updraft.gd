class_name Updraft
extends Area2D
## Rising wind column of the sky ruins: lifts the hero while inside (used to
## reach high platforms and the hidden chest). Visible as rising streaks.

const STREAK_TEX := preload("res://assets/environments/sky_ruins/wind_streak.png")
const LIFT := 2300.0
const MAX_UP := 230.0

@export var height: float = 160.0
@export var width: float = 28.0


func _ready() -> void:
	add_to_group(&"updrafts")
	collision_layer = 0
	collision_mask = 2
	monitoring = true
	var cs := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = Vector2(width, height)
	cs.shape = r
	cs.position = Vector2(0, -height / 2.0)
	add_child(cs)
	var p := CPUParticles2D.new()
	p.texture = STREAK_TEX
	p.amount = 14
	p.lifetime = 1.0
	p.preprocess = 1.0
	p.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	p.emission_rect_extents = Vector2(width / 2.0, 4)
	p.direction = Vector2(0, -1)
	p.spread = 4.0
	p.gravity = Vector2.ZERO
	p.initial_velocity_min = height * 0.9
	p.initial_velocity_max = height * 1.2
	p.color = Color(1, 1, 1, 0.8)
	p.z_index = 4
	add_child(p)


func top_y() -> float:
	return global_position.y - height


func _physics_process(delta: float) -> void:
	for b in get_overlapping_bodies():
		var pl := b as Player
		if pl != null and not pl.is_dead and not pl.is_frozen():
			pl.velocity.y = maxf(pl.velocity.y - LIFT * delta, -MAX_UP)
