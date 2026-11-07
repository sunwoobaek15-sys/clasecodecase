extends TestCase
## The full stage scene: building, spawning, arena flow, UI wiring.

var _stage: Node2D


func _load_stage() -> Node2D:
	Game.checkpoint_id = -1
	_stage = (load("res://scenes/world/forest_stage.tscn") as PackedScene).instantiate() as Node2D
	add(_stage)
	return _stage


func test_stage_builds_and_spawns() -> void:
	var st := _load_stage()
	await seconds(1.0)
	var p: Player = st.get("player")
	check(p != null and is_instance_valid(p), "player spawned")
	check(p.is_on_floor(), "player stands on the generated ground")
	var boss: Verdan = st.get("boss")
	check(boss != null and boss.fsm.current == &"dormant", "Verdan waits in the arena")
	var slimes := 0
	for c in (st.get("enemies") as Node).get_children():
		if c is Slime:
			slimes += 1
	check(slimes >= 8, "slimes spawned (%d)" % slimes)
	check((st.get("ground") as TileMapLayer).get_used_cells().size() > 1500, "tiles painted")
	check_eq(tree().get_nodes_in_group(&"touch_controls").size(), 1, "touch controls present")
	check_eq(tree().get_nodes_in_group(&"pause_menu").size(), 1, "pause menu present")
	check_eq(tree().get_nodes_in_group(&"result_screen").size(), 1, "result screen present")


func test_arena_trigger_starts_boss_fight() -> void:
	var st := _load_stage()
	await seconds(0.5)
	var p: Player = st.get("player")
	var trigger_x: float = (st.get("level") as LevelBuilder).first_marker("A").x
	p.global_position = Vector2(trigger_x - 40.0, (st.get("ground_y") as float) - 2.0)
	await frames(2)
	Input.action_press(&"move_right", 1.0)
	var started := await wait_until(func() -> bool: return bool(st.get("boss_fight_started")), 3.0)
	Input.action_release(&"move_right")
	check(started, "walking into the arena starts the fight")
	check(not p.input_enabled, "player waits during the boss intro")
	var boss: Verdan = st.get("boss")
	var active := await wait_until(func() -> bool: return boss.is_active(), 5.0)
	check(active, "boss becomes active after the intro")
	check(p.input_enabled, "control returns after the intro")
	# the gate blocks the way back
	var x_before := p.global_position.x
	Input.action_press(&"move_left", 1.0)
	await seconds(1.5)
	Input.action_release(&"move_left")
	check(p.global_position.x >= (st.get("arena_left") as float), "arena gate blocks the exit (x %.0f)" % p.global_position.x)
	check(p.global_position.x <= x_before, "player could move inside the arena")


func test_checkpoint_heals_and_saves() -> void:
	var st := _load_stage()
	await seconds(0.5)
	var p: Player = st.get("player")
	p.take_hit(HitData.make(50, Vector2.ZERO))
	await seconds(1.2)
	var cp: Vector2 = (st.get("level") as LevelBuilder).first_marker("C")
	p.global_position = cp + Vector2(-30, -2)
	Input.action_press(&"move_right", 1.0)
	var healed := await wait_until(func() -> bool: return p.hp == p.max_hp, 2.0)
	Input.action_release(&"move_right")
	check(healed, "checkpoint restores HP")
	check_eq(Game.checkpoint_id, 0, "checkpoint saved")
	Game.checkpoint_id = -1


func test_boss_defeat_spawns_time_core_and_clears() -> void:
	var st := _load_stage()
	await seconds(0.5)
	var p: Player = st.get("player")
	var boss: Verdan = st.get("boss")
	st.call("start_boss_fight")
	await wait_until(func() -> bool: return boss.is_active(), 5.0)
	var cleared := [false]
	var cb := func(_s: Dictionary) -> void: cleared[0] = true
	Events.stage_cleared.connect(cb)
	boss.take_hit(HitData.make(99999, Vector2.ZERO))
	var core_seen := await wait_until(func() -> bool: return _find_core(st) != null, 6.0)
	check(core_seen, "Time Core fragment appears after the boss dies")
	var core := _find_core(st)
	if core:
		p.global_position = core.global_position + Vector2(0, 30)
		var ok := await wait_until(func() -> bool: return cleared[0], 4.0)
		check(ok, "touching the Time Core clears the stage")
	var rs := tree().get_first_node_in_group(&"result_screen")
	check(rs != null and rs.visible, "stage clear screen shown")
	check(tree().paused, "game paused behind the result screen")
	Events.stage_cleared.disconnect(cb)


func test_game_over_panel_on_death() -> void:
	var st := _load_stage()
	await seconds(0.5)
	var p: Player = st.get("player")
	p.take_hit(HitData.make(9999, Vector2.ZERO))
	var rs := tree().get_first_node_in_group(&"result_screen")
	var shown := await wait_until(func() -> bool: return rs.visible, 6.0)
	check(shown, "game over panel appears after the death animation")
	check_eq(rs.get("shown"), &"dead", "it is the game over panel")
	var labels := rs.find_children("*", "Button", true, false)
	check(labels.size() >= 2, "retry and title buttons")
	if labels.size() >= 1:
		check_eq((labels[0] as Button).text, "체크포인트에서 재도전", "first button retries from the checkpoint")
	check(tree().paused, "game paused behind the panel")
	tree().paused = false


func _find_core(st: Node) -> Pickup:
	for c in (st.get("actors") as Node).get_children():
		if c is Pickup and (c as Pickup).kind == Pickup.Kind.TIME_CORE:
			return c
	return null
