extends TestCase
## Verdan boss: intro, telegraphed attacks, stagger, phase 2, death.


func _verdan(pos: Vector2) -> Verdan:
	var v := (load("res://scenes/bosses/verdan.tscn") as PackedScene).instantiate() as Verdan
	v.position = pos
	v.arena_left = -420.0
	v.arena_right = 420.0
	add(v)
	return v


func _all_nodes(root: Node, out: Array[Node]) -> void:
	for c in root.get_children():
		out.append(c)
		_all_nodes(c, out)


func _count(kind: Variant) -> int:
	var nodes: Array[Node] = []
	_all_nodes(runner, nodes)
	var n := 0
	for c in nodes:
		if is_instance_of(c, kind):
			n += 1
	return n


func _active_damage(v: Verdan) -> int:
	var nodes: Array[Node] = []
	_all_nodes(runner, nodes)
	var n := 0
	for c in nodes:
		if c is Hitbox and (c as Hitbox).active and c != v.contact_hitbox and c.target_mask == Hitbox.LAYER_PLAYER_HURTBOX:
			n += 1
	return n


func _min_telegraph_time() -> float:
	var nodes: Array[Node] = []
	_all_nodes(runner, nodes)
	var t := INF
	for c in nodes:
		if c is Telegraph:
			t = minf(t, (c as Telegraph).duration)
	return t


func _activate(v: Verdan) -> bool:
	v.start_intro()
	return await wait_until(func() -> bool: return v.is_active(), 5.0)


func test_dormant_until_intro() -> void:
	make_floor()
	spawn_player(Vector2(-200, 0))
	var v := _verdan(Vector2(150, 0))
	await seconds(0.5)
	check_eq(v.fsm.current, &"dormant", "waits in the arena")
	check(not v.is_active(), "not active yet")
	var started := [false]
	var cb := func(_b: Node) -> void: started[0] = true
	Events.boss_started.connect(cb)
	var ok := await _activate(v)
	check(ok, "becomes active after the intro")
	check(started[0], "boss_started emitted (HUD shows the boss bar)")
	Events.boss_started.disconnect(cb)


func test_every_attack_is_telegraphed() -> void:
	make_floor()
	var p := spawn_player(Vector2(-160, 0))
	var v := _verdan(Vector2(150, 0))
	await _activate(v)
	p.invuln_time = 9999.0
	for attack in [&"tree_throw", &"root_charge", &"forest_wrath"]:
		v.fsm.change(attack)
		await frames(2)
		check(_count(Telegraph) > 0, "%s shows a warning first" % attack)
		check(_min_telegraph_time() >= 0.6, "%s warns at least 0.6 s ahead" % attack)
		check_eq(_count(Projectile) + _count(RootWave), 0, "%s: no projectile/roots during the warning" % attack)
		check_eq(_active_damage(v), 0, "%s: no active damage area during the warning" % attack)
		var damage_seen := [false]
		for i in 150:
			await frames(1)
			if _count(Projectile) + _count(RootWave) > 0 or _active_damage(v) > 0:
				damage_seen[0] = true
				break
		check(damage_seen[0], "%s: the attack really happens after the warning" % attack)
		await wait_until(func() -> bool: return v.fsm.current == &"idle", 5.0)
		v.fsm.change(&"stagger")  # cancel follow-ups between cases
		await frames(2)


func test_tree_throw_lands_on_marker() -> void:
	make_floor()
	var p := spawn_player(Vector2(-150, 0))
	var v := _verdan(Vector2(150, 0))
	await _activate(v)
	v.fsm.change(&"tree_throw")
	var hit := await wait_until(func() -> bool: return p.hp < p.max_hp, 3.0)
	check(hit, "a player who stands still on the marker gets hit by the log")


func test_root_wave_can_be_jumped() -> void:
	make_floor()
	var p := spawn_player(Vector2(-150, 0))
	var v := _verdan(Vector2(150, 0))
	await _activate(v)
	var tags: Array[StringName] = []
	var cb := func(h: HitData) -> void: tags.append(h.tag)
	p.hurt.connect(cb)
	v.fsm.change(&"root_charge")
	var jumped := false
	var wave_seen := false
	for i in 240:
		await frames(1)
		for c in runner.get_children():
			if c is RootWave:
				wave_seen = true
				var front := (c as RootWave).front_position()
				if not jumped and absf(front.x - p.global_position.x) < 48.0:
					press(&"jump")
					jumped = true
		if jumped and p.is_on_floor() and p.velocity.y >= 0.0 and wave_seen and _count(RootWave) == 0:
			break
	release(&"jump")
	v.fsm.change(&"stagger")  # keep the boss from starting another attack
	check(wave_seen, "root wave spawned after the warning")
	check(jumped, "the root wave reached the player")
	check(not tags.has(&"root_wave"), "jumping over the root wave avoids it (hits: %s)" % str(tags))
	p.hurt.disconnect(cb)


func test_root_wave_hits_a_standing_player() -> void:
	make_floor()
	var p := spawn_player(Vector2(-150, 0))
	var v := _verdan(Vector2(150, 0))
	await _activate(v)
	var tags: Array[StringName] = []
	var cb := func(h: HitData) -> void: tags.append(h.tag)
	p.hurt.connect(cb)
	v.fsm.change(&"root_charge")
	await wait_until(func() -> bool: return tags.has(&"root_wave"), 3.0)
	v.fsm.change(&"stagger")
	check(tags.has(&"root_wave"), "standing still on the line gets hit")
	p.hurt.disconnect(cb)


func test_stagger_after_poise_break() -> void:
	make_floor()
	spawn_player(Vector2(-150, 0))
	var v := _verdan(Vector2(150, 0))
	await _activate(v)
	v.fsm.change(&"idle")
	for i in 6:
		var h := HitData.make(1, Vector2.ZERO)
		h.stagger = 25.0
		v.take_hit(h)
		if v.fsm.current == &"stagger":
			break
	check_eq(v.fsm.current, &"stagger", "enough poise damage staggers the boss")
	var hp0 := v.hp
	v.take_hit(HitData.make(10, Vector2.ZERO))
	check_eq(hp0 - v.hp, 13, "staggered boss takes 30% more damage")


func test_phase_two_at_half_hp() -> void:
	make_floor()
	spawn_player(Vector2(-150, 0))
	var v := _verdan(Vector2(150, 0))
	await _activate(v)
	var phased := [false]
	var cb := func(p: int) -> void: phased[0] = p == 2
	Events.boss_phase_changed.connect(cb)
	v.take_hit(HitData.make(v.max_hp / 2 + 5, Vector2.ZERO))
	await frames(2)
	check_eq(v.fsm.current, &"phase_shift", "phase transition at 50% HP")
	check(v.is_invulnerable(), "invulnerable during the roar")
	await seconds(2.2)
	check_eq(v.phase, 2, "phase 2")
	check(phased[0], "boss_phase_changed(2) emitted")
	Events.boss_phase_changed.disconnect(cb)


func test_death_reports_defeat() -> void:
	make_floor()
	spawn_player(Vector2(-150, 0))
	var v := _verdan(Vector2(150, 0))
	await _activate(v)
	var defeated := [false]
	var cb := func(_b: Node) -> void: defeated[0] = true
	Events.boss_defeated.connect(cb)
	v.take_hit(HitData.make(99999, Vector2.ZERO))
	check(v.is_dead, "dead")
	var ok := await wait_until(func() -> bool: return defeated[0], 6.0)
	check(ok, "boss_defeated emitted after the death animation")
	Events.boss_defeated.disconnect(cb)
