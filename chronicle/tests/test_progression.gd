extends TestCase
## Phase 2 growth: EXP/levels, inventory, equipment, skills, potions, drops.


func before_each() -> void:
	Profile.reset(false)


func after_each() -> void:
	Profile.reset(false)


func test_exp_curve_and_level_up() -> void:
	check_eq(Profile.exp_to_next(1), 30, "Lv1 -> 2 needs 30 EXP")
	check(Profile.exp_to_next(5) > Profile.exp_to_next(4), "curve grows")
	var leveled := [0]
	var cb := func(_l: int) -> void: leveled[0] += 1
	Profile.leveled_up.connect(cb)
	check_eq(Profile.add_exp(29), 0, "29 EXP is not a level")
	check_eq(Profile.add_exp(1), 1, "30 EXP -> level 2")
	check_eq(Profile.level, 2, "level 2")
	check_eq(Profile.xp, 0, "EXP carries over to 0")
	check_eq(Profile.skill_points, 1, "1 skill point per level")
	check_eq(Profile.add_exp(1000), 7, "big EXP gives several levels at once")
	check(leveled[0] >= 2, "leveled_up emitted")
	Profile.leveled_up.disconnect(cb)
	Profile.add_exp(1000000)
	check_eq(Profile.level, Profile.MAX_LEVEL, "level is capped")


func test_level_raises_stats() -> void:
	var base := load("res://data/player/hero_stats.tres") as PlayerStats
	var s1 := Profile.build_stats(base)
	Profile.add_exp(30 + 55)
	var s3 := Profile.build_stats(base)
	check_eq(Profile.level, 3, "level 3")
	check_eq(s3.max_hp - s1.max_hp, 2 * Profile.HP_PER_LEVEL, "HP grows per level")
	check_eq(s3.attack - s1.attack, 2 * Profile.ATTACK_PER_LEVEL, "attack grows per level")
	check(s3.max_mp > s1.max_mp, "MP grows")
	check_eq(base.max_hp, 120, "base resource is not modified")


func test_inventory_stacks_and_limits() -> void:
	var inv := Profile.inventory
	check_eq(inv.add(&"item_potion_small", 12), 12, "12 potions added")
	check_eq(inv.slots.size(), 2, "max stack 9 -> two stacks")
	check_eq(inv.count(&"item_potion_small"), 12, "count across stacks")
	check(inv.remove(&"item_potion_small", 10), "remove 10")
	check_eq(inv.count(&"item_potion_small"), 2, "2 left")
	check(not inv.remove(&"item_potion_small", 5), "cannot remove more than owned")
	check_eq(inv.add(&"no_such_item", 1), 0, "unknown items are refused")
	for i in Inventory.MAX_SLOTS:
		inv.add(&"item_sword_forest", 1)
	check_eq(inv.slots.size(), Inventory.MAX_SLOTS, "bag is full")
	check_eq(inv.add(&"item_ring_time", 1), 0, "nothing fits into a full bag")


func test_equipment_changes_stats_and_player() -> void:
	var p := spawn_player()
	make_floor()
	await frames(2)
	var atk0 := p.stats.attack
	var hp0 := p.max_hp
	Profile.inventory.add(&"item_sword_forest", 1)
	Profile.inventory.add(&"item_armor_guardian", 1)
	check(Profile.equip(&"item_sword_forest"), "equip sword")
	check(Profile.equip(&"item_armor_guardian"), "equip armour")
	check_eq(p.stats.attack, atk0 + 4, "live player gets +4 attack")
	check_eq(p.max_hp, hp0 + 40, "live player gets +40 HP")
	check_eq(p.hp, p.max_hp, "extra max HP is added to current HP")
	check_eq(Profile.inventory.count(&"item_sword_forest"), 0, "equipped item leaves the bag")
	check_between(Profile.defense(), 0.119, 0.121, "armour gives 12% damage reduction")
	p.take_hit(HitData.make(50, Vector2.ZERO))
	check_eq(hp0 + 40 - p.hp, 44, "50 damage reduced to 44")
	check(Profile.unequip(&"armor"), "unequip armour")
	check_eq(Profile.inventory.count(&"item_armor_guardian"), 1, "armour back in the bag")
	check(not Profile.unequip(&"weapon"), "the weapon slot is never empty")
	check(not Profile.equip(&"item_potion_small"), "potions cannot be equipped")


func test_skill_tree_upgrades() -> void:
	check(Profile.skill_tree.size() >= 5, "skill tree loaded (%d nodes)" % Profile.skill_tree.size())
	check(not Profile.upgrade_skill(&"node_crescent_mastery"), "no skill point -> no upgrade")
	Profile.add_exp(30)
	check(Profile.upgrade_skill(&"node_crescent_mastery"), "upgrade with 1 SP")
	check_eq(Profile.skill_rank(&"node_crescent_mastery"), 1, "rank 1")
	check_between(Profile.damage_multiplier(&"skill"), 1.19, 1.21, "skill damage +20%")
	check_between(Profile.skill_cooldown_reduction(), 0.29, 0.31, "skill cooldown -0.3 s")
	check_eq(Profile.damage_multiplier(&"combo1"), 1.0, "basic attacks unchanged")
	Profile.add_exp(10000)
	check(not Profile.can_upgrade_skill(&"no_node"), "unknown node")
	for i in 5:
		Profile.upgrade_skill(&"node_crescent_mastery")
	check_eq(Profile.skill_rank(&"node_crescent_mastery"), 3, "rank capped at max level")


func test_skill_upgrade_affects_player_skill() -> void:
	var p := spawn_player()
	make_floor()
	await frames(2)
	Profile.add_exp(30)
	Profile.upgrade_skill(&"node_crescent_mastery")
	await seconds(0.3)
	await tap(&"skill")
	await frames(3)
	check_eq(p.fsm.current, &"skill", "skill used")
	check_between(p._skill_cd_total, 2.19, 2.21, "cooldown 2.5 - 0.3 s")


func test_potion_quick_use() -> void:
	var p := spawn_player()
	make_floor()
	await seconds(0.3)
	check(not p.use_potion(), "no potion in the bag")
	Profile.inventory.add(&"item_potion_small", 2)
	check(not p.use_potion(), "full HP -> potion kept")
	check_eq(Profile.inventory.count(&"item_potion_small"), 2, "still 2")
	p.take_hit(HitData.make(60, Vector2.ZERO))
	await seconds(1.3)
	await tap(&"use_potion")
	await frames(2)
	check_eq(p.hp, 100, "60 -> 100 HP (+40)")
	check_eq(Profile.inventory.count(&"item_potion_small"), 1, "one potion used")


func test_kill_rewards_and_drops() -> void:
	make_floor()
	spawn_player(Vector2(-200, 0))
	var s := (load("res://scenes/enemies/slime.tscn") as PackedScene).instantiate() as Slime
	s.variant = Slime.Variant.ELITE
	s.position = Vector2(60, 0)
	add(s)
	await frames(3)
	s.take_hit(HitData.make(9999, Vector2.ZERO))
	await frames(3)
	check_eq(Profile.level, 2, "elite slime EXP (30) gives level 2")
	check_eq(Profile.gold, 15, "gold reward")
	var drops: Array[Pickup] = []
	for c in runner.get_children():
		if c is Pickup and (c as Pickup).kind == Pickup.Kind.ITEM:
			drops.append(c)
	var ids: Array[StringName] = []
	for d in drops:
		ids.append(d.item_id)
	check(ids.has(&"item_sword_forest"), "elite drops the forest sword (%s)" % str(ids))
	# walking over the drops collects them
	var p := tree().get_first_node_in_group(&"player") as Player
	for d in drops:
		if is_instance_valid(d):
			p.global_position = d.global_position + Vector2(0, 8)
			await frames(4)
	check_eq(Profile.inventory.count(&"item_sword_forest"), 1, "sword collected into the bag")
	# a unique item is not dropped again
	var s2 := (load("res://scenes/enemies/slime.tscn") as PackedScene).instantiate() as Slime
	s2.variant = Slime.Variant.ELITE
	s2.position = Vector2(140, 0)
	add(s2)
	await frames(3)
	s2.take_hit(HitData.make(9999, Vector2.ZERO))
	await frames(3)
	var again := 0
	for c in runner.get_children():
		if c is Pickup and (c as Pickup).item_id == &"item_sword_forest" and not c.is_queued_for_deletion():
			again += 1
	check_eq(again, 0, "unique sword is not dropped twice")
