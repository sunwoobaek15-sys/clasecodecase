class_name SawHazard
extends Node2D
## Spinning gear blade half sunk into the floor of the clock city. Slides
## back and forth on its rail and hurts the hero on contact (can be jumped
## over or dodged through).

const TEX := preload("res://assets/environments/clock_city/saw_gear.png")
const DAMAGE := 10

@export var travel: float = 36.0
@export var speed: float = 1.4
var _sprite: Sprite2D
var _hitbox: Hitbox
var _t := 0.0
var _origin := Vector2.ZERO


func _ready() -> void:
	add_to_group(&"hazards")
	_origin = position
	_t = randf() * TAU
	var rail := Line2D.new()
	rail.points = PackedVector2Array([Vector2(-travel - 10, -1), Vector2(travel + 10, -1)])
	rail.width = 2.0
	rail.default_color = Color(0.25, 0.22, 0.35)
	rail.z_index = -1
	add_child(rail)
	_sprite = Sprite2D.new()
	_sprite.texture = TEX
	_sprite.position = Vector2(0, -6)
	add_child(_sprite)
	_hitbox = Hitbox.create(Rect2(-12, -20, 24, 18), Hitbox.LAYER_PLAYER_HURTBOX)
	_hitbox.rehit_interval = 0.9
	_hitbox.radial_knockback = true
	add_child(_hitbox)
	_hitbox.activate(HitData.make(DAMAGE, Vector2(150, -220), self, &"saw"))


func _physics_process(delta: float) -> void:
	_t += delta * speed
	var off := sin(_t) * travel
	_sprite.position.x = off
	_hitbox.position.x = off
	_sprite.rotation += delta * 9.0 * (1.0 if cos(_t) >= 0.0 else -1.0)


## Current centre of the blade in world space (used by the autoplay bot).
func blade_position() -> Vector2:
	return global_position + Vector2(_sprite.position.x, -6)
