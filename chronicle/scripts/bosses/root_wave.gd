class_name RootWave
extends Node2D
## Verdan's 뿌리 돌진: roots burst out of the ground one after another along a
## line. Each spike hurts only near the ground (26 px) and only while rising,
## so the wave can be jumped over or dodged through with invulnerability frames.

const SPIKE_TEX := preload("res://assets/effects/verdan/root_spike.png")

var direction: int = 1
var speed: float = 280.0
var max_distance: float = 500.0
var spacing: float = 26.0
var hit: HitData
var source: Node = null
var _front: float = 0.0
var _next: float = 0.0
var _spawned: int = 0


func _physics_process(delta: float) -> void:
	_front += speed * delta
	while _next <= _front and _next <= max_distance:
		_spawn(_next)
		_next += spacing
	if _next > max_distance and get_child_count() == 0:
		queue_free()


func front_position() -> Vector2:
	return global_position + Vector2(direction * minf(_front, max_distance), 0.0)


func is_finished() -> bool:
	return _next > max_distance


func _spawn(dist: float) -> void:
	var spike := Node2D.new()
	spike.position = Vector2(direction * dist, 0.0)
	add_child(spike)
	var s := Sprite2D.new()
	s.texture = SPIKE_TEX
	s.centered = false
	s.offset = Vector2(-SPIKE_TEX.get_width() / 2.0, -SPIKE_TEX.get_height() + 2.0)
	s.flip_h = (direction < 0) != (_spawned % 3 == 1)
	spike.add_child(s)
	var hb := Hitbox.create(Rect2(-12, -26, 24, 26), Hitbox.LAYER_PLAYER_HURTBOX)
	hb.source_entity = source
	spike.add_child(hb)
	var h := hit.copy()
	h.knockback.x = absf(h.knockback.x) * direction
	hb.activate(h)
	_spawned += 1
	# The spike only hurts while it shoots up (0.12 s); the retracting roots
	# are harmless. This keeps the wave jumpable with a fair ~0.25 s window.
	spike.scale.y = 0.15
	var t := spike.create_tween()
	t.tween_property(spike, "scale:y", 1.0, 0.05)
	t.tween_interval(0.07)
	t.tween_callback(hb.deactivate)
	t.tween_interval(0.12)
	t.tween_property(spike, "modulate", Color(0.7, 0.7, 0.7, 0.8), 0.05)
	t.tween_property(spike, "scale:y", 0.0, 0.2)
	t.tween_callback(spike.queue_free)
