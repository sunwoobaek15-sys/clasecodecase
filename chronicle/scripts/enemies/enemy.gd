class_name Enemy
extends Entity
## Base for monsters and bosses: stats resource, target tracking, contact
## damage, a small HP bar, poise (super armour) and drops.
## Subclasses build their AI with the StateMachine in `fsm`.

const HEAL_ORB_SCENE := preload("res://scenes/world/heal_orb.tscn")
const ITEM_DROP_SCENE := preload("res://scenes/world/item_drop.tscn")

@export var stats: EnemyStats
@export var show_hp_bar: bool = true

var target: Player = null
var fsm := StateMachine.new()
var spawn_position: Vector2 = Vector2.ZERO
var gravity: float = 900.0
var max_fall: float = 520.0
var poise_damage: float = 0.0
var _knock: Vector2 = Vector2.ZERO
var _hp_bar_timer: float = 0.0
var _hp_bar: Node2D
var _bar_width: float = 24.0

@onready var contact_hitbox: Hitbox = $ContactHitbox


func _ready() -> void:
	if stats != null:
		max_hp = stats.max_hp
	super._ready()
	spawn_position = global_position
	add_to_group(&"enemies")
	hurtbox.entity = self
	contact_hitbox.source_entity = self
	contact_hitbox.target_mask = Hitbox.LAYER_PLAYER_HURTBOX
	contact_hitbox.rehit_interval = 0.45
	contact_hitbox.radial_knockback = true
	set_contact_damage(true)
	if show_hp_bar:
		_hp_bar = Node2D.new()
		_hp_bar.z_index = 30
		_hp_bar.draw.connect(_draw_hp_bar)
		add_child(_hp_bar)


func set_contact_damage(on: bool) -> void:
	if on and stats != null and stats.contact_damage > 0:
		var h := HitData.make(stats.contact_damage, Vector2(140, -90), self, &"contact")
		contact_hitbox.activate(h)
	else:
		contact_hitbox.deactivate()


# ---------------------------------------------------------------- targeting ---
func find_target() -> void:
	target = get_tree().get_first_node_in_group(&"player") as Player


func has_target() -> bool:
	return target != null and is_instance_valid(target) and not target.is_dead


func to_target() -> Vector2:
	return target.global_position - global_position if has_target() else Vector2.ZERO


func target_distance() -> float:
	return to_target().length() if has_target() else INF


func face_target() -> void:
	if has_target():
		set_facing(signf(to_target().x))


func sees_target(range_px: float, max_dy: float = 90.0) -> bool:
	if not has_target():
		return false
	var d := to_target()
	return absf(d.x) <= range_px and absf(d.y) <= max_dy


# ------------------------------------------------------------------ physics ---
func apply_gravity(delta: float) -> void:
	if not is_on_floor():
		velocity.y = minf(velocity.y + gravity * delta, max_fall)


## True when there is no ground a little ahead in direction `dir`.
func ledge_ahead(dir: int, ahead: float = 12.0) -> bool:
	var from := global_position + Vector2(dir * ahead, -4)
	var q := PhysicsRayQueryParameters2D.create(from, from + Vector2(0, 22), 1)
	return get_world_2d().direct_space_state.intersect_ray(q).is_empty()


func wall_ahead(dir: int) -> bool:
	return is_on_wall() and get_wall_normal().x * dir < 0.0


# ------------------------------------------------------------------- damage ---
## Returns true if this hit should interrupt the current action.
func breaks_poise(hit: HitData) -> bool:
	if stats == null or stats.poise <= 0.0:
		return true
	poise_damage += hit.stagger
	if poise_damage >= stats.poise:
		poise_damage = 0.0
		return true
	return false


func knockback_from(hit: HitData) -> Vector2:
	var resist := stats.knockback_resist if stats != null else 0.0
	return hit.knockback * (1.0 - resist)


func apply_damage(hit: HitData) -> void:
	super.apply_damage(hit)
	_hp_bar_timer = 2.5
	if _hp_bar:
		_hp_bar.queue_redraw()


func _on_death(_hit: HitData) -> void:
	set_contact_damage(false)
	set_hurtbox_enabled(false)
	Game.add_stat("kills", 1)
	Events.enemy_killed.emit(self)
	if stats != null and randf() < stats.heal_drop_chance:
		call_deferred("_spawn_heal_orb")
	call_deferred("spawn_drops")


## Rolls the drop table (EnemyStats.drops). Unique items that the hero
## already owns are skipped.
func spawn_drops() -> void:
	if stats == null or not is_inside_tree():
		return
	var i := 0
	for entry in stats.drops:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var d: Dictionary = entry
		var id := StringName(str(d.get("id", "")))
		var item := ItemDB.get_item(id)
		if item == null or randf() > float(d.get("chance", 1.0)):
			continue
		if item.unique and Profile.owns(id):
			continue
		var drop := ITEM_DROP_SCENE.instantiate() as Pickup
		drop.item_id = id
		drop.item_count = int(d.get("count", 1))
		drop.position = global_position + Vector2((i - 1) * 16.0, -16.0)
		get_parent().add_child(drop)
		i += 1


func _spawn_heal_orb() -> void:
	var orb := HEAL_ORB_SCENE.instantiate()
	orb.position = global_position + Vector2(0, -10)
	get_parent().add_child(orb)


## Fade out and free (call at the end of the death animation).
func vanish(delay: float = 0.0) -> void:
	var t := create_tween()
	if delay > 0.0:
		t.tween_interval(delay)
	t.tween_property(self, "modulate:a", 0.0, 0.35)
	t.tween_callback(queue_free)


func update_hp_bar(delta: float) -> void:
	if _hp_bar == null:
		return
	if _hp_bar_timer > 0.0:
		_hp_bar_timer -= delta
		if _hp_bar_timer <= 0.0:
			_hp_bar.queue_redraw()


func _draw_hp_bar() -> void:
	if _hp_bar_timer <= 0.0 or is_dead or max_hp <= 0:
		return
	var w := _bar_width
	var y := -body_height - 8.0
	var ratio := clampf(float(hp) / float(max_hp), 0.0, 1.0)
	_hp_bar.draw_rect(Rect2(-w / 2 - 1, y - 1, w + 2, 5), Color(0.04, 0.04, 0.08, 0.9))
	_hp_bar.draw_rect(Rect2(-w / 2, y, w, 3), Color(0.3, 0.08, 0.1))
	_hp_bar.draw_rect(Rect2(-w / 2, y, w * ratio, 3), Color(0.92, 0.28, 0.25))
