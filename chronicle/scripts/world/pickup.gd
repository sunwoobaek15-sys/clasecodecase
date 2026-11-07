class_name Pickup
extends Area2D
## Collectable item: heal orb (HP + MP) or the Time Core fragment (stage goal).
## Falls to the ground, bobs, and is collected when the player touches it.

signal collected(pickup: Pickup)

enum Kind { HEAL, TIME_CORE }

@export var kind: Kind = Kind.HEAL
@export var amount: int = 15
@export var fall: bool = true
@export var lifetime: float = 14.0  ## heal orbs disappear after a while (0 = never)

var _vy: float = -110.0
var _t: float = 0.0
var _age: float = 0.0
var _grounded: bool = false
var _collected: bool = false

@onready var sprite: Sprite2D = $Sprite


func _ready() -> void:
	monitoring = true
	body_entered.connect(_on_body_entered)
	_t = randf() * TAU


func _physics_process(delta: float) -> void:
	_t += delta
	_age += delta
	if fall and not _grounded:
		_vy = minf(_vy + 620.0 * delta, 320.0)
		var motion := Vector2(0.0, _vy * delta)
		if _vy > 0.0:
			var q := PhysicsRayQueryParameters2D.create(global_position, global_position + motion + Vector2(0, 7), 1)
			var res := get_world_2d().direct_space_state.intersect_ray(q)
			if not res.is_empty():
				global_position.y = res["position"].y - 7.0
				_grounded = true
				motion = Vector2.ZERO
		global_position += motion
	sprite.position.y = sin(_t * 4.0) * 2.0
	if kind == Kind.TIME_CORE:
		sprite.rotation = sin(_t * 2.0) * 0.08
	if lifetime > 0.0 and kind == Kind.HEAL:
		if _age > lifetime:
			queue_free()
		elif _age > lifetime - 3.0:
			visible = fmod(_age, 0.2) < 0.12


func _on_body_entered(body: Node) -> void:
	if _collected or not (body is Player) or (body as Player).is_dead:
		return
	_collected = true
	var player := body as Player
	if kind == Kind.HEAL:
		player.collect_heal(amount)
		FX.spark(global_position, Color(0.5, 1.0, 0.6), true)
	else:
		FX.spark(global_position, Color(0.6, 0.85, 1.0), true)
	collected.emit(self)
	queue_free()
