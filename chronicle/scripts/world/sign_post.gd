class_name SignPost
extends Area2D
## Tutorial sign: shows a speech bubble while the player stands near it.

const SIGN_TEX := preload("res://assets/environments/forgotten_forest/sign.png")

var text: String = ""
var _bubble: PanelContainer
var _label: Label


func _ready() -> void:
	collision_layer = 0
	collision_mask = 2
	monitoring = true
	var shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(90, 80)
	shape.shape = rect
	shape.position = Vector2(0, -40)
	add_child(shape)
	var spr := Sprite2D.new()
	spr.texture = SIGN_TEX
	spr.centered = false
	spr.offset = Vector2(-12, -24)
	spr.z_index = -2
	add_child(spr)
	_bubble = PanelContainer.new()
	_bubble.z_index = 70
	_bubble.visible = false
	_bubble.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_label = Label.new()
	_label.text = text
	_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_bubble.add_child(_label)
	add_child(_bubble)
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	set_process(false)


## Keeps the bubble inside the visible area (signs near the stage edge would
## otherwise push it off screen on wide phones).
func _process(_delta: float) -> void:
	var view := get_viewport().get_canvas_transform().affine_inverse() * get_viewport().get_visible_rect()
	var half := _bubble.size.x / 2.0
	var cx := clampf(global_position.x, view.position.x + half + 4.0, view.end.x - half - 4.0)
	_bubble.position.x = cx - global_position.x - half


func _on_body_entered(body: Node) -> void:
	if body is Player:
		_show(true)


func _on_body_exited(body: Node) -> void:
	if body is Player:
		_show(false)


func _show(on: bool) -> void:
	_bubble.visible = on
	if on:
		_bubble.reset_size()
		_bubble.position = Vector2(-_bubble.size.x / 2.0, -40.0 - _bubble.size.y)
		_bubble.modulate.a = 0.0
		create_tween().tween_property(_bubble, "modulate:a", 1.0, 0.15)
		_process(0.0)
	set_process(on)
