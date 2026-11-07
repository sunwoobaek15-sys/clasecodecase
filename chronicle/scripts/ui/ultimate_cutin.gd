extends Control
## Ultimate cut-in: the world freezes, the hero illustration sweeps across a
## dark band with the skill name, then the game resumes.

const ART := preload("res://assets/characters/hero/art/ult_cutin.png")
const DURATION := 0.8

var active: bool = false
var _band: ColorRect
var _streak: ColorRect
var _art: TextureRect
var _name: Label


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	add_to_group(&"modal_ui")
	_band = ColorRect.new()
	_band.color = Color(0.02, 0.04, 0.14, 0.85)
	_band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_band)
	_streak = ColorRect.new()
	_streak.color = Color(0.5, 0.75, 1.0, 0.9)
	_streak.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_streak)
	_art = TextureRect.new()
	_art.texture = ART
	_art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_art)
	_name = UiKit.label("청월강림", 33, Color(0.85, 0.93, 1.0), true, 5)
	add_child(_name)
	Events.ultimate_cutin_requested.connect(play)


func play() -> void:
	if active:
		return
	active = true
	visible = true
	var vp := get_viewport_rect().size
	var band_h := ART.get_height() + 16.0
	var y := vp.y / 2.0 - band_h / 2.0 - 20.0
	_band.position = Vector2(0, y)
	_band.size = Vector2(vp.x, band_h)
	_streak.position = Vector2(-vp.x, y + band_h - 4)
	_streak.size = Vector2(vp.x, 2)
	_art.position = Vector2(-ART.get_width(), y + 8)
	_name.position = Vector2(vp.x, y + band_h - 46)
	get_tree().paused = true
	var t := create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS).set_ignore_time_scale(true)
	t.set_parallel(true)
	t.tween_property(_art, "position:x", vp.x * 0.16, 0.22).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	t.tween_property(_streak, "position:x", 0.0, 0.25)
	t.tween_property(_name, "position:x", vp.x * 0.16 + ART.get_width() + 10.0, 0.25).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	t.chain().tween_interval(DURATION - 0.4)
	t.chain().tween_property(self, "modulate:a", 0.0, 0.15)
	await t.finished
	visible = false
	modulate.a = 1.0
	active = false
	get_tree().paused = false
	Events.ultimate_cutin_finished.emit()
