extends Node2D
## Stage 1-1 '잊혀진 숲' (Forgotten Forest).
## Builds the level from data/levels/forest_stage_01.txt, spawns the player,
## slimes, signs, checkpoint and Verdan, runs the boss arena and the
## stage-clear / game-over flow. All UI is added as separate scenes.

const LEVEL_PATH := "res://data/levels/forest_stage_01.txt"
const TILES_TEX := preload("res://assets/environments/forgotten_forest/tiles.png")
const PLAYER_SCENE := preload("res://scenes/player/player.tscn")
const SLIME_SCENE := preload("res://scenes/enemies/slime.tscn")
const VERDAN_SCENE := preload("res://scenes/bosses/verdan.tscn")
const TIME_CORE_SCENE := preload("res://scenes/world/time_core.tscn")
const HUD_SCENE := preload("res://scenes/ui/hud.tscn")
const CONTROLS_SCENE := preload("res://scenes/ui/touch_controls.tscn")
const PAUSE_SCENE := preload("res://scenes/ui/pause_menu.tscn")
const RESULT_SCENE := preload("res://scenes/ui/result_screen.tscn")
const CUTIN_SCENE := preload("res://scenes/ui/ultimate_cutin.tscn")
const WALL_TEX := preload("res://assets/environments/forgotten_forest/arena_wall.png")
const FIREFLY_TEX := preload("res://assets/environments/forgotten_forest/firefly.png")
const LEAF_TEX := preload("res://assets/environments/forgotten_forest/leaf.png")
const BG_SKY := preload("res://assets/environments/forgotten_forest/bg_sky.png")
const BG_FAR := preload("res://assets/environments/forgotten_forest/bg_far.png")
const BG_MID := preload("res://assets/environments/forgotten_forest/bg_mid.png")
const BG_NEAR := preload("res://assets/environments/forgotten_forest/bg_near.png")
const FG_VINES := preload("res://assets/environments/forgotten_forest/fg_vines.png")
const PROP_TEXTURES: Array[Texture2D] = [
	preload("res://assets/bosses/verdan/art/part_bush.png"),
	preload("res://assets/bosses/verdan/art/part_rock.png"),
	preload("res://assets/bosses/verdan/art/part_rock2.png"),
	preload("res://assets/bosses/verdan/art/part_bush.png"),
]
const TREE_TEX := preload("res://assets/bosses/verdan/art/part_tree.png")

var level: LevelBuilder
var player: Player
var boss: Verdan
var arena_left: float = 0.0
var arena_right: float = 0.0
var ground_y: float = 320.0
var boss_fight_started: bool = false
var stage_cleared: bool = false
var _gate: StaticBody2D
var _particles: Array[CPUParticles2D] = []

@onready var background: Node2D = $Background
@onready var ground: TileMapLayer = $Level/Ground
@onready var decor: TileMapLayer = $Level/Decor
@onready var props: Node2D = $Props
@onready var enemies: Node2D = $Enemies
@onready var actors: Node2D = $Actors
@onready var effects: Node2D = $Effects
@onready var foreground: Node2D = $Foreground
@onready var camera: CameraRig = $Camera


func _ready() -> void:
	FX.effects_parent = effects
	FX.reset_time()
	level = LevelBuilder.load_map(LEVEL_PATH)
	var ts := LevelBuilder.build_tileset(TILES_TEX)
	ground.tile_set = ts
	decor.tile_set = ts
	level.paint(ground, decor)
	ground_y = level.first_marker("P").y
	_build_background()
	_build_props()
	_spawn_actors()
	_setup_arena()
	_build_particles()
	_build_ui()
	player.emit_all_stats()
	var size := level.pixel_size()
	camera.set_limits(Rect2(32, 0, arena_right - 32, size.y))
	camera.target = player
	camera.snap_to_target()
	Events.boss_defeated.connect(_on_boss_defeated)
	Events.boss_started.connect(_on_boss_started)


func _process(_delta: float) -> void:
	var center := camera.get_screen_center_position()
	for p in _particles:
		p.global_position = center


# --------------------------------------------------------------- building ---
func _add_strip(parent: Node, tex: Texture2D, factor: Vector2, world_y: float, z: int) -> ParallaxStrip:
	var s := ParallaxStrip.new()
	s.texture = tex
	s.factor = factor
	s.world_y = world_y
	s.z_index = z
	parent.add_child(s)
	return s


func _build_background() -> void:
	_add_strip(background, BG_SKY, Vector2(0.04, 0.0), 0.0, 0)
	_add_strip(background, BG_FAR, Vector2(0.18, 1.0), ground_y + 30.0 - 360.0, 1)
	_add_strip(background, BG_MID, Vector2(0.42, 1.0), ground_y + 40.0 - 360.0, 2)
	_add_strip(background, BG_NEAR, Vector2(0.68, 1.0), ground_y + 24.0 - 360.0, 3)
	var fg := _add_strip(foreground, FG_VINES, Vector2(1.12, 0.0), 0.0, 0)
	fg.modulate = Color(1, 1, 1, 0.92)


func _build_props() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4242
	var used := {}
	for x in range(3, level.width - 3):
		for y in range(1, level.height):
			if level.char_at(x, y) != "#" or level.is_solid(x, y - 1) or level.char_at(x, y - 1) != ".":
				continue
			if used.has(x) or rng.randf() > 0.07:
				continue
			used[x] = true
			var spr := Sprite2D.new()
			var tree := rng.randf() < 0.22
			spr.texture = TREE_TEX if tree else PROP_TEXTURES[rng.randi_range(0, PROP_TEXTURES.size() - 1)]
			spr.centered = false
			spr.offset = Vector2(-spr.texture.get_width() / 2.0, -spr.texture.get_height() + 2.0)
			spr.position = Vector2(x * LevelBuilder.TILE + 8, y * LevelBuilder.TILE)
			spr.flip_h = rng.randf() < 0.5
			spr.z_index = -2 if tree else -1
			if tree:
				spr.modulate = Color(0.72, 0.8, 0.78)
			props.add_child(spr)
			break


func _spawn_actors() -> void:
	var start := level.first_marker("P", Vector2(64, ground_y))
	var cp_pos := level.first_marker("C", start)
	var at_checkpoint := Game.checkpoint_id >= 0
	player = PLAYER_SCENE.instantiate() as Player
	player.position = cp_pos + Vector2(-24, 0) if at_checkpoint else start
	actors.add_child(player)
	player.kill_y = level.pixel_size().y + 48.0
	for m in level.markers:
		var c: String = m["char"]
		var pos: Vector2 = m["position"]
		match c:
			"n", "s", "e":
				if at_checkpoint and pos.x < cp_pos.x:
					continue
				var slime := SLIME_SCENE.instantiate() as Slime
				slime.variant = Slime.Variant.SMALL if c == "s" else (Slime.Variant.ELITE if c == "e" else Slime.Variant.NORMAL)
				slime.position = pos
				enemies.add_child(slime)
			"C":
				var cp := Checkpoint.new()
				cp.position = pos
				props.add_child(cp)
			"B":
				boss = VERDAN_SCENE.instantiate() as Verdan
				boss.position = pos
				enemies.add_child(boss)
			_:
				if c.is_valid_int():
					var sign_post := SignPost.new()
					sign_post.text = str(level.signs.get(int(c), ""))
					sign_post.position = pos
					props.add_child(sign_post)


func _setup_arena() -> void:
	var gate_pos := level.first_marker("L")
	arena_left = gate_pos.x - LevelBuilder.TILE / 2.0
	arena_right = (level.width - 12) * LevelBuilder.TILE
	for x in range(int(gate_pos.x / LevelBuilder.TILE), level.width):
		if level.char_at(x, 0) == "S":
			arena_right = x * LevelBuilder.TILE
			break
	if boss:
		boss.arena_left = arena_left
		boss.arena_right = arena_right
	# entrance trigger
	var trigger := Area2D.new()
	trigger.collision_layer = 0
	trigger.collision_mask = 2
	var cs := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(16, level.pixel_size().y)
	cs.shape = rect
	trigger.add_child(cs)
	trigger.position = Vector2(level.first_marker("A").x, level.pixel_size().y / 2.0)
	trigger.body_entered.connect(_on_arena_trigger)
	props.add_child(trigger)
	# gate (hidden until the fight starts)
	_gate = StaticBody2D.new()
	_gate.collision_layer = 1
	_gate.collision_mask = 0
	var gcs := CollisionShape2D.new()
	var grect := RectangleShape2D.new()
	grect.size = Vector2(16, ground_y)
	gcs.shape = grect
	gcs.position = Vector2(0, -ground_y / 2.0)
	gcs.disabled = true
	_gate.add_child(gcs)
	var wall := Sprite2D.new()
	wall.texture = WALL_TEX
	wall.centered = false
	wall.offset = Vector2(-16, -WALL_TEX.get_height())
	_gate.add_child(wall)
	_gate.position = Vector2(arena_left + 8, ground_y + WALL_TEX.get_height())
	_gate.visible = false
	props.add_child(_gate)


func _build_particles() -> void:
	var ff := CPUParticles2D.new()
	ff.texture = FIREFLY_TEX
	ff.amount = 26
	ff.lifetime = 6.0
	ff.preprocess = 6.0
	ff.local_coords = false
	ff.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	ff.emission_rect_extents = Vector2(460, 200)
	ff.gravity = Vector2(0, -4)
	ff.direction = Vector2(0, -1)
	ff.spread = 180.0
	ff.initial_velocity_min = 4.0
	ff.initial_velocity_max = 14.0
	var ramp := Gradient.new()
	ramp.set_color(0, Color(0.8, 1.0, 0.5, 0.0))
	ramp.set_color(1, Color(0.8, 1.0, 0.5, 0.0))
	ramp.add_point(0.3, Color(0.8, 1.0, 0.5, 0.9))
	ramp.add_point(0.7, Color(0.8, 1.0, 0.5, 0.6))
	ff.color_ramp = ramp
	ff.z_index = -4
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	ff.material = mat
	props.add_child(ff)
	_particles.append(ff)
	var leaves := CPUParticles2D.new()
	leaves.texture = LEAF_TEX
	leaves.amount = 14
	leaves.lifetime = 7.0
	leaves.preprocess = 7.0
	leaves.local_coords = false
	leaves.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
	leaves.emission_rect_extents = Vector2(480, 10)
	leaves.position = Vector2(0, -200)
	leaves.gravity = Vector2(6, 22)
	leaves.direction = Vector2(1, 0.3)
	leaves.spread = 40.0
	leaves.initial_velocity_min = 6.0
	leaves.initial_velocity_max = 20.0
	leaves.angular_velocity_min = -90.0
	leaves.angular_velocity_max = 90.0
	leaves.z_index = 0
	foreground.add_child(leaves)
	_particles.append(leaves)


func _build_ui() -> void:
	var hud_layer := CanvasLayer.new()
	hud_layer.layer = 10
	add_child(hud_layer)
	hud_layer.add_child(HUD_SCENE.instantiate())
	var ctl_layer := CanvasLayer.new()
	ctl_layer.layer = 11
	ctl_layer.name = "ControlsLayer"
	add_child(ctl_layer)
	ctl_layer.add_child(CONTROLS_SCENE.instantiate())
	var overlay := CanvasLayer.new()
	overlay.layer = 20
	overlay.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(overlay)
	overlay.add_child(CUTIN_SCENE.instantiate())
	overlay.add_child(PAUSE_SCENE.instantiate())
	overlay.add_child(RESULT_SCENE.instantiate())


# ---------------------------------------------------------------- arena ---
func _on_arena_trigger(body: Node) -> void:
	if body is Player and not boss_fight_started and boss != null:
		start_boss_fight()


func start_boss_fight() -> void:
	if boss_fight_started:
		return
	boss_fight_started = true
	var gcs := _gate.get_child(0) as CollisionShape2D
	gcs.set_deferred("disabled", false)
	_gate.visible = true
	var t := _gate.create_tween()
	t.tween_property(_gate, "position:y", ground_y, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	FX.shake(3.0, 0.5)
	camera.set_limits(Rect2(arena_left - 8, 0, arena_right - arena_left + 16, level.pixel_size().y))
	camera.focus_on(boss, Vector2(-40, -84))
	player.input_enabled = false
	player.clear_input()
	boss.start_intro()


func _on_boss_started(_b: Node) -> void:
	camera.clear_focus()
	if player and not player.is_dead:
		player.input_enabled = true


func _on_boss_defeated(b: Node) -> void:
	await get_tree().create_timer(0.8).timeout
	var core := TIME_CORE_SCENE.instantiate() as Pickup
	core.position = (b as Node2D).global_position + Vector2(0, -70)
	core.collected.connect(_on_core_collected)
	actors.add_child(core)
	Events.toast.emit("시간의 핵 조각이 나타났다!")


func _on_core_collected(_p: Pickup) -> void:
	if stage_cleared:
		return
	stage_cleared = true
	player.input_enabled = false
	player.clear_input()
	Events.stage_cleared.emit(Game.run.duplicate())
