extends Control
## Mobile touch controls (landscape).
##   left : virtual joystick (floating or fixed, set in the settings)
##   right: attack (large), jump, dodge, skill, ultimate
##
## Multi-touch: every finger is bound to exactly one control when it touches
## down (nearest button within its radius, otherwise the joystick zone) and
## stays bound until it lifts, so buttons never steal each other's fingers and
## the joystick keeps working while attacking.
## Buttons send InputEventActions through Input.parse_input_event, the stick
## uses Input.action_press with analog strength: the player code is identical
## for touch, keyboard and gamepad.
## Sizes follow Game.settings.ui_scale; positions respect the display safe area.

const ICONS := {
	&"attack": preload("res://assets/ui/icons/attack.png"),
	&"jump": preload("res://assets/ui/icons/jump.png"),
	&"dodge": preload("res://assets/ui/icons/dodge.png"),
	&"skill": preload("res://assets/ui/icons/skill.png"),
	&"ultimate": preload("res://assets/ui/icons/ultimate.png"),
}
const LABELS := {&"attack": "공격", &"jump": "점프", &"dodge": "회피", &"skill": "스킬", &"ultimate": "궁극기"}
## Offsets from the bottom-right corner at ui_scale 1.0 and radii.
const LAYOUT := {
	&"attack": [Vector2(-64, -68), 32.0],
	&"jump": [Vector2(-142, -44), 24.0],
	&"dodge": [Vector2(-60, -150), 22.0],
	&"skill": [Vector2(-130, -122), 22.0],
	&"ultimate": [Vector2(-206, -100), 22.0],
}
const STICK_RADIUS := 40.0
const KNOB_RADIUS := 16.0
const DEAD_ZONE := 0.18

var buttons: Dictionary = {}       ## action -> {center, radius, pressed, touch, cooldown, total, enabled}
var stick_base: Vector2 = Vector2.ZERO
var stick_home: Vector2 = Vector2.ZERO
var stick_knob: Vector2 = Vector2.ZERO
var stick_touch: int = -1
var stick_vector: Vector2 = Vector2.ZERO
var _touch_owner: Dictionary = {}  ## touch index -> action or &"stick"
var _scale: float = 1.0
var _margins: Dictionary = {"left": 0.0, "right": 0.0, "top": 0.0, "bottom": 0.0}
var _ult_ready: bool = false
var _mp: float = 0.0
var _skill_cost: float = 15.0
var _time: float = 0.0
var _font: Font = UiKit.FONT


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_to_group(&"touch_controls")
	for action in LAYOUT:
		buttons[action] = {"center": Vector2.ZERO, "radius": 20.0, "pressed": false, "touch": -1,
				"cooldown": 0.0, "total": 1.0, "enabled": true}
	Events.settings_changed.connect(_layout)
	Events.player_cooldown_changed.connect(_on_cooldown)
	Events.player_mana_changed.connect(func(mp: float, _m: float) -> void: _mp = mp)
	Events.player_ult_changed.connect(func(v: float, m: float) -> void: _ult_ready = v >= m)
	Events.player_spawned.connect(_on_player_spawned)
	get_viewport().size_changed.connect(_layout)
	_layout()


func _on_player_spawned(p: Node) -> void:
	var pl := p as Player
	if pl and pl.weapon and pl.weapon.skill:
		_skill_cost = pl.weapon.skill.mp_cost


func _layout() -> void:
	_scale = float(Game.settings.get("ui_scale", 1.0))
	_compute_safe_margins()
	var vp := get_viewport_rect().size
	var corner := Vector2(vp.x - _margins["right"], vp.y - _margins["bottom"])
	for action in LAYOUT:
		var b: Dictionary = buttons[action]
		b["center"] = corner + (LAYOUT[action][0] as Vector2) * _scale
		b["radius"] = float(LAYOUT[action][1]) * _scale
	stick_home = Vector2(_margins["left"] + 22.0 + STICK_RADIUS * _scale * 1.4, vp.y - _margins["bottom"] - 26.0 - STICK_RADIUS * _scale)
	if stick_touch < 0:
		stick_base = stick_home
		stick_knob = stick_home
	queue_redraw()


func _compute_safe_margins() -> void:
	var vp := get_viewport_rect().size
	var win := Vector2(DisplayServer.window_get_size())
	var safe := Rect2(DisplayServer.get_display_safe_area())
	if win.x <= 0.0 or safe.size.x <= 0.0 or not OS.has_feature("mobile"):
		_margins = {"left": 0.0, "right": 0.0, "top": 0.0, "bottom": 0.0}
		return
	var k := vp.x / win.x
	_margins = {
		"left": maxf(0.0, safe.position.x * k),
		"top": maxf(0.0, safe.position.y * k),
		"right": maxf(0.0, (win.x - safe.end.x) * k),
		"bottom": maxf(0.0, (win.y - safe.end.y) * k),
	}


func _process(delta: float) -> void:
	_time += delta
	var dirty := false
	for action in buttons:
		var b: Dictionary = buttons[action]
		var en := true
		if action == &"skill":
			en = _mp >= _skill_cost and float(b["cooldown"]) <= 0.0
		elif action == &"ultimate":
			en = _ult_ready
		if en != b["enabled"]:
			b["enabled"] = en
			dirty = true
	if dirty or _ult_ready or stick_touch >= 0:
		queue_redraw()


func _on_cooldown(action: StringName, remaining: float, total: float) -> void:
	if buttons.has(action):
		buttons[action]["cooldown"] = remaining
		buttons[action]["total"] = maxf(total, 0.01)
		queue_redraw()


# ------------------------------------------------------------------ input ---
func _input(event: InputEvent) -> void:
	if not is_visible_in_tree() or get_tree().paused:
		return
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed:
			if _touch_down(st.index, _to_local(st.position)):
				get_viewport().set_input_as_handled()
		else:
			if _touch_up(st.index):
				get_viewport().set_input_as_handled()
	elif event is InputEventScreenDrag:
		var sd := event as InputEventScreenDrag
		if _touch_owner.get(sd.index, &"") == &"stick":
			_stick_move(_to_local(sd.position))
			get_viewport().set_input_as_handled()


func _to_local(screen_pos: Vector2) -> Vector2:
	return get_global_transform_with_canvas().affine_inverse() * screen_pos


## Returns true if the touch was claimed by a control.
func _touch_down(index: int, pos: Vector2) -> bool:
	var best: StringName = &""
	var best_d := INF
	for action in buttons:
		var b: Dictionary = buttons[action]
		var d := pos.distance_to(b["center"])
		if d <= float(b["radius"]) * 1.25 and d < best_d:
			best = action
			best_d = d
	if best != &"":
		var b: Dictionary = buttons[best]
		if b["touch"] == -1:
			b["touch"] = index
			b["pressed"] = true
			_touch_owner[index] = best
			Game.send_action(best, true)
			Game.vibrate(8)
			queue_redraw()
		return true
	var vp := get_viewport_rect().size
	if stick_touch == -1 and pos.x < vp.x * 0.45 and pos.y > vp.y * 0.28:
		stick_touch = index
		_touch_owner[index] = &"stick"
		if Game.settings.get("joystick_floating", true):
			stick_base = Vector2(maxf(pos.x, _margins["left"] + STICK_RADIUS * _scale), minf(pos.y, vp.y - STICK_RADIUS * _scale))
		else:
			stick_base = stick_home
		_stick_move(pos)
		return true
	return false


func _touch_up(index: int) -> bool:
	if not _touch_owner.has(index):
		return false
	var owner_id: StringName = _touch_owner[index]
	_touch_owner.erase(index)
	if owner_id == &"stick":
		stick_touch = -1
		stick_base = stick_home
		stick_knob = stick_home
		_set_stick(Vector2.ZERO)
	else:
		var b: Dictionary = buttons[owner_id]
		b["touch"] = -1
		b["pressed"] = false
		Game.send_action(owner_id, false)
	queue_redraw()
	return true


func _stick_move(pos: Vector2) -> void:
	var r := STICK_RADIUS * _scale
	var off := pos - stick_base
	if off.length() > r:
		off = off.normalized() * r
	stick_knob = stick_base + off
	var v := off / r
	if v.length() < DEAD_ZONE:
		v = Vector2.ZERO
	_set_stick(v)
	queue_redraw()


func _set_stick(v: Vector2) -> void:
	stick_vector = v
	_axis(&"move_left", &"move_right", v.x)
	_axis(&"move_up", &"move_down", v.y)


func _axis(neg: StringName, pos: StringName, value: float) -> void:
	if value < 0.0:
		Input.action_release(pos)
		Input.action_press(neg, clampf(-value, 0.0, 1.0))
	elif value > 0.0:
		Input.action_release(neg)
		Input.action_press(pos, clampf(value, 0.0, 1.0))
	else:
		Input.action_release(neg)
		Input.action_release(pos)


## Releases everything (pause, scene change).
func release_all() -> void:
	for idx in _touch_owner.keys():
		_touch_up(idx)


func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_EXIT_TREE:
		release_all()


# ------------------------------------------------------------------ draw ---
func _draw() -> void:
	# joystick
	var r := STICK_RADIUS * _scale
	var active := stick_touch >= 0
	draw_circle(stick_base, r, Color(0.05, 0.07, 0.16, 0.38 if active else 0.24))
	draw_arc(stick_base, r, 0.0, TAU, 40, Color(0.75, 0.82, 1.0, 0.55 if active else 0.32), 2.0)
	for i in 4:
		var a := i * PI / 2.0
		var p := stick_base + Vector2(cos(a), sin(a)) * (r - 7.0 * _scale)
		draw_circle(p, 1.5 * _scale, Color(0.8, 0.86, 1.0, 0.4))
	draw_circle(stick_knob, KNOB_RADIUS * _scale, Color(0.55, 0.7, 1.0, 0.75 if active else 0.45))
	draw_arc(stick_knob, KNOB_RADIUS * _scale, 0.0, TAU, 24, Color(1, 1, 1, 0.7), 1.5)
	# buttons
	for action in buttons:
		_draw_button(action, buttons[action])


func _draw_button(action: StringName, b: Dictionary) -> void:
	var c: Vector2 = b["center"]
	var rad: float = b["radius"]
	var pressed: bool = b["pressed"]
	var enabled: bool = b["enabled"]
	var rr := rad * (0.92 if pressed else 1.0)
	var bg := Color(0.06, 0.08, 0.2, 0.62 if pressed else 0.42)
	if action == &"attack":
		bg = Color(0.1, 0.14, 0.34, 0.7 if pressed else 0.5)
	draw_circle(c, rr, bg)
	var ring := Color(0.95, 0.8, 0.45, 0.95) if pressed else Color(0.82, 0.86, 1.0, 0.6 if enabled else 0.25)
	if action == &"ultimate" and _ult_ready:
		var pulse := 0.5 + 0.5 * sin(_time * 6.0)
		draw_arc(c, rr + 3.0 + 2.0 * pulse, 0.0, TAU, 36, Color(1.0, 0.85, 0.35, 0.5 + 0.4 * pulse), 2.0)
		ring = Color(1.0, 0.88, 0.45, 1.0)
	draw_arc(c, rr, 0.0, TAU, 36, ring, 2.0)
	var tex: Texture2D = ICONS[action]
	var icon_scale := maxf(1.0, roundf(rr * 1.1 / tex.get_width() * 2.0) / 2.0)
	var isz := tex.get_size() * icon_scale
	draw_texture_rect(tex, Rect2(c - isz / 2.0, isz), false, Color(1, 1, 1, 1.0 if enabled else 0.35))
	var cd: float = b["cooldown"]
	if cd > 0.0:
		var ratio := clampf(cd / float(b["total"]), 0.0, 1.0)
		var pts := PackedVector2Array([c])
		var steps := 24
		for i in steps + 1:
			var a := -PI / 2.0 + TAU * ratio * float(i) / float(steps)
			pts.append(c + Vector2(cos(a), sin(a)) * rr)
		if pts.size() >= 3:
			draw_colored_polygon(pts, Color(0, 0, 0, 0.5))
		draw_string(_font, c + Vector2(-12, 4), "%.1f" % cd, HORIZONTAL_ALIGNMENT_CENTER, 24, int(11 * clampf(_scale, 1.0, 1.4)), Color(1, 1, 1))
	var lbl: String = LABELS[action]
	draw_string(_font, c + Vector2(-30, rr + 11.0), lbl, HORIZONTAL_ALIGNMENT_CENTER, 60, 11, Color(0.92, 0.92, 0.98, 0.75))
