class_name Checkpoint
extends Area2D
## Time crystal on a pedestal. Touching it saves the respawn point and fully
## restores HP/MP. (Phase 2 will also write the save file here.)

const CRYSTAL_TEX := preload("res://assets/bosses/verdan/art/part_crystal.png")
const PEDESTAL_TEX := preload("res://assets/environments/forgotten_forest/pedestal.png")

var checkpoint_id: int = 0
var _activated: bool = false
var _crystal: Sprite2D
var _t: float = 0.0


func _ready() -> void:
	collision_layer = 0
	collision_mask = 2
	monitoring = true
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(28, 60)
	shape.shape = rect
	shape.position = Vector2(0, -30)
	add_child(shape)
	var ped := Sprite2D.new()
	ped.texture = PEDESTAL_TEX
	ped.centered = false
	ped.offset = Vector2(-14, -14)
	ped.z_index = -2
	add_child(ped)
	_crystal = Sprite2D.new()
	_crystal.texture = CRYSTAL_TEX
	_crystal.position = Vector2(0, -32)
	_crystal.z_index = -1
	_crystal.modulate = Color(0.6, 0.7, 0.75)
	add_child(_crystal)
	if Game.checkpoint_id >= checkpoint_id:
		_set_active_visual()
	body_entered.connect(_on_body_entered)


func _process(delta: float) -> void:
	_t += delta
	_crystal.position.y = -32.0 + sin(_t * 2.5) * 2.0


func _on_body_entered(body: Node) -> void:
	if not (body is Player) or (body as Player).is_dead:
		return
	var p := body as Player
	p.heal(p.max_hp)
	p.restore_mana(p.stats.max_mp)
	if not _activated or Game.checkpoint_id < checkpoint_id:
		Game.checkpoint_id = checkpoint_id
		Events.checkpoint_reached.emit(checkpoint_id)
		Events.toast.emit("체크포인트 저장! 체력이 모두 회복되었어요.")
		FX.spark(global_position + Vector2(0, -32), Color(0.5, 1.0, 0.8), true)
	_set_active_visual()


func _set_active_visual() -> void:
	_activated = true
	_crystal.modulate = Color(1, 1, 1)
