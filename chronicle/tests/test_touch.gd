extends TestCase
## Touch controls: buttons, analog joystick, multi-touch, layout at all scales.

var _saved_scale: float = 1.0


func before_each() -> void:
	_saved_scale = float(Game.settings.get("ui_scale", 1.0))


func after_each() -> void:
	Game.settings["ui_scale"] = _saved_scale


func _controls() -> Control:
	var layer := CanvasLayer.new()
	add(layer)
	var tc := (load("res://scenes/ui/touch_controls.tscn") as PackedScene).instantiate() as Control
	layer.add_child(tc)
	return tc


## Converts a viewport position to window coordinates (what the OS sends).
func _screen(tc: Control, pos: Vector2) -> Vector2:
	return tc.get_viewport().get_final_transform() * pos


func _touch(tc: Control, index: int, pos: Vector2, pressed: bool) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = index
	ev.position = _screen(tc, pos)
	ev.pressed = pressed
	Input.parse_input_event(ev)


func _drag(tc: Control, index: int, pos: Vector2) -> void:
	var ev := InputEventScreenDrag.new()
	ev.index = index
	ev.position = _screen(tc, pos)
	Input.parse_input_event(ev)


func test_button_press_and_release() -> void:
	var tc := _controls()
	await frames(2)
	for action in [&"attack", &"jump", &"dodge", &"skill", &"ultimate"]:
		var c: Vector2 = tc.buttons[action]["center"]
		_touch(tc, 0, c, true)
		await frames(2)
		check(Input.is_action_pressed(action), "%s pressed by touch" % action)
		_touch(tc, 0, c, false)
		await frames(2)
		check(not Input.is_action_pressed(action), "%s released" % action)


func test_joystick_is_analog() -> void:
	var tc := _controls()
	await frames(2)
	var base: Vector2 = tc.stick_home
	var r: float = tc.STICK_RADIUS * tc._scale
	_touch(tc, 1, base, true)
	await frames(1)
	_drag(tc, 1, tc.stick_base + Vector2(r, 0))
	await frames(2)
	check(Input.get_action_strength(&"move_right") > 0.9, "full tilt right")
	_drag(tc, 1, tc.stick_base + Vector2(-r * 0.4, 0))
	await frames(2)
	check_between(Input.get_action_strength(&"move_left"), 0.3, 0.5, "light tilt left (walk)")
	check_eq(Input.get_action_strength(&"move_right"), 0.0, "opposite direction released")
	_drag(tc, 1, tc.stick_base + Vector2(r * 0.1, 0))
	await frames(2)
	check_eq(Input.get_action_strength(&"move_left") + Input.get_action_strength(&"move_right"), 0.0, "dead zone")
	_touch(tc, 1, tc.stick_base, false)
	await frames(2)
	check(not Input.is_action_pressed(&"move_left") and not Input.is_action_pressed(&"move_right"), "released")


func test_multitouch_without_interference() -> void:
	var tc := _controls()
	await frames(2)
	var r: float = tc.STICK_RADIUS * tc._scale
	_touch(tc, 0, tc.stick_home, true)
	await frames(1)
	_drag(tc, 0, tc.stick_base + Vector2(r, 0))
	var atk: Vector2 = tc.buttons[&"attack"]["center"]
	_touch(tc, 1, atk, true)
	await frames(2)
	check(Input.is_action_pressed(&"move_right"), "moving")
	check(Input.is_action_pressed(&"attack"), "attacking at the same time")
	var jump: Vector2 = tc.buttons[&"jump"]["center"]
	_touch(tc, 2, jump, true)
	await frames(2)
	check(Input.is_action_pressed(&"jump"), "third finger jumps")
	_touch(tc, 1, atk, false)
	await frames(2)
	check(not Input.is_action_pressed(&"attack"), "attack released")
	check(Input.is_action_pressed(&"move_right"), "joystick unaffected")
	check(Input.is_action_pressed(&"jump"), "jump unaffected")
	# a finger that slides off its button keeps the button and never presses another
	_drag(tc, 2, atk)
	await frames(2)
	check(not Input.is_action_pressed(&"attack"), "sliding onto another button does not press it")
	_touch(tc, 2, atk, false)
	_touch(tc, 0, tc.stick_base, false)
	await frames(2)
	check(not Input.is_action_pressed(&"jump") and not Input.is_action_pressed(&"move_right"), "all released")


func test_empty_area_is_not_claimed() -> void:
	var tc := _controls()
	await frames(2)
	var vp := tc.get_viewport_rect().size
	_touch(tc, 0, Vector2(vp.x * 0.62, vp.y * 0.3), true)
	await frames(2)
	for action in [&"attack", &"jump", &"dodge", &"skill", &"ultimate", &"move_left", &"move_right"]:
		check(not Input.is_action_pressed(action), "%s not triggered by an empty-area touch" % action)
	_touch(tc, 0, Vector2(vp.x * 0.62, vp.y * 0.3), false)


func test_layout_fits_at_every_ui_scale() -> void:
	var tc := _controls()
	await frames(2)
	var vp := tc.get_viewport_rect().size
	for s in [0.8, 1.0, 1.2, 1.4]:
		Game.settings["ui_scale"] = s
		tc._layout()
		var keys: Array = tc.buttons.keys()
		for i in keys.size():
			var a: Dictionary = tc.buttons[keys[i]]
			var c: Vector2 = a["center"]
			var r: float = a["radius"]
			check(c.x - r >= 0.0 and c.y - r >= 0.0 and c.x + r <= vp.x and c.y + r <= vp.y,
					"%s inside the screen at scale %.1f" % [keys[i], s])
			for j in range(i + 1, keys.size()):
				var b: Dictionary = tc.buttons[keys[j]]
				var d := c.distance_to(b["center"])
				check(d >= r + float(b["radius"]) + 4.0, "%s/%s do not overlap at scale %.1f" % [keys[i], keys[j], s])
		var stick_r: float = tc.STICK_RADIUS * s
		check(tc.stick_home.x - stick_r >= 0.0 and tc.stick_home.y + stick_r <= vp.y, "joystick inside the screen at %.1f" % s)
		check(tc.stick_home.x + stick_r < (tc.buttons[&"ultimate"]["center"] as Vector2).x - float(tc.buttons[&"ultimate"]["radius"]),
				"joystick and buttons do not overlap at %.1f" % s)
