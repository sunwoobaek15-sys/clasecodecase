extends TestCase
## Phase 4-1: the four new weapons (greatsword, dual blades, staff, spear)
## and crafting them at the blacksmith.

const WEAPONS := [&"item_greatsword", &"item_dual_blades", &"item_staff", &"item_spear"]


func _hero_with(item_id: StringName) -> Player:
	make_floor()
	var p := spawn_player()
	Profile.equipment[&"weapon"] = item_id
	Profile.changed.emit()
	return p


func _dummy(x: float) -> Slime:
	var s := (load("res://scenes/enemies/slime.tscn") as PackedScene).instantiate() as Slime
	s.position = Vector2(x, 0)
	add(s)
	s.max_hp = 99999
	s.hp = 99999
	return s


func test_weapon_data_complete() -> void:
	for id in WEAPONS:
		var item := ItemDB.get_item(id)
		check(item != null and item.weapon != null, "%s has a move set" % id)
		var w := item.weapon
		check(not w.combo().is_empty() and w.air_attack != null and w.heavy_attack != null and w.skill != null and w.ultimate != null,
				"%s: combo, air, heavy, skill, ultimate" % id)
		check(not item.recipe.is_empty(), "%s can be crafted" % id)
		check(item.icon != null, "%s has an icon" % id)
		check_eq(Profile.attack_category(w.skill.id), &"skill", "%s skill counts as a skill" % id)
		check_eq(Profile.attack_category(w.combo()[0].id), &"basic", "%s combo counts as basic" % id)
	check_eq(ItemDB.get_item(&"item_greatsword").weapon.combo().size(), 2, "greatsword: 2-hit combo")


func test_greatsword_is_slow_and_heavy() -> void:
	var p := _hero_with(&"item_greatsword")
	var s := _dummy(40)
	await frames(3)
	check_eq(p.weapon.id, &"greatsword", "greatsword equipped on the live hero")
	await tap(&"attack")
	await frames(2)
	check_between(p.sprite.speed_scale, 0.6, 0.7, "slow swing animation")
	var hp0 := s.hp
	await seconds(0.5)
	check(hp0 - s.hp > p.stats.attack * 1.4, "one big hit (%d dmg)" % (hp0 - s.hp))


func test_dual_blades_hit_several_times() -> void:
	var p := _hero_with(&"item_dual_blades")
	var s := _dummy(36)
	await frames(3)
	var hits := [0]
	s.hurt.connect(func(_h: HitData) -> void: hits[0] += 1)
	await tap(&"attack")
	await seconds(0.35)
	check(hits[0] >= 2, "one input = %d hits" % hits[0])
	check(p.weapon.combo()[0].crit_bonus > 0.1, "dual blades crit bonus")


func test_staff_shoots_bolts() -> void:
	var p := _hero_with(&"item_staff")
	var s := _dummy(160)
	await frames(3)
	var hp0 := s.hp
	await tap(&"attack")
	var shot := false
	for i in 30:
		await tree().physics_frame
		for c in runner.get_children():
			if c is Projectile and (c as Projectile).source == p:
				shot = true
	check(shot, "attack fires a magic bolt")
	await seconds(0.8)
	check(s.hp < hp0, "the bolt hits a slime 160 px away")


func test_spear_reaches_far() -> void:
	var p := _hero_with(&"item_spear")
	var s := _dummy(90)
	await frames(3)
	var hp0 := s.hp
	await tap(&"attack")
	await seconds(0.4)
	check(s.hp < hp0, "thrust hits a slime 90 px away (sword reach is ~50 px)")
	check(p != null, "player alive")


func test_weapon_skills() -> void:
	# greatsword shockwave, staff nova, spear dash
	for id in [&"item_greatsword", &"item_staff", &"item_spear"]:
		var p := _hero_with(id)
		var s := _dummy(120)
		await frames(3)
		p.mp = p.stats.max_mp
		var x0 := p.global_position.x
		var hp0 := s.hp
		await tap(&"skill")
		await seconds(1.0)
		check(s.hp < hp0, "%s skill hits a slime 120 px away" % id)
		if id == &"item_spear":
			check(p.global_position.x - x0 > 100.0, "spear skill dashes forward (%.0f px)" % (p.global_position.x - x0))
		cleanup()
		await frames(3)


func test_dual_dash_is_invulnerable() -> void:
	var p := _hero_with(&"item_dual_blades")
	await frames(3)
	p.mp = p.stats.max_mp
	await tap(&"skill")
	await frames(3)
	check_eq(p.fsm.current, &"skill", "dash skill running")
	check(p.is_invulnerable(), "invulnerable while dashing")


func test_crafting() -> void:
	Profile.reset(true)
	check(not Profile.can_craft(&"item_greatsword"), "nothing to pay with")
	check(Profile.craft_missing(&"item_greatsword").contains("골드"), "missing gold listed")
	Profile.add_gold(1000)
	Profile.inventory.add(&"item_slime_gel", 15)
	Village.arrived = true
	Village.restored_ids[&"smithy"] = true
	Quests.refresh()
	check(Quests.accept(&"q_sub_craft"), "craft quest accepted")
	check(Profile.craft(&"item_greatsword"), "greatsword crafted")
	check_eq(Profile.gold, 700, "300 G paid")
	check_eq(Profile.inventory.count(&"item_slime_gel"), 0, "15 gel used")
	check(Profile.owns(&"item_greatsword"), "in the bag")
	check(not Profile.can_craft(&"item_greatsword"), "unique: cannot craft twice")
	check(Profile.equip(&"item_greatsword"), "can be equipped")
	await frames(1)
	check_eq(Quests.status(&"q_sub_craft"), "ready", "craft quest objective done")
	check(Codex.is_known(&"item_greatsword"), "recorded in the codex")


func test_attacks_reach_small_slimes() -> void:
	# a thrust that passes over 16 px tall enemies made the spear useless
	for id in WEAPONS:
		var w: WeaponData = ItemDB.get_item(id).weapon
		var atks: Array[AttackData] = w.combo()
		atks.append(w.heavy_attack)
		for a in atks:
			if a.projectile_tex != null:
				continue  # ranged: aim assist handles height
			check(a.hitbox.end.y >= -12.0, "%s %s reaches the ground (bottom %.0f)" % [id, a.id, a.hitbox.end.y])
