extends TestCase
## Forest slime AI (state machine) and its variants.


func _slime(variant: Slime.Variant, pos: Vector2) -> Slime:
	var s := (load("res://scenes/enemies/slime.tscn") as PackedScene).instantiate() as Slime
	s.variant = variant
	s.position = pos
	add(s)
	return s


func _projectiles() -> int:
	var n := 0
	for c in runner.get_children():
		if c is Projectile:
			n += 1
	return n


func test_idle_then_patrol_without_player() -> void:
	make_floor()
	var s := _slime(Slime.Variant.NORMAL, Vector2(0, 0))
	await seconds(0.3)
	check_eq(s.fsm.current, &"idle", "starts idle")
	var patrolled := await wait_until(func() -> bool: return s.fsm.current == &"patrol", 3.0)
	check(patrolled, "starts patrolling")
	await seconds(2.0)
	check(absf(s.global_position.x) <= s.patrol_range + 8.0, "stays within its patrol range")


func test_notices_and_hurts_player() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var s := _slime(Slime.Variant.NORMAL, Vector2(150, 0))
	var noticed := await wait_until(func() -> bool: return s.fsm.current in [&"chase", &"shot", &"splash"], 3.0)
	check(noticed, "notices the player")
	var hurt := await wait_until(func() -> bool: return p.hp < p.max_hp, 8.0)
	check(hurt, "damages the player (shot, splash or contact)")


func test_slime_shot_fires_projectile() -> void:
	make_floor()
	spawn_player(Vector2(0, 0))
	var s := _slime(Slime.Variant.NORMAL, Vector2(140, 0))
	await frames(3)
	s.fsm.change(&"chase")
	var fired := await wait_until(func() -> bool: return _projectiles() > 0, 3.0)
	check(fired, "slime shot creates a projectile")


func test_area_splash_up_close() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var s := _slime(Slime.Variant.NORMAL, Vector2(28, 0))
	await frames(3)
	s.fsm.change(&"chase")
	var splashed := await wait_until(func() -> bool: return s.fsm.current == &"splash", 2.0)
	check(splashed, "uses the area splash at close range")
	var hit := await wait_until(func() -> bool: return p.hp < p.max_hp, 2.0)
	check(hit, "splash damages the player")


func test_dies_and_is_removed() -> void:
	make_floor()
	var s := _slime(Slime.Variant.NORMAL, Vector2(60, 0))
	await frames(5)
	var killed := [false]
	var cb := func(_e: Node) -> void: killed[0] = true
	Events.enemy_killed.connect(cb)
	s.take_hit(HitData.make(999, Vector2(100, -50)))
	check(s.is_dead, "dead")
	check_eq(s.fsm.current, &"dead", "dead state")
	check(killed[0], "enemy_killed emitted")
	var ref: WeakRef = weakref(s)
	var gone := await wait_until(func() -> bool: return ref.get_ref() == null, 3.0)
	check(gone, "removed after the death animation")
	Events.enemy_killed.disconnect(cb)


func test_variants() -> void:
	make_floor()
	var small := _slime(Slime.Variant.SMALL, Vector2(-100, 0))
	var elite := _slime(Slime.Variant.ELITE, Vector2(100, 0))
	await frames(3)
	check_eq(small.max_hp, 18, "small slime HP")
	check_eq(small.sprite.sprite_frames.resource_path,
			"res://assets/enemies/forest_slime_small/slime_small_frames.tres", "small slime uses the small sprites")
	check_eq(elite.max_hp, 120, "elite slime HP")
	elite.fsm.change(&"idle")
	elite.take_hit(HitData.make(5, Vector2(100, 0)))
	await frames(1)
	check(elite.fsm.current != &"hurt", "elite ignores a light hit (super armour)")
	var big := HitData.make(5, Vector2(100, 0))
	big.stagger = 40.0
	elite.invuln_time = 0.0
	elite.take_hit(big)
	await frames(1)
	check_eq(elite.fsm.current, &"hurt", "a heavy hit breaks the elite's poise")


func test_player_combo_kills_slime() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, 0))
	var s := _slime(Slime.Variant.SMALL, Vector2(36, 0))
	await frames(3)
	var ref: WeakRef = weakref(s)
	for i in 6:
		await tap(&"attack", 2)
		await seconds(0.18)
		if ref.get_ref() == null or s.is_dead:
			break
	check(ref.get_ref() == null or s.is_dead, "player can defeat a slime with attacks")
	check(p.combo_hits >= 1 or Game.run.get("kills", 0) >= 1, "hit/kill counted")
