class_name Projectile
extends Node2D
## Straight or ballistic projectile carrying a Hitbox.
## Frees itself when its lifetime ends, when it hits terrain
## (collide_with_world) or after the first hit (unless pierce).

signal impacted(at: Vector2, hit_something: bool)
signal hit_landed(target: Hurtbox, hit: HitData)

@export var texture: Texture2D
@export var lifetime: float = 2.0
@export var gravity: float = 0.0
@export var pierce: bool = false
@export var collide_with_world: bool = true
@export var spin: float = 0.0              ## visual rotation speed (rad/s)
@export var face_velocity: bool = false
@export var hit_rect: Rect2 = Rect2(-8, -8, 16, 16)
@export var additive: bool = false

var velocity: Vector2 = Vector2.ZERO
var hit: HitData
var target_mask: int = Hitbox.LAYER_PLAYER_HURTBOX
var source: Node = null
var _age: float = 0.0
var _done: bool = false
var hitbox: Hitbox
var visual: Sprite2D


func _ready() -> void:
	visual = Sprite2D.new()
	visual.texture = texture
	if additive:
		var mat := CanvasItemMaterial.new()
		mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		visual.material = mat
	add_child(visual)
	hitbox = Hitbox.create(hit_rect, target_mask)
	hitbox.source_entity = source
	add_child(hitbox)
	hitbox.landed.connect(_on_landed)
	if hit != null:
		hitbox.activate(hit)
	if velocity.x < 0.0 and not face_velocity:
		visual.flip_h = true


## Sets up the projectile; call before adding it to the tree.
func setup(from: Vector2, vel: Vector2, hit_data: HitData, mask: int, owner_node: Node) -> void:
	position = from
	velocity = vel
	hit = hit_data
	target_mask = mask
	source = owner_node


## Velocity that lands on `to` after `time` seconds under `grav`.
static func ballistic_velocity(from: Vector2, to: Vector2, time: float, grav: float) -> Vector2:
	var d := to - from
	return Vector2(d.x / time, (d.y - 0.5 * grav * time * time) / time)


func _physics_process(delta: float) -> void:
	if _done:
		return
	_age += delta
	velocity.y += gravity * delta
	var motion := velocity * delta
	if collide_with_world and motion != Vector2.ZERO:
		var q := PhysicsRayQueryParameters2D.create(global_position, global_position + motion, 1)
		var res := get_world_2d().direct_space_state.intersect_ray(q)
		if not res.is_empty():
			global_position = res["position"]
			_finish(false)
			return
	global_position += motion
	if face_velocity and velocity.length_squared() > 1.0:
		visual.rotation = velocity.angle()
	elif spin != 0.0:
		visual.rotation += spin * delta * (1.0 if velocity.x >= 0.0 else -1.0)
	if _age >= lifetime:
		_finish(false)


func _on_landed(target: Hurtbox, landed_hit: HitData) -> void:
	hit_landed.emit(target, landed_hit)
	if not pierce:
		_finish(true)


func _finish(hit_something: bool) -> void:
	if _done:
		return
	_done = true
	hitbox.deactivate()
	impacted.emit(global_position, hit_something)
	var t := create_tween()
	t.tween_property(self, "modulate:a", 0.0, 0.08)
	t.tween_callback(queue_free)
