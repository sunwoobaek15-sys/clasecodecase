extends Node2D
## Title screen: scrolling forest, hero illustration, start and settings.

const HERO_ART := preload("res://assets/characters/hero/art/full_art.png")
const TILES_TEX := preload("res://assets/environments/forgotten_forest/tiles.png")
const FIREFLY_TEX := preload("res://assets/environments/forgotten_forest/firefly.png")
const LAYERS := [
	[preload("res://assets/environments/forgotten_forest/bg_sky.png"), Vector2(0.04, 0.0), 0.0],
	[preload("res://assets/environments/forgotten_forest/bg_far.png"), Vector2(0.18, 1.0), -10.0],
	[preload("res://assets/environments/forgotten_forest/bg_mid.png"), Vector2(0.42, 1.0), 0.0],
	[preload("res://assets/environments/forgotten_forest/bg_near.png"), Vector2(0.68, 1.0), -16.0],
]
const GROUND_ROW := 20

var _camera: Camera2D
var _ui: Control
var _settings: PanelContainer
var _hero: TextureRect
var _t: float = 0.0
var _start_button: Button


func _ready() -> void:
	get_tree().paused = false
	FX.reset_time()
	for l in LAYERS:
		var s := ParallaxStrip.new()
		s.texture = l[0]
		s.factor = l[1]
		s.world_y = l[2]
		s.z_index = -100
		add_child(s)
	var ground := TileMapLayer.new()
	ground.tile_set = LevelBuilder.build_tileset(TILES_TEX)
	for x in range(-10, 420):
		ground.set_cell(Vector2i(x, GROUND_ROW), 0, Vector2i(x % 2, 0))
		for y in range(GROUND_ROW + 1, GROUND_ROW + 4):
			ground.set_cell(Vector2i(x, y), 0, Vector2i((x * 7 + y) % 2, 1))
		if (x * 13) % 5 == 0:
			ground.set_cell(Vector2i(x, GROUND_ROW - 1), 0, Vector2i((x * 3) % 8, 3))
	add_child(ground)
	var ff := CPUParticles2D.new()
	ff.texture = FIREFLY_TEX
	ff.amount = 30
	ff.lifetime = 6.0
	ff.preprocess = 6.0
	ff.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	ff.emission_rect_extents = Vector2(460, 180)
	ff.gravity = Vector2(0, -5)
	ff.spread = 180.0
	ff.initial_velocity_min = 4.0
	ff.initial_velocity_max = 12.0
	ff.local_coords = false
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	ff.material = mat
	ff.name = "Fireflies"
	add_child(ff)
	_camera = Camera2D.new()
	_camera.position = Vector2(320, 200)
	add_child(_camera)
	_camera.make_current()
	_build_ui()


func _process(delta: float) -> void:
	_t += delta
	_camera.position.x += 18.0 * delta
	($Fireflies as CPUParticles2D).position = _camera.position
	if _hero:
		_hero.position.y = _hero_y() + roundf(sin(_t * 1.6) * 3.0)


func _hero_y() -> float:
	return get_viewport_rect().size.y - HERO_ART.get_height() - 18.0


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 5
	add_child(layer)
	_ui = Control.new()
	_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(_ui)
	var vp := get_viewport_rect().size
	_hero = TextureRect.new()
	_hero.texture = HERO_ART
	_hero.position = Vector2(vp.x * 0.07, _hero_y())
	_hero.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_ui.add_child(_hero)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	col.position = Vector2(vp.x * 0.42, 40)
	col.size = Vector2(vp.x * 0.52, 300)
	_ui.add_child(col)
	col.add_child(UiKit.label("CHRONICLE", 44, Color(0.86, 0.93, 1.0), true, 6))
	col.add_child(UiKit.label("THE LOST WORLD", 22, UiKit.GOLD, true, 4))
	col.add_child(UiKit.label("크로니클: 잃어버린 세계", 11, UiKit.DIM))
	var spacer := Control.new()
	spacer.custom_minimum_size = Vector2(0, 18)
	col.add_child(spacer)
	_start_button = UiKit.button("게임 시작", _on_start, 170)
	col.add_child(_start_button)
	col.add_child(UiKit.button("설정", _on_settings, 170))
	if not OS.has_feature("mobile") and not OS.has_feature("web"):
		col.add_child(UiKit.button("종료", func() -> void: get_tree().quit(), 170))
	var story := UiKit.label("시간의 핵이 부서져 세계는 떠다니는 섬들로 갈라졌다.\n기억을 잃은 검사가 잊혀진 숲에서 눈을 뜬다...", 11, UiKit.TEXT)
	story.position = Vector2(vp.x * 0.42, vp.y - 70)
	_ui.add_child(story)
	var ver := UiKit.label("v%s  Phase 1 전투 프로토타입" % ProjectSettings.get_setting("application/config/version", "0.1"), 11, UiKit.DIM)
	ver.position = Vector2(vp.x - 230, vp.y - 20)
	_ui.add_child(ver)
	_settings = PanelContainer.new()
	_settings.visible = false
	var sv := VBoxContainer.new()
	sv.add_child(SettingsPanel.new())
	sv.add_child(UiKit.button("닫기", func() -> void: _settings.visible = false, 120))
	_settings.add_child(sv)
	_settings.position = Vector2(vp.x / 2.0 - 150, 70)
	_ui.add_child(_settings)


func _on_start() -> void:
	Game.new_game()


func _on_settings() -> void:
	_settings.visible = not _settings.visible


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"attack") or event.is_action_pressed(&"jump"):
		if not _settings.visible:
			_on_start()
