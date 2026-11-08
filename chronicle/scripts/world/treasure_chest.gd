class_name TreasureChest
extends Area2D
## Hidden treasure chest (one per stage, $ in the map). Opens on touch once;
## the reward comes from the stage data. Opened chests are kept in the
## profile, so they stay open.

const TEX := preload("res://assets/environments/common/chest.png")

var chest_id: String = ""
var gold: int = 50
var items: Dictionary = {}
var stage_id: String = ""
var _sprite: Sprite2D
var _t := 0.0


func _ready() -> void:
	add_to_group(&"chests")
	collision_layer = 0
	collision_mask = 2
	monitoring = true
	var cs := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = Vector2(28, 26)
	cs.shape = r
	cs.position = Vector2(0, -13)
	add_child(cs)
	_sprite = Sprite2D.new()
	_sprite.texture = TEX
	_sprite.centered = false
	_sprite.offset = Vector2(-TEX.get_width() / 2.0, -TEX.get_height())
	add_child(_sprite)
	body_entered.connect(_on_body)
	if is_opened():
		_show_opened()


func is_opened() -> bool:
	return Profile.opened_chests.has(chest_id)


func _process(delta: float) -> void:
	_t += delta
	if not is_opened():
		_sprite.modulate = Color(1, 1, 1).lerp(Color(1.35, 1.3, 1.0), 0.5 + 0.5 * sin(_t * 4.0))


func _show_opened() -> void:
	_sprite.modulate = Color(0.6, 0.6, 0.7, 0.8)


func _on_body(body: Node) -> void:
	if not (body is Player) or is_opened():
		return
	Profile.opened_chests[chest_id] = true
	_show_opened()
	FX.spark(global_position + Vector2(0, -16), Color(1.0, 0.9, 0.5), true)
	var parts: PackedStringArray = []
	if gold > 0:
		Profile.add_gold(gold)
		parts.append("%dG" % gold)
	for id in items:
		var item := ItemDB.get_item(StringName(str(id)))
		if item != null and Profile.inventory.add(item.id, int(items[id])) > 0:
			parts.append("%s x%d" % [item.display_name, int(items[id])])
	Events.toast.emit("숨겨진 보물 발견! " + ", ".join(parts))
	Events.chest_opened.emit(chest_id, stage_id)
