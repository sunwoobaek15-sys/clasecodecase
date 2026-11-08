extends TestCase
## Phase 3-2: stage 2-1 (Fallen Clock City), its monsters and hazards, and
## the boss Chronos.

var _stage: Node2D


func _load_stage() -> Node2D:
	Game.checkpoint_id = -1
	Game.current_stage_id = "clock_1"
	Game.reset_progress(false)
	_stage = (load("res://scenes/world/clock_stage.tscn") as PackedScene).instantiate() as Node2D
	add(_stage)
	return _stage


func after_each() -> void:
	Game.current_stage_id = "forest_1"


func _start_fight(st: Node2D) -> Chronos:
	var boss := st.get("boss") as Chronos
	st.call("start_boss_fight")
	await wait_until(func() -> bool: return boss.is_active(), 5.0)
	return boss


func test_clock_stage_builds() -> void:
	var st := _load_stage()
	await seconds(0.8)
	var p: Player = st.get("player")
	check(p != null and p.is_on_floor(), "hero stands on the clock city floor")
	check(st.get("boss") is Chronos, "boss is Chronos")
	var slimes := 0
	var sentinels := 0
	for c in (st.get("enemies") as Node).get_children():
		if c is Slime:
			slimes += 1
			check((c as Slime).clockwork, "slimes are clockwork slimes")
		elif c is GearSentinel:
			sentinels += 1
	check(slimes >= 8, "clockwork slimes spawned (%d)" % slimes)
	check_eq(sentinels, 4, "gear sentinels spawned")
	check_eq(tree().get_nodes_in_group(&"hazards").size(), 5, "saw gears placed")
	check_eq(Game.stage_title, "2-1  무너진 시계 도시", "stage title")


func test_saw_hazard_hurts() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var saw := SawHazard.new()
	saw.travel = 0.0
	saw.position = Vector2(40, 0)
	add(saw)
	await frames(3)
	var hp0 := p.hp
	p.global_position.x = 40
	await frames(4)
	check(p.hp < hp0, "the spinning gear hurts (%d -> %d)" % [hp0, p.hp])


func test_gear_sentinel_flies_and_shoots() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var gs := (load("res://scenes/enemies/gear_sentinel.tscn") as PackedScene).instantiate() as GearSentinel
	gs.position = Vector2(180, 0)
	add(gs)
	await frames(2)
	check(gs.global_position.y < -20.0, "hovers above the ground")
	var shot := false
	for i in 300:
		await tree().physics_frame
		for c in runner.get_children():
			if c is Projectile and (c as Projectile).source == gs:
				shot = true
		if shot:
			break
	check(shot, "fires a gear shard at the hero")
	check(gs.fsm.current in [&"chase", &"charge", &"hurt"], "keeps chasing (%s)" % gs.fsm.current)
	gs.take_hit(HitData.make(9999, Vector2.ZERO))
	await seconds(1.2)
	check(not is_instance_valid(gs) or gs.is_queued_for_deletion() or gs.modulate.a < 0.5, "shatters when destroyed")
	check(p != null, "player alive")


func test_chronos_intro_and_attacks_run() -> void:
	var st := _load_stage()
	await seconds(0.5)
	var boss := await _start_fight(st)
	check(boss.is_active(), "fight starts after the intro")
	var p: Player = st.get("player")
	p.global_position = boss.global_position + Vector2(-110, 0)
	for s in [&"staff_dash", &"gear_shot", &"time_burst", &"blink", &"time_stop", &"time_rewind"]:
		p.hp = p.max_hp
		boss.fsm.change(s)
		var seen_idle := await wait_until(func() -> bool: return boss.fsm.current in [&"idle", &"walk"] or boss.fsm.current != s and s != &"time_rewind" and s != &"blink", 6.0)
		check(seen_idle, "%s finishes (now %s)" % [s, boss.fsm.current])
		boss.fsm.change(&"idle")
		await frames(5)
	check(not boss.is_dead, "boss still alive after a full rotation")


func test_time_stop_freezes_unless_dodging() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	await frames(2)
	check(p.freeze(1.0), "frozen")
	check(p.is_frozen(), "is_frozen")
	var x0 := p.global_position.x
	press(&"move_right")
	await seconds(0.5)
	release(&"move_right")
	check_eq(p.global_position.x, x0, "cannot move while frozen")
	p.take_hit(HitData.make(5, Vector2.ZERO))
	check(not p.is_frozen(), "a hit restarts time")
	p.invuln_time = 0.5
	check(not p.freeze(1.0), "i-frames (dodging) avoid the time stop")


func test_rewind_afterimage() -> void:
	var st := _load_stage()
	await seconds(0.5)
	var boss := await _start_fight(st)
	boss.fsm.change(&"time_rewind")
	await frames(2)
	var img := boss.afterimage()
	check(img != null, "afterimage left behind")
	img.call(&"take_hit", HitData.make(1, Vector2.ZERO))
	await frames(2)
	check(boss.afterimage() == null, "one hit shatters it")
	boss.fsm.change(&"idle")
	await frames(2)
	boss.fsm.change(&"time_rewind")
	await frames(2)
	var hp0 := boss.hp
	boss.apply_damage(HitData.make(60, Vector2.ZERO))
	var after_hit := boss.hp
	var img2 := boss.afterimage()
	check(img2 != null, "second afterimage")
	await wait_until(func() -> bool: return boss.afterimage() == null, 6.0)
	check(boss.hp > after_hit, "rewind heals (%d -> %d)" % [after_hit, boss.hp])
	check(boss.hp <= hp0, "never above the HP it had")


func test_chronos_phase_two_and_defeat_rewards() -> void:
	var st := _load_stage()
	await seconds(0.5)
	var boss := await _start_fight(st)
	boss.apply_damage(HitData.make(boss.max_hp / 2 + 5, Vector2.ZERO))
	check_eq(boss.fsm.current, &"phase_shift", "phase shift at 50%")
	await wait_until(func() -> bool: return boss.phase == 2, 4.0)
	check_eq(boss.phase, 2, "phase 2")
	boss.invuln_time = 0.0
	boss.take_hit(HitData.make(99999, Vector2.ZERO))
	await wait_until(func() -> bool: return Codex.is_known(&"chronos"), 4.0)
	check(Codex.is_known(&"chronos"), "Chronos recorded in the codex")
	var ids: Array[StringName] = []
	for c in (st.get("enemies") as Node).get_children():
		if c is Pickup and (c as Pickup).kind == Pickup.Kind.ITEM:
			ids.append((c as Pickup).item_id)
	check(ids.has(&"item_chronos_watch"), "drops the pocket watch (%s)" % str(ids))
	check_eq(Quests.status(&"ach_chronos"), "done", "achievement for defeating Chronos")


func test_region_two_unlock_and_quests() -> void:
	var region: Dictionary = VillagePanels.WorldMapPanel.REGIONS[1]
	check(not VillagePanels.WorldMapPanel.region_open(region), "clock city locked at first")
	Village.arrived = true
	Quests.refresh()
	for q in [&"q_main_01", &"q_main_02", &"q_main_03", &"q_main_04", &"q_main_05"]:
		Quests.state[q] = {"status": "done", "progress": [], "date": ""}
	Quests.refresh()
	check(VillagePanels.WorldMapPanel.region_open(region), "opens after '다음 여정'")
	check(not VillagePanels.WorldMapPanel.region_open(VillagePanels.WorldMapPanel.REGIONS[2]), "sky ruins still locked")
	check_eq(Quests.status(&"q_main_06"), "available", "next main quest offered by the traveler")
	check(Quests.accept(&"q_main_06"), "accepted")
	check(Quests.accept(&"q_sub_sentinel"), "sentinel quest accepted")
	for i in 8:
		Quests.notify(&"kill", "gear_sentinel")
	check_eq(Quests.status(&"q_sub_sentinel"), "ready", "8 sentinels")
	Quests.notify(&"boss", "chronos")
	check_eq(Quests.status(&"q_main_06"), "ready", "Chronos defeated -> report")
