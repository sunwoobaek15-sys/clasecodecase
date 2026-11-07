class_name Hitbox
extends Area2D
## Damage area.
##
## While active it runs a direct shape query against hurtboxes every physics
## frame. A direct query (instead of Area2D overlap signals) means a hitbox
## that was just moved or resized for a new attack hits on the same frame, and
## the query ignores the parent's mirror scale, so flipping a character never
## produces a negative-scale physics shape.
## Each hurtbox is hit at most once per activation; set rehit_interval to
## allow repeated hits (contact damage, damage-over-time areas).

signal landed(target: Hurtbox, hit: HitData)

const LAYER_PLAYER_HURTBOX := 8   # physics layer 4
const LAYER_ENEMY_HURTBOX := 16   # physics layer 5

@export var target_mask: int = LAYER_ENEMY_HURTBOX
@export var rehit_interval: float = 0.0
## Push targets away from the hitbox centre instead of using the fixed
## knock-back direction (contact damage, explosions, ground bursts).
@export var radial_knockback: bool = false

var active: bool = false
var source_entity: Node = null
var _template: HitData
var _already_hit: Dictionary = {}
var _rehit_timer: float = 0.0
var _shape_node: CollisionShape2D
var _params: PhysicsShapeQueryParameters2D  ## reused every query (no per-frame allocation)


## Builds a hitbox with a rectangle shape in code.
static func create(rect: Rect2, mask: int) -> Hitbox:
	var hb := Hitbox.new()
	hb.target_mask = mask
	var cs := CollisionShape2D.new()
	cs.shape = RectangleShape2D.new()
	hb.add_child(cs)
	hb._shape_node = cs
	hb.set_rect(rect)
	return hb


## One-off damage area at a world position (explosions, eruptions).
## The hitbox lives `duration` seconds, then frees itself.
static func blast(parent: Node, at: Vector2, rect: Rect2, hit: HitData, mask: int,
		duration: float, source: Node = null) -> Hitbox:
	var holder := Node2D.new()
	parent.add_child(holder)
	holder.global_position = at
	var hb := Hitbox.create(rect, mask)
	hb.source_entity = source
	hb.radial_knockback = true
	holder.add_child(hb)
	hb.activate(hit)
	var t := holder.create_tween()
	t.tween_interval(duration)
	t.tween_callback(holder.queue_free)
	return hb


func _ready() -> void:
	monitoring = false
	monitorable = false
	collision_layer = 0
	collision_mask = 0
	if _shape_node == null:
		for c in get_children():
			if c is CollisionShape2D:
				_shape_node = c
				break
	if _shape_node and _shape_node.shape:
		# Shapes are shared between scene instances; make ours unique.
		_shape_node.shape = _shape_node.shape.duplicate()
	if source_entity == null:
		source_entity = owner


## rect is in this node's local, un-mirrored space (character facing right).
func set_rect(rect: Rect2) -> void:
	if _shape_node == null:
		return
	var shape := _shape_node.shape as RectangleShape2D
	if shape == null:
		shape = RectangleShape2D.new()
		_shape_node.shape = shape
	shape.size = rect.size.abs()
	_shape_node.position = rect.position + rect.size * 0.5


func activate(hit: HitData) -> void:
	_template = hit
	_already_hit.clear()
	_rehit_timer = rehit_interval
	active = true
	if is_inside_tree():
		_query()


func deactivate() -> void:
	active = false


func _physics_process(delta: float) -> void:
	if not active:
		return
	if rehit_interval > 0.0:
		_rehit_timer -= delta
		if _rehit_timer <= 0.0:
			_rehit_timer = rehit_interval
			_already_hit.clear()
	_query()


func _query() -> void:
	if _shape_node == null or _template == null or not is_inside_tree():
		return
	if _params == null:
		_params = PhysicsShapeQueryParameters2D.new()
		_params.collide_with_areas = true
		_params.collide_with_bodies = false
	_params.shape = _shape_node.shape
	_params.transform = Transform2D(0.0, _shape_node.global_position)
	_params.collision_mask = target_mask
	var results := get_world_2d().direct_space_state.intersect_shape(_params, 24)
	for r in results:
		var area: Object = r.get("collider")
		if not (area is Hurtbox):
			continue
		var hb := area as Hurtbox
		if hb.entity == source_entity:
			continue
		var id := hb.get_instance_id()
		if _already_hit.has(id):
			continue
		_already_hit[id] = true
		var hit := _template.copy()
		if hit == null:
			continue
		hit.position = (_shape_node.global_position + hb.global_position) * 0.5
		if radial_knockback:
			var dir := signf(hb.global_position.x - _shape_node.global_position.x)
			hit.knockback.x = absf(hit.knockback.x) * (dir if dir != 0.0 else 1.0)
		if hb.receive(hit):
			landed.emit(hb, hit)
		if not active:
			return
