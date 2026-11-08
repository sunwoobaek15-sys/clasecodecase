extends TestCase
## Phase 3-3: stage 3-1 (Sky Ruins), updrafts, crumbling ledges, hidden
## chests, the new monsters and the storm dragon Tempesta.


func _load(stage: String) -> Node2D:
	Game.checkpoint_id = -1
	Game.current_stage_id = stage
	var st := (load(str(Game.STAGES[stage])) as PackedScene).instantiate() as Node2D
	add(st)
	return st


func after_each() -> void:
	Game.current_stage_id = "forest_1"


func _start_fight(st: Node2D) -> SkyDragon:
	var boss := st.get("boss") as SkyDragon
	st.call("start_boss_fight")
	await wait_until(func() -> bool: return boss.is_active(), 5.0)
	return boss


func test_sky_stage_builds() -> void:
	var st := _load("sky_1")
	await seconds(0.8)
	var p: Player = st.get("player")
	check(p != null and p.is_on_floor(), "hero stands on the first island")
	check(st.get("boss") is SkyDragon, "boss is the storm dragon")
	var counts := {"slime": 0, "wisp": 0, "guardian": 0}
	for c in (st.get("enemies") as Node).get_children():
		if c is Slime:
			counts["slime"] += 1
			check_eq((c as Slime).theme, "cloud", "cloud slimes")
		elif c is WindWisp:
			counts["wisp"] += 1
		elif c is RuinGuardian:
			counts["guardian"] += 1
	check_eq(counts["slime"], 7, "cloud slimes spawned")
	check_eq(counts["wisp"], 4, "wind wisps spawned")
	check_eq(counts["guardian"], 2, "ruin guardians spawned")
	check_eq(tree().get_nodes_in_group(&"updrafts").size(), 2, "two updrafts")
	check_eq(tree().get_nodes_in_group(&"crumble").size(), 2, "two crumbling bridges")
	check_eq(tree().get_nodes_in_group(&"chests").size(), 1, "one hidden chest")
	check_eq(Game.stage_title, "3-1  하늘의 폐허", "stage title")


func test_updraft_lifts_hero() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var up := Updraft.new()
	up.height = 160.0
	up.position = Vector2(0, 0)
	add(up)
	await seconds(0.8)
	check(p.global_position.y < -60.0, "lifted by the wind (y %.0f)" % p.global_position.y)


func test_crumbling_ledge_falls_and_returns() -> void:
	make_floor()
	var p := spawn_player(Vector2(-200, 0))
	var cp := CrumblePlatform.new()
	cp.tiles = 4
	cp.position = Vector2(-32, -40)
	add(cp)
	await frames(2)
	p.global_position = Vector2(0, -42)
	await seconds(0.3)
	check(p.is_on_floor() and p.global_position.y < -35.0, "standing on the ledge")
	await seconds(CrumblePlatform.SHAKE_TIME + 0.4)
	check(not cp.is_solid(), "ledge crumbled")
	check(p.global_position.y > -10.0, "hero fell through")
	await seconds(CrumblePlatform.RESPAWN_TIME)
	check(cp.is_solid(), "ledge comes back (state %s, t %.2f)" % [cp.get(&"_state"), cp.get(&"_t")])


func test_hidden_chests() -> void:
	var st := _load("sky_1")
	await seconds(0.5)
	var chest := tree().get_first_node_in_group(&"chests") as TreasureChest
	check(chest != null and not chest.is_opened(), "chest closed at first")
	Quests.state[&"q_main_06"] = {"status": "done", "progress": [], "date": ""}
	Village.arrived = true
	Quests.refresh()
	check(Quests.accept(&"q_sub_treasure"), "treasure quest accepted")
	var gold := Profile.gold
	var p: Player = st.get("player")
	p.global_position = chest.global_position
	await frames(4)
	check(chest.is_opened(), "opened on touch")
	check_eq(Profile.gold, gold + 200, "chest gold")
	check_eq(Profile.inventory.count(&"item_sky_feather"), 3, "chest items")
	check_eq(Quests.status(&"q_sub_treasure"), "ready", "quest objective done")
	gold = Profile.gold
	p.global_position = chest.global_position + Vector2(0, -60)
	await frames(3)
	p.global_position = chest.global_position
	await frames(3)
	check_eq(Profile.gold, gold, "a chest gives its reward only once")
	var d := Profile.to_dict()
	Profile.reset(false)
	Profile.from_dict(d)
	check(Profile.opened_chests.has(chest.chest_id), "opened chests are saved")
	for id in ["forest_1:65", "clock_1:93"]:
		Profile.opened_chests[id] = true
	await frames(2)
	check_eq(Quests.status(&"ach_treasure"), "done", "all three chests -> achievement")


func test_forest_and_clock_have_chests() -> void:
	for stage in ["forest_1", "clock_1"]:
		var lb := LevelBuilder.load_map((load("res://data/stages/%s.tres" % stage) as StageData).level_path)
		check_eq(lb.markers_of("$").size(), 1, "%s has one hidden chest" % stage)


func test_wind_wisp_dashes() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var w := (load("res://scenes/enemies/wind_wisp.tscn") as PackedScene).instantiate() as WindWisp
	w.position = Vector2(110, 0)
	add(w)
	var dashed := await wait_until(func() -> bool: return w.fsm.current == &"dash", 5.0)
	check(dashed, "winds up and dashes at the hero")
	check(p != null, "player exists")


func test_ruin_guardian_wakes_and_slams() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var g := (load("res://scenes/enemies/ruin_guardian.tscn") as PackedScene).instantiate() as RuinGuardian
	g.position = Vector2(300, 0)
	add(g)
	await frames(10)
	check_eq(g.fsm.current, &"dormant", "dormant while the hero is far")
	p.global_position.x = 220
	var woke := await wait_until(func() -> bool: return g.fsm.current != &"dormant", 2.0)
	check(woke, "wakes up when the hero comes close")
	var hp0 := p.hp
	var slammed := await wait_until(func() -> bool: return g.fsm.current == &"slam", 6.0)
	check(slammed, "slams")
	await frames(3)
	check(p.hp < hp0, "the slam hurts a hero who stays close (%d -> %d)" % [hp0, p.hp])


func test_sky_dragon_attacks_run() -> void:
	var st := _load("sky_1")
	await seconds(0.5)
	var boss := await _start_fight(st)
	check(boss.is_active(), "fight starts after the intro")
	check(boss.global_position.y < (boss.get("_ground_y") as float) - 10.0, "hovers above the ground")
	var p: Player = st.get("player")
	for s in [&"storm_breath", &"lightning", &"reposition", &"dive_bomb", &"gale"]:
		p.hp = p.max_hp
		p.global_position = Vector2(boss.global_position.x - 110, p.global_position.y)
		boss.fsm.change(s)
		var ok := await wait_until(func() -> bool: return boss.fsm.current == &"hover", 8.0)
		check(ok, "%s finishes (now %s)" % [s, boss.fsm.current])
		await frames(5)
	check(not boss.is_dead and boss.visible, "boss back and visible after a full rotation")


func test_dive_bomb_lands_on_the_shadow() -> void:
	var st := _load("sky_1")
	await seconds(0.5)
	var boss := await _start_fight(st)
	var p: Player = st.get("player")
	p.global_position.x = boss.global_position.x - 140
	boss.fsm.change(&"dive_bomb")
	await wait_until(func() -> bool: return boss.fsm.current == &"grounded", 5.0)
	check_eq(boss.fsm.current, &"grounded", "lands and rests on the ground")
	check(absf(boss.global_position.x - p.global_position.x) < 60.0, "crashes where the hero was")


func test_sky_dragon_phase_two_and_rewards() -> void:
	var st := _load("sky_1")
	await seconds(0.5)
	var boss := await _start_fight(st)
	boss.apply_damage(HitData.make(boss.max_hp / 2 + 5, Vector2.ZERO))
	check_eq(boss.fsm.current, &"phase_shift", "phase shift at 50%")
	await wait_until(func() -> bool: return boss.phase == 2, 4.0)
	check_eq(boss.phase, 2, "phase 2")
	boss.invuln_time = 0.0
	boss.take_hit(HitData.make(99999, Vector2.ZERO))
	await wait_until(func() -> bool: return Codex.is_known(&"sky_dragon"), 4.0)
	check(Codex.is_known(&"sky_dragon"), "recorded in the codex")
	var ids: Array[StringName] = []
	for c in (st.get("enemies") as Node).get_children():
		if c is Pickup and (c as Pickup).kind == Pickup.Kind.ITEM:
			ids.append((c as Pickup).item_id)
	check(ids.has(&"item_storm_armor"), "drops the storm armour (%s)" % str(ids))
	check_eq(Quests.status(&"ach_sky_dragon"), "done", "achievement")


func test_region_three_unlock() -> void:
	var region: Dictionary = VillagePanels.WorldMapPanel.REGIONS[2]
	check(not VillagePanels.WorldMapPanel.region_open(region), "sky ruins locked")
	Village.arrived = true
	for q in [&"q_main_01", &"q_main_02", &"q_main_03", &"q_main_04", &"q_main_05", &"q_main_06"]:
		Quests.state[q] = {"status": "done", "progress": [], "date": ""}
	Quests.refresh()
	check(VillagePanels.WorldMapPanel.region_open(region), "opens after Chronos' quest")
	check_eq(Quests.status(&"q_main_07"), "available", "main quest 7 offered")
	Quests.accept(&"q_main_07")
	Quests.notify(&"boss", "sky_dragon")
	check_eq(Quests.status(&"q_main_07"), "ready", "dragon defeated -> report")
	check(Quests.turn_in(&"q_main_07"), "handed in")
	check_eq(Quests.status(&"q_main_08"), "available", "final chapter quest offered by Mia")
