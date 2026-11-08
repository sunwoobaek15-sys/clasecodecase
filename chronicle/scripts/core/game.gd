extends Node
## Global game state (autoload "Game").
##
## * registers the input actions used by keyboard, gamepad and the touch UI
## * user settings (UI scale, joystick mode, ...) stored in user://settings.cfg
## * statistics of the current attempt and the active checkpoint
## * scene changes with a fade
## * command line switches for automated runs:  -- --bot [--screenshots=DIR]

const SETTINGS_PATH := "user://settings.cfg"
const TITLE_SCENE := "res://scenes/boot/title.tscn"
const STAGE_SCENE := "res://scenes/world/forest_stage.tscn"
const VILLAGE_SCENE := "res://scenes/village/village.tscn"
## Stage id -> scene. Regions 2 and 3 are listed on the world map as locked.
const STAGES := {"forest_1": STAGE_SCENE, "clock_1": "res://scenes/world/clock_stage.tscn"}

## Keyboard bindings (physical keys) for desktop testing.
const KEY_BINDINGS := {
	&"move_left": [KEY_A, KEY_LEFT],
	&"move_right": [KEY_D, KEY_RIGHT],
	&"move_up": [KEY_W, KEY_UP],
	&"move_down": [KEY_S, KEY_DOWN],
	&"jump": [KEY_SPACE, KEY_K],
	&"attack": [KEY_J, KEY_Z],
	&"dodge": [KEY_L, KEY_X, KEY_SHIFT],
	&"skill": [KEY_U, KEY_C],
	&"ultimate": [KEY_I, KEY_V],
	&"pause": [KEY_ESCAPE, KEY_P],
	&"use_potion": [KEY_Q, KEY_R],
	&"interact": [KEY_E, KEY_F],
}
const PAD_BUTTONS := {
	&"jump": [JOY_BUTTON_A],
	&"attack": [JOY_BUTTON_X],
	&"dodge": [JOY_BUTTON_B, JOY_BUTTON_RIGHT_SHOULDER],
	&"skill": [JOY_BUTTON_Y],
	&"ultimate": [JOY_BUTTON_LEFT_SHOULDER],
	&"pause": [JOY_BUTTON_START],
	&"use_potion": [JOY_BUTTON_DPAD_UP],
	&"interact": [JOY_BUTTON_DPAD_DOWN],
}
const PAD_AXES := {
	&"move_left": [JOY_AXIS_LEFT_X, -1.0],
	&"move_right": [JOY_AXIS_LEFT_X, 1.0],
	&"move_up": [JOY_AXIS_LEFT_Y, -1.0],
	&"move_down": [JOY_AXIS_LEFT_Y, 1.0],
}

const DEFAULT_SETTINGS := {
	"ui_scale": 1.0,          # touch button / joystick size multiplier (0.8 - 1.4)
	"joystick_floating": true, # joystick appears where the left thumb lands
	"screen_shake": true,
	"damage_numbers": true,
	"vibration": true,
}

var settings: Dictionary = DEFAULT_SETTINGS.duplicate()
var checkpoint_id: int = -1   # -1 = stage start
var current_stage_id: String = "forest_1"
var stage_title: String = ""
var location: String = "stage"   # "stage" or "village" (where Continue starts)
var run: Dictionary = {}
var bot_mode := false
var screenshot_dir := ""
var cmd_options: Dictionary = {}

var _fade_layer: CanvasLayer
var _fade_rect: ColorRect
var _changing := false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	register_input_actions()
	load_settings()
	_parse_command_line()
	_build_fade_layer()
	reset_run()


func _process(delta: float) -> void:
	if not get_tree().paused:
		run["time"] = float(run.get("time", 0.0)) + delta


# ------------------------------------------------------------------ input ---
static func register_input_actions() -> void:
	for action in KEY_BINDINGS:
		if not InputMap.has_action(action):
			InputMap.add_action(action, 0.25)
		for key in KEY_BINDINGS[action]:
			var ev := InputEventKey.new()
			ev.physical_keycode = key
			if not InputMap.action_has_event(action, ev):
				InputMap.action_add_event(action, ev)
	for action in PAD_BUTTONS:
		for button in PAD_BUTTONS[action]:
			var jb := InputEventJoypadButton.new()
			jb.button_index = button
			if not InputMap.action_has_event(action, jb):
				InputMap.action_add_event(action, jb)
	for action in PAD_AXES:
		var ja := InputEventJoypadMotion.new()
		ja.axis = PAD_AXES[action][0]
		ja.axis_value = PAD_AXES[action][1]
		if not InputMap.action_has_event(action, ja):
			InputMap.action_add_event(action, ja)


## Sends an action press/release through the normal input pipeline.
## Used by the touch controls and the autoplay bot so that the player code
## sees exactly the same events as with a keyboard or gamepad.
static func send_action(action: StringName, pressed: bool, strength: float = 1.0) -> void:
	var ev := InputEventAction.new()
	ev.action = action
	ev.pressed = pressed
	ev.strength = strength if pressed else 0.0
	Input.parse_input_event(ev)


# --------------------------------------------------------------- settings ---
func load_settings() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SETTINGS_PATH) == OK:
		for key in DEFAULT_SETTINGS:
			settings[key] = cfg.get_value("settings", key, DEFAULT_SETTINGS[key])
	settings["ui_scale"] = clampf(float(settings["ui_scale"]), 0.8, 1.4)


func save_settings() -> void:
	var cfg := ConfigFile.new()
	for key in settings:
		cfg.set_value("settings", key, settings[key])
	var err := cfg.save(SETTINGS_PATH)
	if err != OK:
		push_warning("settings could not be saved: %s" % error_string(err))
	Events.settings_changed.emit()


func set_setting(key: String, value: Variant) -> void:
	settings[key] = value
	save_settings()


func vibrate(ms: int) -> void:
	if settings.get("vibration", true) and OS.has_feature("mobile"):
		Input.vibrate_handheld(ms)


# -------------------------------------------------------------------- run ---
func reset_run() -> void:
	run = {"time": 0.0, "damage_dealt": 0, "damage_taken": 0, "kills": 0, "deaths": 0, "max_combo": 0,
			"stage_id": current_stage_id}


## Clears all persistent progress (hero, village, pets, codex, quests).
func reset_progress(starting_kit: bool = true) -> void:
	Profile.reset(starting_kit)
	Pets.reset()
	Village.reset()
	Codex.reset()
	Quests.reset()


func new_game() -> void:
	checkpoint_id = -1
	current_stage_id = "forest_1"
	location = "stage"
	reset_progress(true)
	reset_run()
	SaveSystem.save_game()
	change_scene(STAGE_SCENE)


## Loads the save file and returns to the village or the saved checkpoint.
func continue_game() -> bool:
	if not SaveSystem.load_game():
		Events.toast.emit("저장 데이터를 불러오지 못했어요.")
		return false
	reset_run()
	if location == "village" and Village.arrived:
		change_scene(VILLAGE_SCENE)
	else:
		change_scene(str(STAGES.get(current_stage_id, STAGE_SCENE)))
	return true


func start_stage(stage_id: String) -> void:
	if not STAGES.has(stage_id):
		return
	current_stage_id = stage_id
	checkpoint_id = -1
	location = "stage"
	reset_run()
	SaveSystem.save_game()
	change_scene(str(STAGES[stage_id]))


func go_to_village() -> void:
	checkpoint_id = -1
	location = "village"
	Village.arrived = true
	SaveSystem.save_game()
	change_scene(VILLAGE_SCENE)


func retry_from_checkpoint() -> void:
	run["deaths"] = int(run.get("deaths", 0)) + 1
	change_scene(str(STAGES.get(current_stage_id, STAGE_SCENE)))


func go_to_title() -> void:
	SaveSystem.save_game()
	change_scene(TITLE_SCENE)


func add_stat(key: String, amount: int) -> void:
	run[key] = int(run.get(key, 0)) + amount


# ----------------------------------------------------------- scene change ---
func _build_fade_layer() -> void:
	_fade_layer = CanvasLayer.new()
	_fade_layer.layer = 100
	add_child(_fade_layer)
	_fade_rect = ColorRect.new()
	_fade_rect.color = Color(0.02, 0.03, 0.05, 0.0)
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_fade_rect.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fade_layer.add_child(_fade_rect)


func change_scene(path: String) -> void:
	if _changing:
		return
	_changing = true
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_STOP
	var t := create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS).set_ignore_time_scale(true)
	t.tween_property(_fade_rect, "color:a", 1.0, 0.25)
	await t.finished
	get_tree().paused = false
	Engine.time_scale = 1.0
	var err := get_tree().change_scene_to_file(path)
	if err != OK:
		push_error("change_scene_to_file(%s) failed: %s" % [path, error_string(err)])
	await get_tree().process_frame
	await get_tree().process_frame
	var t2 := create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS).set_ignore_time_scale(true)
	t2.tween_property(_fade_rect, "color:a", 0.0, 0.3)
	await t2.finished
	_fade_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_changing = false


func is_changing_scene() -> bool:
	return _changing


# ------------------------------------------------------------ command line ---
func _parse_command_line() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--"):
			var parts := arg.substr(2).split("=", true, 1)
			cmd_options[parts[0]] = parts[1] if parts.size() > 1 else "true"
	bot_mode = cmd_options.has("bot")
	screenshot_dir = str(cmd_options.get("screenshots", ""))
	if bot_mode:
		var bot := preload("res://scripts/core/autoplay_bot.gd").new()
		bot.name = "AutoplayBot"
		add_child(bot)
