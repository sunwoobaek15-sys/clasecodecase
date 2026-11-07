extends Node
## Visual feedback helpers (autoload "FX"): hit stop, slow motion, sparks,
## damage numbers, after-images and one-shot sprite effects.
## The stage sets effects_parent; without it effects go to the current scene.

const FONT := preload("res://assets/ui/fonts/Galmuri11-Bold.ttf")
const SPARK_TEX := preload("res://assets/effects/hero/sparkle.png")
const RING_TEX := preload("res://assets/effects/hero/ring.png")

var effects_parent: Node = null
var _time_scale_left: float = 0.0   ## unscaled seconds left
var _time_scale_value: float = 1.0
var _number_settings: Dictionary = {}


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS


func _process(delta: float) -> void:
	# delta is scaled by Engine.time_scale; undo that so hit stop / slow
	# motion last the same wall time and stay deterministic with --fixed-fps.
	if _time_scale_left > 0.0:
		_time_scale_left -= delta / maxf(Engine.time_scale, 0.0001)
		if _time_scale_left <= 0.0:
			_time_scale_left = 0.0
			_time_scale_value = 1.0
			Engine.time_scale = 1.0


func _parent() -> Node:
	if effects_parent != null and is_instance_valid(effects_parent) and effects_parent.is_inside_tree():
		return effects_parent
	return get_tree().current_scene


## Freeze frames on impact (real-time length).
func hit_stop(duration: float) -> void:
	time_scale(0.06, duration)


## Lower time scale for a while; the strongest (lowest) request wins.
func time_scale(scale: float, duration: float) -> void:
	if duration <= 0.0:
		return
	if _time_scale_left > 0.0 and scale > _time_scale_value:
		_time_scale_left = maxf(_time_scale_left, duration * 0.5)
		return
	_time_scale_value = scale
	_time_scale_left = maxf(_time_scale_left, duration)
	Engine.time_scale = scale


func reset_time() -> void:
	_time_scale_left = 0.0
	_time_scale_value = 1.0
	Engine.time_scale = 1.0


func shake(strength: float, duration: float = 0.2) -> void:
	if strength > 0.0 and Game.settings.get("screen_shake", true):
		Events.camera_shake.emit(strength, duration)


func spark(pos: Vector2, color: Color = Color(0.75, 0.9, 1.0), big: bool = false) -> void:
	var p := _parent()
	if p == null:
		return
	var s := Sprite2D.new()
	s.texture = SPARK_TEX if not big else RING_TEX
	s.global_position = pos
	s.modulate = color
	s.z_index = 60
	s.rotation = randf() * TAU
	s.scale = Vector2.ONE * (0.6 if not big else 1.6)
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	s.material = mat
	p.add_child(s)
	var t := s.create_tween().set_parallel(true)
	t.tween_property(s, "scale", s.scale * 1.8, 0.18)
	t.tween_property(s, "modulate:a", 0.0, 0.2)
	t.chain().tween_callback(s.queue_free)


## Plays a texture as a one-shot effect that scales/fades out.
func burst(tex: Texture2D, pos: Vector2, duration: float = 0.4, start_scale: float = 0.6,
		end_scale: float = 1.2, additive: bool = true, flip: bool = false, z: int = 55) -> Sprite2D:
	var p := _parent()
	if p == null or tex == null:
		return null
	var s := Sprite2D.new()
	s.texture = tex
	s.global_position = pos
	s.z_index = z
	s.flip_h = flip
	s.scale = Vector2.ONE * start_scale
	if additive:
		var mat := CanvasItemMaterial.new()
		mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		s.material = mat
	p.add_child(s)
	var t := s.create_tween().set_parallel(true)
	t.tween_property(s, "scale", Vector2.ONE * end_scale, duration).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_property(s, "modulate:a", 0.0, duration).set_delay(duration * 0.4)
	t.chain().tween_callback(s.queue_free)
	return s


func damage_number(pos: Vector2, amount: int, critical: bool = false, on_player: bool = false) -> void:
	if not Game.settings.get("damage_numbers", true):
		return
	var color := Color(1, 1, 1)
	if on_player:
		color = Color(1.0, 0.36, 0.32)
	elif critical:
		color = Color(1.0, 0.86, 0.3)
	_floating_text(str(amount) + ("!" if critical else ""), pos, color, 16 if critical else 11)


func heal_number(pos: Vector2, amount: int) -> void:
	_floating_text("+%d" % amount, pos, Color(0.5, 1.0, 0.55), 11)


func floating_text(text: String, pos: Vector2, color: Color = Color.WHITE, size: int = 11) -> void:
	_floating_text(text, pos, color, size)


func _floating_text(text: String, pos: Vector2, color: Color, size: int) -> void:
	var p := _parent()
	if p == null:
		return
	var l := Label.new()
	l.text = text
	l.label_settings = _label_settings(size, color)
	l.z_index = 80
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.size = Vector2(80, 20)
	l.position = pos + Vector2(-40 + randf_range(-6, 6), -14)
	p.add_child(l)
	var t := l.create_tween()
	t.tween_property(l, "position:y", l.position.y - 18, 0.45).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	t.tween_property(l, "modulate:a", 0.0, 0.25)
	t.tween_callback(l.queue_free)


func _label_settings(size: int, color: Color) -> LabelSettings:
	var key := "%d_%s" % [size, color.to_html()]
	if not _number_settings.has(key):
		var ls := LabelSettings.new()
		ls.font = FONT
		ls.font_size = size
		ls.font_color = color
		ls.outline_size = 4
		ls.outline_color = Color(0.05, 0.04, 0.1)
		_number_settings[key] = ls
	return _number_settings[key]


## Ghost copy of a sprite's current frame (dodge trail, dashes).
func afterimage(src: AnimatedSprite2D, color: Color = Color(0.45, 0.65, 1.0, 0.7), life: float = 0.25) -> void:
	var p := _parent()
	if p == null or src == null or src.sprite_frames == null:
		return
	var tex := src.sprite_frames.get_frame_texture(src.animation, src.frame)
	if tex == null:
		return
	var s := Sprite2D.new()
	s.texture = tex
	s.centered = src.centered
	s.offset = src.offset
	s.global_transform = src.global_transform
	s.modulate = color
	s.z_index = src.z_index - 1
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	s.material = mat
	p.add_child(s)
	var t := s.create_tween()
	t.tween_property(s, "modulate:a", 0.0, life)
	t.tween_callback(s.queue_free)
