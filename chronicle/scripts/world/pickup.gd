class_name Pickup
extends Area2D
## Collectable: heal orb (HP + MP), an inventory item drop, or the Time Core
## fragment (stage goal).
## Falls to the ground, bobs, and is collected when the player touches it.

signal collected(pickup: Pickup)

enum Kind { HEAL, TIME_CORE, ITEM }

@export var kind: Kind = Kind.HEAL
@export var amount: int = 15
@export var fall: bool = true
@export var lifetime: float = 14.0  ## heal orbs disappear after a while (0 = never)
@export var item_id: StringName = &""
@export var item_count: int = 1
var _full_warned: float = 0.0

var _vy: float = -110.0
var _t: float = 0.0
var _age: float = 0.0
var _grounded: bool = false
var _collected: bool = false

@onready var sprite: Sprite2D = $Sprite


func _ready() -> void:
	add_to_group(&"pickups")
	monitoring = true
	body_entered.connect(_on_body_entered)
	_t = randf() * TAU
	if kind == Kind.ITEM:
		var item := ItemDB.get_item(item_id)
		if item != null:
			sprite.texture = item.icon
		lifetime = 0.0


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
	if kind == Kind.ITEM:
		sprite.modulate = Color(1, 1, 1).lerp(Color(1.4, 1.4, 1.2), 0.5 + 0.5 * sin(_t * 5.0))
	_full_warned = maxf(0.0, _full_warned - delta)
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
	var player := body as Player
	if kind == Kind.ITEM:
		collect_item()
		return
	_collected = true
	if kind == Kind.HEAL:
		player.collect_heal(amount)
		FX.spark(global_position, Color(0.5, 1.0, 0.6), true)
	else:
		FX.spark(global_position, Color(0.6, 0.85, 1.0), true)
	collected.emit(self)
	queue_free()


## Puts an item drop into the bag. Returns true when all of it fitted (the
## pickup is then removed); also used to sweep up loot when the stage ends.
func collect_item() -> bool:
	if _collected or kind != Kind.ITEM:
		return false
	var item := ItemDB.get_item(item_id)
	var added := Profile.inventory.add(item_id, item_count) if item != null else 0
	if added <= 0:
		if _full_warned <= 0.0:
			_full_warned = 3.0
			Events.toast.emit("가방이 가득 찼어요.")
		return false
	Events.toast.emit("%s 획득%s" % [item.display_name, "" if added == 1 else " x%d" % added])
	item_count -= added
	if item_count > 0:
		return false
	_collected = true
	FX.spark(global_position, Color(1.0, 0.9, 0.6), false)
	collected.emit(self)
	queue_free()
	return true
