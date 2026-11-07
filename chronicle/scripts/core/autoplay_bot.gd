extends Node
## Autoplay bot for end-to-end testing (enabled with:  -- --bot).
##
## Plays the title screen and stage 1-1 like a player would: it only sends
## input actions (Input.action_press for the stick, InputEventActions for the
## buttons - the same path as the touch controls) and reads what is visible:
## enemy positions, warning markers, the root wave front. It never edits game
## state. It exits with code 0 when the stage is cleared, 1 on failure.
##
## Options:  --screenshots=DIR  save key frames (needs a renderer, not --headless)
##           --timeout=SECONDS  give up after this much game time (default 900)

const BUTTONS: Array[StringName] = [&"jump", &"attack", &"dodge", &"skill", &"ultimate"]

var _t: float = 0.0
var _scene_t: float = 0.0
var _scene_name: String = ""
var _deaths: int = 0
var _timeout: float = 900.0
var _done: bool = false
var _held: Dictionary = {}
var _attack_phase: int = 0
var _last_x: float = 0.0
var _stuck: float = 0.0
var _shots: Dictionary = {}
var _events: Array[String] = []
var _boss_seen_phase2: bool = false
var _jump_cooldown: float = 0.0
var _dodge_cooldown: float = 0.0
var _evade_dir: float = 0.0
var _evade_time: float = 0.0
var _hit_tags: Dictionary = {}
var _hooked_player: Player = null
var _diag_t: float = 0.0
var _result_t: float = 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_timeout = float(str(Game.cmd_options.get("timeout", "900")))
	Events.player_died.connect(_on_player_died)
	Events.boss_started.connect(func(_b: Node) -> void: _log("boss fight started"))
	Events.boss_phase_changed.connect(_on_phase)
	Events.boss_defeated.connect(func(_b: Node) -> void: _log("Verdan defeated"))
	Events.checkpoint_reached.connect(func(_i: int) -> void: _log("checkpoint reached"))
	Events.stage_cleared.connect(func(_s: Dictionary) -> void: _log("stage cleared"))
	Events.ultimate_cutin_requested.connect(_on_ultimate)
	print("[bot] autoplay started (timeout %.0fs, screenshots: %s)" % [_timeout, Game.screenshot_dir if Game.screenshot_dir != "" else "off"])


func _log(text: String) -> void:
	var line := "[bot %6.1fs] %s" % [_t, text]
	_events.append(line)
	print(line)


func _on_player_hurt(h: HitData) -> void:
	var key := str(h.tag)
	_hit_tags[key] = int(_hit_tags.get(key, 0)) + 1


func _on_ultimate() -> void:
	_log("ultimate used")
	_shot_later("08_ultimate_cutin", 0.25)


func _on_player_died() -> void:
	_deaths += 1
	_log("player died (%d)" % _deaths)


func _on_phase(p: int) -> void:
	if p == 2:
		_boss_seen_phase2 = true
		_log("Verdan phase 2")
		_shot_later("09_boss_phase2", 1.0)


# ------------------------------------------------------------ screenshots ---
func _shot(name: String) -> void:
	if Game.screenshot_dir == "" or _shots.has(name):
		return
	if DisplayServer.get_name() == "headless":
		return
	_shots[name] = true
	DirAccess.make_dir_recursive_absolute(Game.screenshot_dir)
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := Game.screenshot_dir.path_join(name + ".png")
	img.save_png(path)
	print("[bot] screenshot ", path)


func _shot_later(name: String, delay: float) -> void:
	await get_tree().create_timer(delay, true, false, true).timeout
	_shot(name)


# ------------------------------------------------------------------ input ---
func _axis(v: float) -> void:
	if v > 0.05:
		Input.action_release(&"move_left")
		Input.action_press(&"move_right", clampf(v, 0.0, 1.0))
	elif v < -0.05:
		Input.action_release(&"move_right")
		Input.action_press(&"move_left", clampf(-v, 0.0, 1.0))
	else:
		Input.action_release(&"move_left")
		Input.action_release(&"move_right")


func _press(action: StringName) -> void:
	if not _held.get(action, false):
		_held[action] = true
		Game.send_action(action, true)


func _release(action: StringName) -> void:
	if _held.get(action, false):
		_held[action] = false
		Game.send_action(action, false)


func _tap(action: StringName) -> void:
	_press(action)
	_release_later(action)


func _release_later(action: StringName) -> void:
	await get_tree().physics_frame
	await get_tree().physics_frame
	_release(action)


func _release_all() -> void:
	_axis(0.0)
	for a in BUTTONS:
		_release(a)


# ------------------------------------------------------------------- loop ---
func _physics_process(delta: float) -> void:
	if _done:
		return
	var real := delta / maxf(Engine.time_scale, 0.0001)
	_t += real
	_jump_cooldown = maxf(0.0, _jump_cooldown - real)
	_dodge_cooldown = maxf(0.0, _dodge_cooldown - real)
	_evade_time = maxf(0.0, _evade_time - real)
	if _t > _timeout:
		_finish(false, "timeout after %.0fs" % _t)
		return
	var scene := get_tree().current_scene
	if scene == null:
		return
	if scene.name != _scene_name:
		_scene_name = scene.name
		_scene_t = 0.0
		_release_all()
	_scene_t += real
	if Game.is_changing_scene():
		return
	if scene.name == "Title":
		if _scene_t > 1.5:
			_shot("01_title")
		if _scene_t > 2.5:
			_log("title -> 게임 시작")
			Game.new_game()
	elif scene.name == "ForestStage":
		_play(scene, real)


func _play(stage: Node, delta: float) -> void:
	var rs := get_tree().get_first_node_in_group(&"result_screen")
	if rs != null and rs.visible:
		_release_all()
		_result_t += delta
		if _result_t < 0.8:
			return
		if rs.get("shown") == &"clear":
			_shot("10_stage_clear")
			if _shots.has("10_stage_clear") or Game.screenshot_dir == "" or DisplayServer.get_name() == "headless":
				_finish(true, "stage cleared")
		else:
			_shot("xx_game_over_%d" % _deaths)
			if _result_t < 1.3:
				return  # let the screenshot finish before leaving the screen
			_result_t = 0.0
			if _deaths > 6:
				_finish(false, "died too often")
			else:
				_log("retry from checkpoint")
				rs.call("press_first_button")
		return
	_result_t = 0.0
	if get_tree().paused:
		return
	if _scene_t > 1.2:
		_shot("02_stage_start")
	var p := stage.get("player") as Player
	if p == null or not is_instance_valid(p) or p.is_dead or not p.input_enabled:
		_release_all()
		if p != null and is_instance_valid(p) and bool(stage.get("boss_fight_started")) and not p.input_enabled:
			_shot_later("06_boss_intro", 0.9)
		return
	if _hooked_player != p:
		_hooked_player = p
		p.hurt.connect(_on_player_hurt)
	var boss := stage.get("boss") as Verdan
	_diag_t += delta
	if _diag_t > 5.0 and boss != null and is_instance_valid(boss) and boss.is_active():
		_diag_t = 0.0
		_log("diag boss=%s hp=%d ph=%d bx=%.0f | p=%s px=%.0f py=%.0f hp=%d floor=%s | evade=%.2f" % [boss.fsm.current, boss.hp, boss.phase, boss.global_position.x, p.fsm.current, p.global_position.x, p.global_position.y, p.hp, str(p.is_on_floor()), _evade_time])
	if _threats(p, stage):
		return
	var core := _time_core(stage)
	if core != null:
		_release(&"attack")
		var cdx := core.global_position.x - p.global_position.x
		_axis(signf(cdx) if absf(cdx) > 4.0 else 0.0)
		return
	var target: Node2D = null
	if boss != null and is_instance_valid(boss) and boss.is_active():
		target = boss
	else:
		target = _nearest_enemy(p)
	if target != null:
		_fight(p, target, delta)
	else:
		_advance(p, delta)
	if Game.checkpoint_id >= 0:
		_shot("05_checkpoint")


func _finish(ok: bool, why: String) -> void:
	_done = true
	_release_all()
	var run := Game.run
	print("[bot] RESULT: %s - %s" % ["SUCCESS" if ok else "FAILURE", why])
	print("[bot] time %.1fs, deaths %d, kills %d, damage dealt %d, damage taken %d, max combo %d, phase2 seen %s" % [
		float(run.get("time", 0.0)), _deaths, int(run.get("kills", 0)), int(run.get("damage_dealt", 0)),
		int(run.get("damage_taken", 0)), int(run.get("max_combo", 0)), str(_boss_seen_phase2)])
	print("[bot] hits taken by attack: ", _hit_tags)
	await get_tree().create_timer(0.3, true, false, true).timeout
	get_tree().quit(0 if ok else 1)


# --------------------------------------------------------------- tactics ---
func _all(root: Node, out: Array[Node]) -> void:
	for c in root.get_children():
		out.append(c)
		_all(c, out)


func _effects(stage: Node) -> Array[Node]:
	var out: Array[Node] = []
	_all(stage.get_node("Effects"), out)
	return out


## Reacts to warnings. Returns true when the bot is busy evading.
func _threats(p: Player, stage: Node) -> bool:
	var px := p.global_position.x
	var danger_dirs: Array[float] = []
	var must_jump := false
	for n in _effects(stage):
		if n is RootWave:
			var w := n as RootWave
			if w.is_finished():
				continue
			var front := w.front_position().x
			var toward := signf(px - front) == float(w.direction)
			if toward and absf(front - px) < 70.0:
				must_jump = true
		elif n is Telegraph:
			var t := n as Telegraph
			if t.shape == Telegraph.Shape.CIRCLE:
				var d := px - t.global_position.x
				if absf(d) < t.radius + 16.0 and t.progress() > 0.25:
					danger_dirs.append(signf(d) if d != 0.0 else 1.0)
	if must_jump and p.is_on_floor() and _jump_cooldown <= 0.0:
		_jump_cooldown = 0.5
		_press(&"jump")
		_release_later_jump()
		_axis(0.0)
		_shot("07_boss_root_wave")
		return true
	if not danger_dirs.is_empty():
		var dir := danger_dirs[0]
		var arena_l := float(stage.get("arena_left"))
		var arena_r := float(stage.get("arena_right"))
		if bool(stage.get("boss_fight_started")):
			if px + dir * 70.0 < arena_l + 20.0 or px + dir * 70.0 > arena_r - 20.0:
				dir = -dir
		_evade_dir = dir
		_evade_time = 0.35
		_axis(dir)
		_release(&"attack")
		_shot("07_boss_telegraph")
		return true
	if _evade_time > 0.0:
		_axis(_evade_dir)
		return true
	return false


func _release_later_jump() -> void:
	for i in 18:
		await get_tree().physics_frame
	_release(&"jump")


func _time_core(stage: Node) -> Node2D:
	for c in (stage.get("actors") as Node).get_children():
		if c is Pickup and (c as Pickup).kind == Pickup.Kind.TIME_CORE:
			return c
	return null


func _nearest_enemy(p: Player) -> Node2D:
	var best: Node2D = null
	var best_d := 230.0
	for e in get_tree().get_nodes_in_group(&"enemies"):
		if e is Slime and not (e as Slime).is_dead:
			var d := (e as Node2D).global_position - p.global_position
			if absf(d.y) > 70.0:
				continue
			var score := absf(d.x) + (40.0 if d.x < 0.0 else 0.0)
			if score < best_d:
				best_d = score
				best = e
	return best


func _fight(p: Player, target: Node2D, _delta: float) -> void:
	var dx := target.global_position.x - p.global_position.x
	var dist := absf(dx)
	var dir := signf(dx) if dx != 0.0 else 1.0
	var is_boss := target is Verdan
	var near := 30.0 if not is_boss else 52.0
	var far := 50.0 if not is_boss else 70.0
	if is_boss:
		var v := target as Verdan
		if v.fsm.current in [&"tree_throw", &"forest_wrath", &"phase_shift"]:
			far = 80.0
			near = 64.0
		_shot("07_boss_fight")
		if p.ult_ready() and dist < 130.0:
			_tap(&"ultimate")
			return
	elif target is Slime and (target as Slime).variant == Slime.Variant.ELITE:
		_shot("04_elite_slime")
	else:
		if dist < 70.0:
			_shot("03_slime_combat")
	if p.can_use_skill() and dist > 60.0 and dist < 190.0 and p.facing == int(dir) and p.mp > 30.0:
		_tap(&"skill")
		return
	if dist > far:
		_axis(dir)
		_release(&"attack")
		_jump_if_blocked(p, dir)
		return
	if dist < near and is_boss:
		_axis(-dir)
		return
	if p.facing != int(dir):
		_axis(dir * 0.5)
	else:
		_axis(0.0)
	var dy := target.global_position.y - p.global_position.y
	if dy < -30.0 and p.is_on_floor() and _jump_cooldown <= 0.0:
		_jump_cooldown = 0.6
		_tap(&"jump")
	_attack_phase = (_attack_phase + 1) % 8
	if _attack_phase == 0:
		_press(&"attack")
	elif _attack_phase == 2:
		_release(&"attack")


func _jump_if_blocked(p: Player, dir: float) -> void:
	if not p.is_on_floor() or _jump_cooldown > 0.0:
		return
	var blocked := p.is_on_wall() and signf(p.get_wall_normal().x) == -dir
	var ledge := p.is_on_floor() and _ledge_ahead(p, dir)
	if blocked or ledge:
		_jump_cooldown = 0.45
		_press(&"jump")
		_release_later_jump()


func _ledge_ahead(p: Player, dir: float) -> bool:
	var from := p.global_position + Vector2(dir * 18.0, -4.0)
	var q := PhysicsRayQueryParameters2D.create(from, from + Vector2(0, 40), 1)
	return p.get_world_2d().direct_space_state.intersect_ray(q).is_empty()


func _advance(p: Player, delta: float) -> void:
	_release(&"attack")
	_axis(1.0)
	_jump_if_blocked(p, 1.0)
	if absf(p.global_position.x - _last_x) < 0.5:
		_stuck += delta
		if _stuck > 1.0 and p.is_on_floor():
			_stuck = 0.0
			_press(&"jump")
			_release_later_jump()
	else:
		_stuck = 0.0
	_last_x = p.global_position.x
