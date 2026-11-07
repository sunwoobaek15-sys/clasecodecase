class_name Npc
extends Interactable
## A village NPC: standing sprite with a breathing animation, a quest marker
## ("!" new quest, "?" quest to hand in) and a highlight when in range.

const MARK_OFFER := preload("res://assets/ui/village/bubble_exclaim.png")
const MARK_TURNIN := preload("res://assets/ui/village/quest_turnin.png")
const MARK_TALK := preload("res://assets/ui/village/bubble_talk.png")

var data: NpcData
var sprite: Sprite2D
var _mark: Sprite2D
var _t := 0.0
var _highlight := false


func _ready() -> void:
	super()
	label = "대화"
	sprite = Sprite2D.new()
	sprite.texture = data.sprite
	sprite.centered = false
	sprite.offset = Vector2(-data.sprite.get_width() / 2.0, -data.sprite.get_height())
	add_child(sprite)
	_mark = Sprite2D.new()
	_mark.position = Vector2(0, -data.sprite.get_height() - 12)
	add_child(_mark)
	_t = randf() * TAU
	Quests.changed.connect(_update_mark)
	_update_mark()


func _process(delta: float) -> void:
	_t += delta
	sprite.scale.y = 1.0 + sin(_t * 2.2) * 0.012
	_mark.position.y = -data.sprite.get_height() - 12 - absf(sin(_t * 3.0)) * 3.0
	var hero := get_tree().get_first_node_in_group(&"player") as Node2D
	if hero != null:
		sprite.flip_h = hero.global_position.x < global_position.x


func _update_mark() -> void:
	match Quests.marker_for(data.id):
		"turnin":
			_mark.texture = MARK_TURNIN
		"offer":
			_mark.texture = MARK_OFFER
		_:
			_mark.texture = MARK_TALK if _highlight else null


func set_highlight(on: bool) -> void:
	_highlight = on
	sprite.modulate = Color(1.15, 1.15, 1.1) if on else Color(1, 1, 1)
	_update_mark()
