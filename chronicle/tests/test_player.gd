extends TestCase
## Player controller: movement, jump, dodge, combo, heavy, skill, ultimate,
## damage handling. Input is sent as actions, exactly like the touch UI.


class Dummy:
	extends Node2D
	var hits: Array[HitData] = []

	func take_hit(h: HitData) -> bool:
		hits.append(h)
		return true

	func tagged(tag: StringName) -> Array[HitData]:
		var out: Array[HitData] = []
		for h in hits:
			if h.tag == tag:
				out.append(h)
		return out


func _dummy(pos: Vector2) -> Dummy:
	var d := Dummy.new()
	d.position = pos
	var hb := Hurtbox.new()
	hb.collision_layer = Hitbox.LAYER_ENEMY_HURTBOX
	var cs := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = Vector2(20, 40)
	cs.shape = r
	cs.position = Vector2(0, -20)
	hb.add_child(cs)
	hb.entity = d
	d.add_child(hb)
	add(d)
	return d


func test_lands_on_floor_and_idles() -> void:
	make_floor()
	var p := spawn_player(Vector2(0, -40))
	await seconds(0.7)
	check(p.is_on_floor(), "lands on the floor")
	check_eq(p.fsm.current, &"ground", "ground state")
	check_between(p.global_position.y, -1.0, 1.0, "feet on the floor")
	check_eq(p.sprite.animation, &"idle", "idle animation")


func test_run_and_walk() -> void:
	make_floor()
	var p := spawn_player()
	await seconds(0.3)
	Input.action_press(&"move_right", 1.0)
	await seconds(0.5)
	check_between(p.velocity.x, 118.0, 126.0, "full stick runs")
	check_eq(p.sprite.animation, &"run", "run animation")
	check_eq(p.facing, 1, "faces right")
	Input.action_release(&"move_right")
	Input.action_press(&"move_left", 0.4)
	await seconds(0.5)
	check_between(p.velocity.x, -63.0, -55.0, "light stick walks")
	check_eq(p.sprite.animation, &"walk", "walk animation")
	check_eq(p.facing, -1, "faces left")
	check(p.visual.scale.x < 0.0, "sprite mirrored")
	Input.action_release(&"move_left")


func test_jump_height_and_variable_jump() -> void:
	make_floor()
	var p := spawn_player()
	await seconds(0.3)
	var y0 := p.global_position.y
	press(&"jump")
	var top := y0
	for i in 50:
		await frames(1)
		top = minf(top, p.global_position.y)
	release(&"jump")
	var full := y0 - top
	check_between(full, 58.0, 75.0, "held jump height")
	await seconds(0.8)
	check(p.is_on_floor(), "lands again")
	press(&"jump")
	await frames(2)
	release(&"jump")
	top = y0
	for i in 50:
		await frames(1)
		top = minf(top, p.global_position.y)
	check(y0 - top < full * 0.6, "tap jump is lower (%.1f vs %.1f)" % [y0 - top, full])


func test_coyote_time() -> void:
	var body := StaticBody2D.new()
	var cs := CollisionShape2D.new()
	var r := RectangleShape2D.new()
	r.size = Vector2(400, 64)
	cs.shape = r
	cs.position = Vector2(-200, 32)
	body.add_child(cs)
	add(body)
	var p := spawn_player(Vector2(-40, 0))
	await seconds(0.3)
	Input.action_press(&"move_right", 1.0)
	var left := await wait_until(func() -> bool: return not p.is_on_floor(), 2.0)
	check(left, "walked off the ledge")
	await frames(3)
	press(&"jump")
	await frames(2)
	release(&"jump")
	Input.action_release(&"move_right")
	check(p.velocity.y < -150.0, "jump still works a few frames after leaving the ledge")


func test_dodge_iframes_and_distance() -> void:
	make_floor()
	var p := spawn_player()
	await seconds(0.3)
	var x0 := p.global_position.x
	await tap(&"dodge", 2)
	await frames(2)
	check_eq(p.fsm.current, &"dodge", "dodge state")
	check(p.is_invulnerable(), "invulnerable while dodging")
	check(not p.take_hit(HitData.make(10, Vector2.ZERO)), "hits are ignored during the dodge")
	check_eq(p.hp, p.max_hp, "no damage taken")
	await seconds(0.5)
	check_between(p.global_position.x - x0, 50.0, 100.0, "dodge distance")
	check(not p.is_invulnerable(), "vulnerable after the dodge")


func test_three_hit_combo() -> void:
	make_floor()
	var p := spawn_player()
	var d := _dummy(Vector2(34, 0))
	await seconds(0.3)
	for i in 3:
		await tap(&"attack", 2)
		await seconds(0.2)
	await seconds(0.6)
	check_eq(d.hits.size(), 3, "three combo hits")
	if d.hits.size() == 3:
		check_eq(d.hits[0].tag, &"combo1", "first hit")
		check_eq(d.hits[1].tag, &"combo2", "second hit")
		check_eq(d.hits[2].tag, &"combo3", "finisher")
		check(d.hits[2].damage > d.hits[0].damage, "finisher hits harder")
		check(d.hits[0].knockback.x > 0.0, "knock-back pushes away from the player")
	check(p.ult > 0.0, "hits charge the ultimate gauge")
	check_eq(p.fsm.current, &"ground", "back to ground after the combo")


func test_hold_attack_for_heavy() -> void:
	make_floor()
	var p := spawn_player()
	var d := _dummy(Vector2(40, 0))
	await seconds(0.3)
	press(&"attack")
	await seconds(1.2)
	check_eq(p.fsm.current, &"charge", "holding attack enters the charge stance")
	release(&"attack")
	await seconds(0.7)
	var heavy := d.tagged(&"heavy")
	check_eq(heavy.size(), 1, "heavy slash lands once")
	if heavy.size() == 1:
		check(heavy[0].damage >= 30, "fully charged heavy damage (%d)" % heavy[0].damage)


func test_skill_costs_mana_and_fires_wave() -> void:
	make_floor()
	var p := spawn_player()
	var d := _dummy(Vector2(150, 0))
	await seconds(0.3)
	var mp0 := p.mp
	await tap(&"skill")
	await frames(4)
	check_eq(p.fsm.current, &"skill", "skill state")
	check(p.mp <= mp0 - 14.0, "MP spent")
	await seconds(0.9)
	check_eq(d.tagged(&"crescent").size(), 1, "crescent wave reaches a far target once")
	await tap(&"skill")
	await frames(4)
	check(p.fsm.current != &"skill", "skill is on cooldown")


func test_ultimate_requires_full_gauge() -> void:
	make_floor()
	var p := spawn_player()
	var d := _dummy(Vector2(90, 0))
	await seconds(0.3)
	await tap(&"ultimate")
	await frames(3)
	check(p.fsm.current != &"ultimate", "not usable with an empty gauge")
	p.add_ult(100.0)
	await tap(&"ultimate")
	await frames(3)
	check_eq(p.fsm.current, &"ultimate", "starts with a full gauge")
	check(p.is_invulnerable(), "invulnerable during the ultimate")
	await seconds(1.6)
	check_eq(d.tagged(&"ultimate").size(), 4, "four pillar hits")
	check_eq(p.ult, 0.0, "gauge consumed")


func test_hurt_knockback_and_iframes() -> void:
	make_floor()
	var p := spawn_player()
	await seconds(0.3)
	check(p.take_hit(HitData.make(20, Vector2(-150, -100))), "hit taken")
	check_eq(p.hp, 100, "HP reduced")
	await frames(2)
	check_eq(p.fsm.current, &"hurt", "hurt state")
	check(p.velocity.x < 0.0, "knocked back")
	check(not p.take_hit(HitData.make(20, Vector2.ZERO)), "invulnerable right after a hit")
	await seconds(1.2)
	check(p.take_hit(HitData.make(5, Vector2.ZERO)), "vulnerable again later")


func test_death_reports_game_over() -> void:
	make_floor()
	var p := spawn_player()
	await seconds(0.3)
	var died := [false]
	var cb := func() -> void: died[0] = true
	Events.player_died.connect(cb)
	p.take_hit(HitData.make(999, Vector2.ZERO))
	check(p.is_dead, "dead")
	var ok := await wait_until(func() -> bool: return died[0], 6.0)
	check(ok, "player_died emitted after the death animation")
	Events.player_died.disconnect(cb)


func test_fall_out_respawns_with_damage() -> void:
	make_floor(200.0)
	var p := spawn_player(Vector2(0, 0))
	p.kill_y = 400.0
	await seconds(0.6)
	Input.action_press(&"move_right", 1.0)
	var fell := await wait_until(func() -> bool: return p.hp < p.max_hp, 4.0)
	Input.action_release(&"move_right")
	check(fell, "falling into a pit costs HP")
	check(p.global_position.y < 10.0, "respawned on safe ground")
