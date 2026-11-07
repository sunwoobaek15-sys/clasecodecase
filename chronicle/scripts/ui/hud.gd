extends Control
## In-game HUD: portrait, HP / MP / ultimate gauges, boss bar, combo counter,
## toast messages, stage title, boss intro banner and the pause button.
## Everything is driven by Events, the HUD never touches gameplay objects.

const PORTRAIT := preload("res://assets/characters/hero/art/portrait_neutral.png")
const PORTRAIT_HURT := preload("res://assets/characters/hero/art/portrait_hurt.png")
const BOSS_ART := preload("res://assets/bosses/verdan/art/full_art.png")
const PAUSE_ICON := preload("res://assets/ui/icons/pause.png")

var hp: float = 1.0
var max_hp: float = 1.0
var mp: float = 0.0
var max_mp: float = 1.0
var ult: float = 0.0
var ult_max: float = 100.0
var _hp_trail: float = 1.0
var boss_visible: bool = false
var boss_hp: float = 1.0
var boss_max: float = 1.0
var boss_name: String = "숲의 수호자 베르단"
var _boss_trail: float = 1.0
var _boss_phase: int = 1
var _time: float = 0.0
var _hurt_face: float = 0.0

var _portrait: TextureRect
var _hp_label: Label
var _ult_label: Label
var _boss_label: Label
var _combo_label: Label
var _combo_timer: float = 0.0
var _toast_box: VBoxContainer
var _title: Label
var _banner: Control
var _pause_button: TextureButton
var _left: float = 0.0
var _right: float = 0.0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	_compute_margins()
	_portrait = TextureRect.new()
	_portrait.texture = PORTRAIT
	_portrait.position = Vector2(_left + 8, 6)
	_portrait.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_portrait)
	_hp_label = UiKit.label("", 11)
	_hp_label.position = Vector2(_left + 196, 4)
	add_child(_hp_label)
	_ult_label = UiKit.label("궁극기 READY", 11, UiKit.GOLD, true)
	_ult_label.position = Vector2(_left + 178, 28)
	_ult_label.visible = false
	add_child(_ult_label)
	_boss_label = UiKit.label(boss_name, 11, Color(1.0, 0.86, 0.75), true)
	_boss_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_boss_label.visible = false
	add_child(_boss_label)
	_combo_label = UiKit.label("", 22, UiKit.GOLD, true, 4)
	_combo_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_combo_label.modulate.a = 0.0
	add_child(_combo_label)
	_toast_box = VBoxContainer.new()
	_toast_box.alignment = BoxContainer.ALIGNMENT_BEGIN
	_toast_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	# Toasts sit above the pause/character menus and keep animating while paused.
	var toast_layer := CanvasLayer.new()
	toast_layer.layer = 25
	toast_layer.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(toast_layer)
	toast_layer.add_child(_toast_box)
	_title = UiKit.label("1-1  잊혀진 숲", 22, Color(0.85, 1.0, 0.85), true, 4)
	_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_title)
	_pause_button = TextureButton.new()
	_pause_button.texture_normal = PAUSE_ICON
	_pause_button.focus_mode = Control.FOCUS_NONE
	_pause_button.custom_minimum_size = Vector2(32, 32)
	_pause_button.stretch_mode = TextureButton.STRETCH_KEEP_CENTERED
	_pause_button.ignore_texture_size = true
	_pause_button.pressed.connect(func() -> void: Events.pause_requested.emit())
	add_child(_pause_button)
	_build_banner()
	Events.player_health_changed.connect(_on_hp)
	Events.player_mana_changed.connect(_on_mp)
	Events.player_ult_changed.connect(_on_ult)
	Events.player_combo_changed.connect(_on_combo)
	Events.boss_intro_started.connect(_on_boss_intro)
	Events.boss_started.connect(_on_boss_started)
	Events.boss_health_changed.connect(_on_boss_hp)
	Events.boss_phase_changed.connect(_on_boss_phase)
	Events.boss_defeated.connect(_on_boss_defeated)
	Events.toast.connect(show_toast)
	get_viewport().size_changed.connect(_relayout)
	_relayout()
	var pl := get_tree().get_first_node_in_group(&"player") as Player
	if pl != null:
		_on_hp(pl.hp, pl.max_hp)
		_on_mp(pl.mp, pl.stats.max_mp)
		_on_ult(pl.ult, pl.stats.ult_max)
		_hp_trail = 1.0
	var t := create_tween()
	_title.modulate.a = 0.0
	t.tween_property(_title, "modulate:a", 1.0, 0.5)
	t.tween_interval(1.6)
	t.tween_property(_title, "modulate:a", 0.0, 0.6)


func _compute_margins() -> void:
	_left = 0.0
	_right = 0.0
	if OS.has_feature("mobile"):
		var win := Vector2(DisplayServer.window_get_size())
		var safe := Rect2(DisplayServer.get_display_safe_area())
		if win.x > 0.0 and safe.size.x > 0.0:
			var k := get_viewport_rect().size.x / win.x
			_left = safe.position.x * k
			_right = (win.x - safe.end.x) * k


func _relayout() -> void:
	_compute_margins()
	var vp := get_viewport_rect().size
	_portrait.position = Vector2(_left + 8, 6)
	_hp_label.position = Vector2(_left + 196, 4)
	_ult_label.position = Vector2(_left + 178, 28)
	_boss_label.position = Vector2(vp.x / 2.0 - 150, 4)
	_boss_label.size = Vector2(300, 16)
	_combo_label.position = Vector2(vp.x - _right - 170, 64)
	_combo_label.size = Vector2(150, 28)
	_toast_box.position = Vector2(vp.x / 2.0 - 160, 78)
	_toast_box.size = Vector2(320, 80)
	_title.position = Vector2(vp.x / 2.0 - 200, 120)
	_title.size = Vector2(400, 30)
	_pause_button.position = Vector2(vp.x - _right - 40, 4)
	_banner.size = Vector2(vp.x, 120)
	_banner.position = Vector2(0, vp.y / 2.0 - 70)
	queue_redraw()


func _process(delta: float) -> void:
	_time += delta
	var target := hp / maxf(max_hp, 1.0)
	_hp_trail = move_toward(_hp_trail, target, delta * (0.35 if _hp_trail > target else 2.0))
	var bt := boss_hp / maxf(boss_max, 1.0)
	_boss_trail = move_toward(_boss_trail, bt, delta * (0.25 if _boss_trail > bt else 2.0))
	if _combo_timer > 0.0:
		_combo_timer -= delta
		if _combo_timer <= 0.6:
			_combo_label.modulate.a = maxf(0.0, _combo_timer / 0.6)
	if _hurt_face > 0.0:
		_hurt_face -= delta
		if _hurt_face <= 0.0:
			_portrait.texture = PORTRAIT
	_ult_label.visible = ult >= ult_max
	if _ult_label.visible:
		_ult_label.modulate.a = 0.6 + 0.4 * sin(_time * 6.0)
	queue_redraw()


func _on_hp(value: int, maximum: int) -> void:
	if value < hp and value > 0:
		_portrait.texture = PORTRAIT_HURT
		_hurt_face = 0.6
	hp = value
	max_hp = maximum
	_hp_label.text = "%d/%d" % [value, maximum]


func _on_mp(value: float, maximum: float) -> void:
	mp = value
	max_mp = maximum


func _on_boss_phase(p: int) -> void:
	_boss_phase = p


func _on_boss_defeated(_b: Node) -> void:
	boss_visible = false
	_boss_label.visible = false


func _on_ult(value: float, maximum: float) -> void:
	ult = value
	ult_max = maximum


func _on_combo(hits: int) -> void:
	if hits < 2:
		return
	_combo_label.text = "%d HIT" % hits
	_combo_label.modulate.a = 1.0
	_combo_timer = 2.0
	_combo_label.pivot_offset = _combo_label.size
	_combo_label.scale = Vector2(1.25, 1.25)
	create_tween().tween_property(_combo_label, "scale", Vector2.ONE, 0.12)


func show_toast(text: String) -> void:
	var p := PanelContainer.new()
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := UiKit.label(text, 11)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	p.add_child(l)
	_toast_box.add_child(p)
	p.modulate.a = 0.0
	var t := p.create_tween()
	t.tween_property(p, "modulate:a", 1.0, 0.2)
	t.tween_interval(2.0)
	t.tween_property(p, "modulate:a", 0.0, 0.4)
	t.tween_callback(p.queue_free)


func _build_banner() -> void:
	_banner = Control.new()
	_banner.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.visible = false
	add_child(_banner)
	var band := ColorRect.new()
	band.color = Color(0.12, 0.02, 0.04, 0.72)
	band.set_anchors_preset(Control.PRESET_FULL_RECT)
	band.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.add_child(band)
	var art := TextureRect.new()
	art.name = "Art"
	art.texture = BOSS_ART
	art.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_banner.add_child(art)
	var warn := UiKit.label("WARNING · BOSS", 11, Color(1.0, 0.4, 0.35), true)
	warn.name = "Warn"
	_banner.add_child(warn)
	var name1 := UiKit.label("숲의 수호자", 11, Color(0.85, 1.0, 0.8), false)
	name1.name = "Sub"
	_banner.add_child(name1)
	var name2 := UiKit.label("베르단", 33, Color(0.92, 1.0, 0.86), true, 5)
	name2.name = "Name"
	_banner.add_child(name2)


func _on_boss_intro(_boss: Node) -> void:
	var vp := get_viewport_rect().size
	_banner.visible = true
	_banner.modulate.a = 0.0
	var art := _banner.get_node("Art") as TextureRect
	art.position = Vector2(vp.x + 20, 120 - BOSS_ART.get_height() + 10)
	(_banner.get_node("Warn") as Label).position = Vector2(vp.x * 0.12, 14)
	(_banner.get_node("Sub") as Label).position = Vector2(vp.x * 0.12, 40)
	(_banner.get_node("Name") as Label).position = Vector2(vp.x * 0.12, 56)
	var t := create_tween()
	t.tween_property(_banner, "modulate:a", 1.0, 0.25)
	t.parallel().tween_property(art, "position:x", vp.x - BOSS_ART.get_width() - 30, 0.5).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	t.tween_interval(1.7)
	t.tween_property(_banner, "modulate:a", 0.0, 0.4)
	t.tween_callback(func() -> void: _banner.visible = false)


func _on_boss_started(_boss: Node) -> void:
	boss_visible = true
	_boss_label.visible = true
	_boss_phase = 1
	queue_redraw()


func _on_boss_hp(value: int, maximum: int) -> void:
	boss_hp = value
	boss_max = maximum


# ------------------------------------------------------------------ draw ---
func _bar(rect: Rect2, ratio: float, fill: Color, trail: float = -1.0, back: Color = Color(0.1, 0.06, 0.12)) -> void:
	draw_rect(rect.grow(1.0), Color(0.02, 0.02, 0.05, 0.9))
	draw_rect(rect, back)
	if trail > ratio:
		draw_rect(Rect2(rect.position, Vector2(rect.size.x * clampf(trail, 0.0, 1.0), rect.size.y)), Color(1, 0.95, 0.85, 0.85))
	draw_rect(Rect2(rect.position, Vector2(rect.size.x * clampf(ratio, 0.0, 1.0), rect.size.y)), fill)
	draw_rect(Rect2(rect.position, Vector2(rect.size.x * clampf(ratio, 0.0, 1.0), 1.0)), fill.lightened(0.35))


func _draw() -> void:
	var vp := get_viewport_rect().size
	var x0 := _left + 8.0
	draw_rect(Rect2(x0 - 2, 4, PORTRAIT.get_width() + 4, PORTRAIT.get_height() + 4), Color(0.82, 0.67, 0.36))
	draw_rect(Rect2(x0 - 1, 5, PORTRAIT.get_width() + 2, PORTRAIT.get_height() + 2), Color(0.04, 0.05, 0.12))
	var bx := _left + 64.0
	_bar(Rect2(bx, 8, 128, 9), hp / maxf(max_hp, 1.0), Color(0.9, 0.26, 0.28), _hp_trail)
	_bar(Rect2(bx, 21, 110, 6), mp / maxf(max_mp, 1.0), Color(0.3, 0.55, 1.0))
	var ur := ult / maxf(ult_max, 1.0)
	var ucol := Color(0.95, 0.78, 0.3) if ur < 1.0 else Color(1.0, 0.9, 0.45).lerp(Color(1, 1, 1), 0.3 + 0.3 * sin(_time * 8.0))
	_bar(Rect2(bx, 31, 110, 5), ur, ucol)
	# level + EXP (Phase 2)
	var lv_rect := Rect2(x0 - 2, 4 + PORTRAIT.get_height() + 6, PORTRAIT.get_width() + 4, 3)
	_bar(lv_rect, float(Profile.xp) / float(maxi(1, Profile.exp_to_next(Profile.level))), Color(0.55, 0.9, 1.0))
	# drawn below the EXP bar: the portrait (a child control) covers anything drawn on it
	var lv_y := lv_rect.end.y + 11.0
	var lv_text := "Lv.%d" % Profile.level
	draw_string_outline(UiKit.FONT_BOLD, Vector2(x0, lv_y), lv_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, UiKit.OUTLINE)
	draw_string(UiKit.FONT_BOLD, Vector2(x0, lv_y), lv_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.92, 0.6))
	if Profile.skill_points > 0:
		var sp_x := x0 + UiKit.FONT_BOLD.get_string_size(lv_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x + 5.0
		var sp_col := Color(0.6, 1.0, 0.7, 0.6 + 0.4 * sin(_time * 5.0))
		draw_string_outline(UiKit.FONT, Vector2(sp_x, lv_y), "SP", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, Color(UiKit.OUTLINE, sp_col.a))
		draw_string(UiKit.FONT, Vector2(sp_x, lv_y), "SP", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, sp_col)
	if boss_visible:
		var w := minf(300.0, vp.x * 0.5)
		var r := Rect2(vp.x / 2.0 - w / 2.0, 22, w, 8)
		_bar(r, boss_hp / maxf(boss_max, 1.0), Color(0.86, 0.2, 0.18) if _boss_phase == 1 else Color(0.95, 0.45, 0.1), _boss_trail)
		var mid := r.position.x + r.size.x * 0.5
		draw_rect(Rect2(mid, r.position.y - 2, 1, r.size.y + 4), Color(1, 0.9, 0.6, 0.9))
