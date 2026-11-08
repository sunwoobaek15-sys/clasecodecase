class_name CrumblePlatform
extends StaticBody2D
## Cracked marble ledge (one-way) that shakes and falls a moment after the
## hero steps on it, then comes back a few seconds later.

const TEX := preload("res://assets/environments/sky_ruins/crumble.png")
const SHAKE_TIME := 0.55
const RESPAWN_TIME := 3.0

@export var tiles: int = 3
var _shape: CollisionShape2D
var _sprites: Node2D
var _sensor: Area2D
var _state := &"solid"
var _t := 0.0


func _ready() -> void:
	add_to_group(&"crumble")
	collision_layer = 1
	collision_mask = 0
	var w := tiles * 16.0
	_shape = CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = Vector2(w, 6)
	_shape.shape = r
	_shape.position = Vector2(w / 2.0, 3)
	_shape.one_way_collision = true
	add_child(_shape)
	_sprites = Node2D.new()
	add_child(_sprites)
	for i in tiles:
		var s := Sprite2D.new()
		s.texture = TEX
		s.centered = false
		s.position = Vector2(i * 16, 0)
		_sprites.add_child(s)
	_sensor = Area2D.new()
	_sensor.collision_layer = 0
	_sensor.collision_mask = 2
	var sc := CollisionShape2D.new()
	var sr := RectangleShape2D.new()
	sr.size = Vector2(w - 4, 6)
	sc.shape = sr
	sc.position = Vector2(w / 2.0, -3)
	_sensor.add_child(sc)
	add_child(_sensor)


func is_solid() -> bool:
	return _state != &"gone"


func _physics_process(delta: float) -> void:
	_t += delta
	match _state:
		&"solid":
			for b in _sensor.get_overlapping_bodies():
				var p := b as Player
				# feet on the ledge (not a hero standing below whose head touches it)
				if p != null and p.is_on_floor() and p.global_position.y <= global_position.y + 2.0:
					_state = &"shaking"
					_t = 0.0
		&"shaking":
			_sprites.position = Vector2(randf_range(-1, 1), randf_range(0, 1))
			if _t >= SHAKE_TIME:
				_state = &"gone"
				_t = 0.0
				_shape.set_deferred("disabled", true)
				var tw := create_tween()
				tw.tween_property(_sprites, "position:y", 40.0, 0.4)
				tw.parallel().tween_property(_sprites, "modulate:a", 0.0, 0.4)
		&"gone":
			if _t >= RESPAWN_TIME:
				_state = &"solid"
				_t = 0.0
				_shape.set_deferred("disabled", false)
				_sprites.position = Vector2.ZERO
				_sprites.modulate.a = 0.0
				create_tween().tween_property(_sprites, "modulate:a", 1.0, 0.3)
