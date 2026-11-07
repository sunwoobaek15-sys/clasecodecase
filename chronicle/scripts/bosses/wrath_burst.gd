class_name WrathBurst
extends Node2D
## One eruption of 숲의 분노: a warning circle, then a pillar of green energy.

const BURST_TEX := preload("res://assets/effects/verdan/ground_burst.png")
const PILLAR_TEX := preload("res://assets/effects/verdan/green_burst.png")

var delay: float = 1.0
var hit: HitData
var source: Node = null
var _t: float = 0.0
var _fired: bool = false


func _ready() -> void:
	var tele := Telegraph.new()
	tele.shape = Telegraph.Shape.CIRCLE
	tele.radius = 24.0
	tele.duration = delay
	add_child(tele)


func _physics_process(delta: float) -> void:
	_t += delta
	if not _fired and _t >= delay:
		_fired = true
		_erupt()


func _erupt() -> void:
	var parent := FX._parent()
	Hitbox.blast(parent, global_position, Rect2(-20, -66, 40, 66), hit.copy(),
			Hitbox.LAYER_PLAYER_HURTBOX, 0.24, source)
	FX.burst(PILLAR_TEX, global_position + Vector2(0, -38), 0.45, 0.8, 1.1, true)
	FX.burst(BURST_TEX, global_position + Vector2(0, -30), 0.4, 0.7, 1.0, false)
	FX.shake(1.8, 0.12)
	var t := create_tween()
	t.tween_interval(0.3)
	t.tween_callback(queue_free)
