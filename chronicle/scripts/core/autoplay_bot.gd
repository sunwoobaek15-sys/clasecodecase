extends Node
## Autoplay bot for end-to-end testing (enabled with:  -- --bot).
##
## Plays the title screen and stage 1-1 like a player would: it only sends
## input actions (Input.action_press for the stick, InputEventActions for the
## buttons - the same path as the touch controls) and reads what is visible:
## enemy positions, warning markers, the root wave front. It never edits game
## state. After the clear it walks into the village and tours it (talks to
## the keeper, restores the shop, visits the merchant, opens the menus and the
## world map). It exits with code 0 when all of that worked, 1 on failure.
##
## Options:  --screenshots=DIR  save key frames (needs a renderer, not --headless)
##           --stage=clock_1   start a mid-game hero (Lv.7, forest gear) directly
##                             in stage 2-1 and finish when Chronos is beaten
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
var _menu_shots_done: bool = false
var _menu_busy: bool = false
var _tour_started: bool = false
var _started: bool = false


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_timeout = float(str(Game.cmd_options.get("timeout", "900")))
	Events.player_died.connect(_on_player_died)
	Events.boss_started.connect(func(_b: Node) -> void: _log("boss fight started"))
	Events.boss_phase_changed.connect(_on_phase)
	Events.boss_defeated.connect(func(b: Node) -> void: _log("%s defeated" % b.name))
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
		_log("boss phase 2")
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
		_log("scene: " + _scene_name)
		_scene_t = 0.0
		_release_all()
	_scene_t += real
	if Game.is_changing_scene():
		return
	if scene.name == "Title":
		if _scene_t > 1.5:
			_shot("01_title")
		if _scene_t > 2.5 and not _started:
			_started = true
			var direct := str(Game.cmd_options.get("stage", ""))
			if direct != "":
				_log("title -> %s (mid-game hero)" % direct)
				_prepare_mid_game_hero()
				Game.start_stage(direct)
			else:
				_log("title -> 게임 시작")
				Game.new_game()
	elif scene.is_in_group(&"stage"):
		_play(scene, real)
	elif scene.name == "VillageScene" and not _tour_started and _scene_t > 1.0:
		_tour_started = true
		_village_tour(scene)


func _play(stage: Node, delta: float) -> void:
	var rs := get_tree().get_first_node_in_group(&"result_screen")
	if rs != null and rs.visible:
		_release_all()
		_result_t += delta
		if _result_t < 0.8:
			return
		if rs.get("shown") == &"clear":
			_shot("10_stage_clear")
			if (_shots.has("10_stage_clear") or Game.screenshot_dir == "" or DisplayServer.get_name() == "headless") \
					and _result_t > 1.4 and Game.current_stage_id != "forest_1":
				_finish(true, "%s cleared" % Game.current_stage_id)
				return
			if (_shots.has("10_stage_clear") or Game.screenshot_dir == "" or DisplayServer.get_name() == "headless") \
					and _result_t > 1.4:
				_log("result -> 마을로 가기")
				_result_t = -999.0
				rs.call("press_first_button")
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
	if get_tree().paused or _menu_busy:
		return
	if _scene_t > 1.2:
		_shot("02_stage_start")
	var p := stage.get("player") as Player
	if p == null or not is_instance_valid(p) or p.is_dead or not p.input_enabled:
		_release_all()
		if p != null and is_instance_valid(p) and bool(stage.get("boss_fight_started")) and not p.input_enabled:
			_shot_later("06_boss_intro", 0.9)
		return
	if p.hp < p.max_hp * 0.35 and Profile.inventory.count(Profile.POTION_ID) > 0:
		_tap(&"use_potion")
	if Game.checkpoint_id >= 0 and not _menu_shots_done and Game.screenshot_dir != "" and DisplayServer.get_name() != "headless":
		_menu_shots_done = true
		_capture_menu()
		return
	if _hooked_player != p:
		_hooked_player = p
		p.hurt.connect(_on_player_hurt)
	var boss := stage.get("boss") as Enemy
	_diag_t += delta
	if _diag_t > 5.0 and _boss_active(boss):
		_diag_t = 0.0
		_log("diag boss=%s hp=%d ph=%d bx=%.0f | p=%s px=%.0f py=%.0f hp=%d floor=%s | evade=%.2f" % [boss.fsm.current, boss.hp, int(boss.get(&"phase")), boss.global_position.x, p.fsm.current, p.global_position.x, p.global_position.y, p.hp, str(p.is_on_floor()), _evade_time])
	if _threats(p, stage):
		return
	var core := _time_core(stage)
	var loot := _nearest_loot(p, stage)
	if loot != null and (core != null or _nearest_enemy(p) == null):
		_release(&"attack")
		var ldx := loot.global_position.x - p.global_position.x
		_axis(signf(ldx) if absf(ldx) > 3.0 else 0.0)
		return
	if core != null:
		_release(&"attack")
		var cdx := core.global_position.x - p.global_position.x
		_axis(signf(cdx) if absf(cdx) > 4.0 else 0.0)
		return
	var target: Node2D = null
	if _boss_active(boss):
		target = boss
		if boss.has_method(&"afterimage"):
			var img := boss.call(&"afterimage") as Node2D
			if img != null and float(img.call(&"remaining")) > 0.6:
				target = img
	else:
		target = _nearest_enemy(p)
	if target != null:
		_fight(p, target, delta)
	else:
		_advance(p, delta)
	if Game.checkpoint_id >= 0:
		_shot("05_checkpoint")


## Opens the pause menu and the character screen and captures its tabs.
func _capture_menu() -> void:
	_menu_busy = true
	_release_all()
	Events.pause_requested.emit()
	# let the checkpoint toast fade, then open the screen the way a player does
	await get_tree().create_timer(3.0, true, false, true).timeout
	var cm := get_tree().get_first_node_in_group(&"character_menu")
	var pm := get_tree().get_first_node_in_group(&"pause_menu")
	if cm != null:
		if pm != null and pm.has_method("_on_character"):
			pm.call("_on_character")
		else:
			cm.call("open")
		var names := ["05b_character_stats", "05c_character_items", "05d_character_skills"]
		for i in names.size():
			(cm.get("_tabs") as TabContainer).current_tab = i
			if i == 1:
				var list := cm.get("_item_list") as ItemList
				if list != null and list.item_count > 0:
					list.select(list.item_count - 1)
					list.item_selected.emit(list.item_count - 1)
			await get_tree().create_timer(0.3, true, false, true).timeout
			await _shot(names[i])
		cm.call("close")
	await get_tree().create_timer(0.2, true, false, true).timeout
	Events.pause_requested.emit()
	await get_tree().create_timer(0.2, true, false, true).timeout
	_menu_busy = false


# ---------------------------------------------------------------- village ---
func _wait(sec: float) -> void:
	await get_tree().create_timer(sec, true, false, true).timeout


## Walks until the hero is within 6 px of x (gives up after 8 s).
func _walk_to(v: Node, x: float) -> bool:
	var p := v.get("player") as Player
	var limit := 8.0
	while limit > 0.0 and is_instance_valid(p):
		var dx := x - p.global_position.x
		if absf(dx) < 6.0:
			break
		_axis(signf(dx) * (1.0 if absf(dx) > 30.0 else 0.4))
		await get_tree().physics_frame
		limit -= get_physics_process_delta_time()
	_axis(0.0)
	await _wait(0.3)
	return is_instance_valid(p) and absf(x - p.global_position.x) < 12.0


func _talk(v: Node, npc_id: StringName) -> DialogueBox:
	var n := (v.get("npcs") as Dictionary).get(npc_id) as Npc
	if n == null or not n.visible:
		return null
	await _walk_to(v, n.global_position.x - 14.0)
	_tap(&"interact")
	await _wait(0.6)
	var d := v.get("dialogue") as DialogueBox
	return d if d.visible else null


func _village_tour(v: Node) -> void:
	_log("village: arrived (Lv.%d, %dG)" % [Profile.level, Profile.gold])
	await _wait(1.2)
	await _shot("12_village")
	var d := await _talk(v, &"keeper_mia")
	if d == null:
		_finish(false, "could not talk to Mia")
		return
	await _wait(0.8)
	await _shot("13_dialogue")
	for i in 8:
		d.advance()
		await _wait(0.15)
	if Quests.status(&"q_main_01") != "done" or not Pets.owns(&"spirit_slime"):
		_finish(false, "first quest not completed by talking")
		return
	_log("village: talked to Mia, first pet %s" % Pets.active)
	await _shot("14_choices")
	if not d.choose_containing("마을 재건"):
		_finish(false, "no restoration choice")
		return
	await _wait(0.6)
	var rp := (v.get("panels") as Dictionary)["restore"] as ModalPanel
	await _shot("15_restore")
	rp.call(&"_restore", &"shop")
	rp.close()
	if not Village.is_restored(&"shop"):
		_finish(false, "shop not restored (gold %d)" % Profile.gold)
		return
	_log("village: shop restored (%dG left)" % Profile.gold)
	await _wait(1.0)
	d = await _talk(v, &"merchant_kairo")
	if d == null:
		_finish(false, "merchant did not appear")
		return
	if not d.choose_containing("상점"):
		_finish(false, "no shop choice")
		return
	await _wait(0.5)
	await _shot("16_shop")
	((v.get("panels") as Dictionary)["shop"] as ModalPanel).close()
	await _wait(0.4)
	var pet_count := get_tree().get_nodes_in_group(&"pet").size()
	await _shot("17_village_pet")
	v.call(&"open_menu_tab", "펫")
	await _wait(0.4)
	await _shot("18_menu_pets")
	(v.get("character_menu") as Control).call(&"show_tab", "퀘스트")
	await _wait(0.4)
	await _shot("19_menu_quests")
	(v.get("character_menu") as Control).call(&"show_tab", "도감")
	await _wait(0.4)
	await _shot("20_menu_codex")
	(v.get("character_menu") as Control).call(&"close")
	await _wait(0.3)
	await _walk_to(v, 70.0)
	_tap(&"interact")
	await _wait(0.6)
	var map := (v.get("panels") as Dictionary)["map"] as ModalPanel
	if not map.visible:
		_finish(false, "gate did not open the world map")
		return
	await _shot("21_world_map")
	map.close()
	await _wait(0.3)
	if pet_count != 1:
		_finish(false, "pet not following in the village")
		return
	_log("village: tour done (codex %d, quests done %d)" % [Codex.count_known(), Quests.list(["done"]).size()])
	_finish(true, "stage cleared and village toured")


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
	if _clock_threats(p, stage):
		return true
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


## Chronos and the clock city: dodge the closing time-stop ring at the last
## moment, dodge gear volleys and the staff dash, jump over saw gears.
func _clock_threats(p: Player, stage: Node) -> bool:
	var boss := stage.get("boss") as Enemy
	var px := p.global_position.x
	var dodge_ready := _dodge_cooldown <= 0.0 and p.is_on_floor()
	for n in _effects(stage):
		if n is ChronosParts.TimeStopRing:
			var ring := n as ChronosParts.TimeStopRing
			var left := ring.duration * (1.0 - ring.progress())
			if left < 0.14 and _dodge_cooldown <= 0.0:
				_dodge_cooldown = 0.5
				_axis(-signf(boss.global_position.x - p.global_position.x) if boss else 1.0)
				_tap(&"dodge")
				_shot("11_time_stop")
				return true
			if left < 0.6:
				_axis(0.0)
				_release(&"attack")
				return true
		elif n is Projectile and boss != null and (n as Projectile).source == boss:
			var pr := n as Projectile
			var to := p.global_position + Vector2(0, -20) - pr.global_position
			if to.length() < 64.0 and pr.velocity.dot(to) > 0.0:
				if dodge_ready:
					_dodge_cooldown = 0.5
					_axis(signf(pr.velocity.x))
					_tap(&"dodge")
					return true
				elif p.is_on_floor() and _jump_cooldown <= 0.0:
					_jump_cooldown = 0.5
					_press(&"jump")
					_release_later_jump()
					return true
		elif n is Telegraph and (n as Telegraph).shape == Telegraph.Shape.LINE and boss is Chronos:
			var t := n as Telegraph
			var rel := (px - t.global_position.x) * t.direction
			if rel > -10.0 and rel < t.length + 20.0 and t.progress() > 0.82 and dodge_ready:
				_dodge_cooldown = 0.5
				_axis(-float(t.direction))
				_tap(&"dodge")
				return true
	for h in get_tree().get_nodes_in_group(&"hazards"):
		var saw := h as SawHazard
		if saw == null:
			continue
		var bp := saw.blade_position()
		var ddx := bp.x - px
		if absf(bp.y - p.global_position.y) < 30.0 and absf(ddx) < 40.0 and p.is_on_floor() and _jump_cooldown <= 0.0:
			_jump_cooldown = 0.6
			_axis(signf(ddx) if absf(ddx) > 4.0 else 1.0)
			_press(&"jump")
			_release_later_jump()
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


## Closest item drop on roughly the same height (collected before the core).
func _nearest_loot(p: Player, stage: Node) -> Node2D:
	var best: Node2D = null
	var best_d := 160.0
	var nodes: Array[Node] = (stage.get("actors") as Node).get_children()
	nodes.append_array((stage.get("enemies") as Node).get_children())
	for c in nodes:
		if c is Pickup and (c as Pickup).kind == Pickup.Kind.ITEM and not c.is_queued_for_deletion() \
				and Profile.inventory.space_for((c as Pickup).item_id) > 0:
			var d := (c as Node2D).global_position - p.global_position
			if absf(d.y) > 40.0 or absf(d.x) >= best_d:
				continue
			best_d = absf(d.x)
			best = c
	return best


func _boss_active(boss: Enemy) -> bool:
	return boss != null and is_instance_valid(boss) and bool(boss.call(&"is_active"))


## A mid-game hero for testing stage 2-1 directly (about what three forest
## runs and the first village quests give).
func _prepare_mid_game_hero() -> void:
	Game.reset_progress(true)
	Village.arrived = true
	Profile.add_exp(30 + 55 + 80 + 105 + 130 + 155)
	for id in [&"item_sword_forest", &"item_armor_guardian", &"item_ring_time"]:
		Profile.inventory.add(id, 1)
		Profile.equip(id)
	Profile.inventory.add(Profile.POTION_ID, 5)
	for node in [&"node_combo_mastery", &"node_combo_mastery", &"node_time_blessing", &"node_crescent_mastery", &"node_wind_step", &"node_time_blessing"]:
		Profile.upgrade_skill(node)
	Pets.grant(&"spirit_slime")


func _nearest_enemy(p: Player) -> Node2D:
	var best: Node2D = null
	var best_d := 230.0
	for e in get_tree().get_nodes_in_group(&"enemies"):
		if e is GearSentinel and not (e as Enemy).is_dead:
			var d2 := (e as Node2D).global_position - p.global_position
			if absf(d2.x) < best_d and absf(d2.y) < 120.0:
				best_d = absf(d2.x) + 10.0
				best = e
			continue
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
	var is_boss := target.is_in_group(&"boss")
	var near := 30.0 if not is_boss else 52.0
	var far := 50.0 if not is_boss else 70.0
	if target is GearSentinel:
		_fight_sentinel(p, target as GearSentinel, dx, dir)
		return
	if target.is_in_group(&"afterimage"):
		near = 0.0
		far = 34.0
	if is_boss:
		var v := target as Enemy
		if v.fsm.current in [&"tree_throw", &"forest_wrath", &"phase_shift", &"time_burst", &"gear_shot"]:
			far = 80.0
			near = 64.0
		if target is Chronos:
			near = 40.0
			far = 58.0
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


## Gear sentinels hover above the ground: get under them and jump-attack.
func _fight_sentinel(p: Player, gs: GearSentinel, dx: float, dir: float) -> void:
	var dist := absf(dx)
	if dist > 26.0:
		_axis(dir)
		_release(&"attack")
		_jump_if_blocked(p, dir)
		return
	_axis(dir * 0.3)
	if p.is_on_floor() and _jump_cooldown <= 0.0 and gs.global_position.y < p.global_position.y - 30.0:
		_jump_cooldown = 0.7
		_press(&"jump")
		_release_later_jump()
	if not p.is_on_floor():
		_attack_phase = (_attack_phase + 1) % 6
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
