extends TestCase
## Phase 4-2: relics (30 passive trinkets, equipped in 3-4 slots) and the
## job advancement (검성 / 수호기사 / 시간술사) at the priest Serena.


func before_each() -> void:
	SaveSystem.delete_save()
	Game.reset_progress(false)
	Game.location = "stage"


func after_each() -> void:
	SaveSystem.delete_save()
	Game.reset_progress(false)
	Game.location = "stage"


## A level-1 hero that keeps the relics / job set up before it spawns
## (spawn_player() would reset the profile).
func _hero() -> Player:
	make_floor()
	var p := (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	p.stats = p.stats.duplicate()
	p.stats.crit_chance = 0.0
	add(p)
	return p


func _slime(x: float = 60.0) -> Slime:
	var s := (load("res://scenes/enemies/slime.tscn") as PackedScene).instantiate() as Slime
	s.position = Vector2(x, 0)
	add(s)
	return s


func _all_reward_sources() -> Dictionary:
	var found := {}
	for r in DataDir.load_all("res://data/enemies"):
		for d in (r as EnemyStats).drops:
			found[StringName(str((d as Dictionary).get("id", "")))] = "drop"
	for q in Quests.quests:
		for id in q.reward_items:
			found[StringName(str(id))] = "quest"
	for r in DataDir.load_all("res://data/stages"):
		for id in (r as StageData).chest_items:
			found[StringName(str(id))] = "chest"
	for id in VillagePanels.ShopPanel.RELIC_STOCK:
		found[id] = "shop"
	return found


func test_relic_and_job_data() -> void:
	var relics := RelicDB.all()
	check_eq(relics.size(), 30, "30 relics")
	var sources := _all_reward_sources()
	var ids := {}
	var rarities := {}
	for r in relics:
		ids[r.id] = true
		rarities[r.rarity] = true
		check(r.icon != null and r.icon.get_width() == 24, "%s has a 24px icon" % r.id)
		check(not r.bonuses.is_empty() and r.source != "" and r.description != "", "%s: bonuses, source, text" % r.id)
		for key in r.bonuses:
			check(Profile.STAT_KEYS.has(StringName(key)), "%s: known stat %s" % [r.id, key])
		check(sources.has(r.id), "%s can be obtained somewhere" % r.id)
	check_eq(ids.size(), 30, "relic ids are unique")
	check_eq(rarities.size(), 4, "all four rarities used")
	var jobs := JobData.all()
	check_eq(jobs.size(), 3, "3 jobs")
	for j in jobs:
		check(j.icon != null and not j.bonuses.is_empty(), "%s: emblem and bonuses" % j.id)
		for key in j.bonuses:
			check(Profile.STAT_KEYS.has(StringName(key)), "%s: known stat %s" % [j.id, key])


func test_collect_equip_and_slots() -> void:
	check_eq(Profile.relic_slots(), 3, "3 slots before the job")
	for id in [&"relic_slime_core", &"relic_amethyst", &"relic_cloud_drop", &"relic_storm_scale"]:
		check(Profile.add_relic(id, true), "%s collected" % id)
	check_eq(Profile.relic_equipped.size(), 3, "the first three are equipped automatically")
	check(not Profile.is_relic_equipped(&"relic_storm_scale"), "no free slot for the 4th")
	check(not Profile.equip_relic(&"relic_storm_scale"), "cannot equip with every slot full")
	check_eq(roundi(Profile.mod(&"attack")), 0, "unequipped relic gives nothing")
	check_between(Profile.mod(&"crit_chance"), 0.039, 0.041, "amethyst +4% crit")
	check(Profile.unequip_relic(&"relic_amethyst"), "unequip")
	check(Profile.equip_relic(&"relic_storm_scale"), "equip into the freed slot")
	check_eq(roundi(Profile.mod(&"attack")), 6, "storm scale +6 attack")
	check_between(Profile.mod(&"crit_chance"), 0.029, 0.031, "storm scale +3% crit")
	var base := load("res://data/player/hero_stats.tres") as PlayerStats
	check_eq(Profile.build_stats(base).max_hp, base.max_hp + 15, "slime core +15 max HP reaches the stats")
	var gold := Profile.gold
	check_eq(Profile.give(&"relic_amethyst"), 1, "a duplicate is taken")
	check_eq(Profile.relics.size(), 4, "but not collected twice")
	check_eq(Profile.gold, gold + 50, "it turns into gold")
	check_eq(Profile.give(&"item_potion_small", 2), 2, "give() still adds normal items")
	check_eq(Profile.inventory.count(&"item_potion_small"), 2, "potions in the bag")


func test_relic_effects_in_combat() -> void:
	for id in [&"relic_vampire_ring", &"relic_chronos_gear", &"relic_phoenix_feather"]:
		Profile.add_relic(id, true)
	var p := _hero()
	await frames(3)
	check_eq(roundi(p.ult), 25, "chronos gear: stage starts with 25% ultimate gauge")
	check_eq(p.revives_left, 1, "phoenix feather: one revive")
	p.hp = 50
	p.call(&"_lifesteal", 100)
	check_eq(p.hp, 53, "vampire ring: 3% of 100 damage healed")
	var hit := HitData.make(9999, Vector2(-50, -50), null, &"test")
	p.take_hit(hit)
	await frames(2)
	check(not p.is_dead, "the lethal hit is survived")
	check_eq(p.hp, 1 + roundi(p.max_hp * Player.REVIVE_HEAL), "revived with 40% HP")
	check_eq(p.revives_left, 0, "revive used")
	check(p.is_invulnerable(), "a moment of invulnerability")
	p.invuln_time = 0.0
	p.take_hit(HitData.make(9999, Vector2.ZERO, null, &"test"))
	await frames(2)
	check(p.is_dead, "only once per stage")


func test_kill_regen_and_potion_relics() -> void:
	for id in [&"relic_puff_tuft", &"relic_tiny_cog", &"relic_verdan_seed"]:
		Profile.add_relic(id, true)
	var p := _hero()
	await frames(3)
	p.hp = 40
	p.mp = 0.0
	var s := _slime(300)
	await frames(2)
	Events.enemy_killed.emit(s)
	check_eq(p.hp, 42, "puff tuft: +2 HP on kill")
	check(p.mp >= 2.0, "tiny cog: +2 MP on kill (%.1f)" % p.mp)
	var hp0 := p.hp
	await seconds(5.2)
	check_eq(p.hp, hp0 + 2, "verdan seed: +2 HP every 5 s without a pet")
	# potion: herb pouch +20
	Profile.unequip_relic(&"relic_puff_tuft")
	Profile.add_relic(&"relic_herb_pouch", true)
	Profile.equip_relic(&"relic_herb_pouch")
	Profile.inventory.add(Profile.POTION_ID, 1)
	p.hp = 10
	var heal := ItemDB.get_item(Profile.POTION_ID).heal_hp
	check(p.use_potion(), "potion used")
	check_eq(p.hp, 10 + heal + 20, "herb pouch: potion heals 20 more")


func test_relic_drops_and_rewards() -> void:
	var s := _slime(0)
	await frames(2)
	s.stats = s.stats.duplicate()
	s.stats.drops = [{"id": &"relic_slime_core", "chance": 1.0, "count": 1}]
	s.spawn_drops()
	var drop: Pickup = null
	for c in runner.get_children():
		if c is Pickup and (c as Pickup).item_id == &"relic_slime_core":
			drop = c
	check(drop != null, "a monster can drop a relic")
	check(drop != null and drop.sprite.texture == RelicDB.get_relic(&"relic_slime_core").icon, "drop shows the relic icon")
	if drop != null:
		check(drop.collect_item(), "picked up")
	check(Profile.owns_relic(&"relic_slime_core"), "relic collected")
	check(Codex.is_known(&"relic_slime_core"), "recorded in the codex")
	await frames(2)
	s.spawn_drops()
	var again := 0
	for c in runner.get_children():
		if c is Pickup and (c as Pickup).item_id == &"relic_slime_core" and not c.is_queued_for_deletion():
			again += 1
	check_eq(again, 0, "an owned relic is not dropped again")
	# quest / achievement reward
	Quests.notify(&"boss", "verdan")
	await frames(1)
	check_eq(Quests.status(&"ach_first_boss"), "done", "achievement done")
	check(Profile.owns_relic(&"relic_first_victory"), "achievement reward relic")
	check(Quests.quest(&"ach_first_boss").reward_text().contains("첫 승리의 훈장"), "reward text names the relic")
	# collector achievement
	for r in RelicDB.all().slice(0, 10):
		Profile.add_relic(r.id, true)
	await frames(2)
	check_eq(Quests.status(&"ach_relics10"), "done", "10 relics achievement")
	check(Profile.owns_relic(&"relic_star_compass"), "star compass for the collector")


func test_job_advancement() -> void:
	Village.arrived = true
	Village.restored_ids[&"training"] = true
	Quests.refresh()
	check_eq(Quests.status(&"q_sub_job"), "locked", "needs Chronos (q_main_06) first")
	Quests.state[&"q_main_06"] = {"status": "done", "progress": [1], "date": ""}
	Quests.refresh()
	check_eq(Quests.status(&"q_sub_job"), "available", "offered after Chronos")
	check(Quests.accept(&"q_sub_job"), "accepted")
	check(Profile.job_blocker(&"blade_master").contains("레벨"), "level 12 needed")
	check(not Profile.set_job(&"blade_master"), "too low")
	while Profile.level < Profile.JOB_LEVEL:
		Profile.add_exp(Profile.exp_to_next(Profile.level))
	await frames(1)  # level achievements pay out first
	var gold := Profile.gold
	check(Profile.set_job(&"blade_master"), "advanced to 검성")
	check_eq(Profile.gold, gold, "the first job is free")
	check_eq(Profile.relic_slots(), 4, "one more relic slot")
	check_eq(roundi(Profile.mod(&"attack")), 6, "검성 +6 attack")
	var base := load("res://data/player/hero_stats.tres") as PlayerStats
	check_between(Profile.build_stats(base).crit_multiplier, base.crit_multiplier + 0.19, base.crit_multiplier + 0.21,
			"검성 crit damage +20%")
	await frames(1)
	check_eq(Quests.status(&"q_sub_job"), "ready", "quest objectives done")
	check(Quests.turn_in(&"q_sub_job"), "handed in")
	check(Profile.owns_relic(&"relic_time_hourglass"), "hourglass reward")
	check(Profile.is_relic_equipped(&"relic_time_hourglass"), "equipped in a free slot")
	check(Profile.job_blocker(&"chronomancer").contains("골드"), "changing costs gold")
	Profile.add_gold(Profile.JOB_CHANGE_COST)
	gold = Profile.gold
	check(Profile.set_job(&"chronomancer"), "changed to 시간술사")
	check_eq(Profile.gold, gold - Profile.JOB_CHANGE_COST, "500 G paid")
	check_eq(roundi(Profile.mod(&"attack")), 0, "검성 bonus gone")
	check_between(Profile.mod(&"skill_cooldown"), 0.79, 0.81, "시간술사 0.5 s + hourglass 0.3 s cooldown")


func test_relics_and_job_saved() -> void:
	Profile.reset(true)
	Profile.level = 12
	Profile.set_job(&"guardian_knight")
	for id in [&"relic_slime_core", &"relic_amethyst", &"relic_cloud_drop", &"relic_storm_scale", &"relic_wind_core"]:
		Profile.add_relic(id, true)
	Profile.unequip_relic(&"relic_amethyst")
	var eq := Profile.relic_equipped.duplicate()
	check(SaveSystem.save_game(), "saved")
	Game.reset_progress(false)
	check_eq(Profile.relics.size(), 0, "reset")
	check(SaveSystem.load_game(), "loaded")
	check_eq(Profile.job, &"guardian_knight", "job kept")
	check_eq(Profile.relics.size(), 5, "collection kept")
	check_eq(Profile.relic_equipped, eq, "equipped relics kept in order")
	check(not Profile.is_relic_equipped(&"relic_amethyst"), "unequipped stays unequipped")


func test_codex_relic_book() -> void:
	check_eq(Codex.entries_in(&"relic").size(), 30, "30 relic entries")
	check_eq(Codex.count_total(), 54, "codex total (10 monsters, 3 bosses, 6 weapons, 5 pets, 30 relics)")
	for e in Codex.entries:
		check(not e.get("future", false), "no placeholder left (%s)" % e["id"])
	Profile.add_relic(&"relic_wind_core", true)
	check(Codex.is_known(&"relic_wind_core"), "relic recorded when found")


func test_village_job_panel_and_shop() -> void:
	Village.arrived = true
	for f in [&"shop", &"training"]:
		Village.restored_ids[f] = true
	Quests.state[&"q_main_06"] = {"status": "done", "progress": [1], "date": ""}
	Quests.refresh()
	Quests.accept(&"q_sub_job")
	Profile.level = 12
	Profile.add_gold(2000)
	Game.location = "village"
	var v := (load("res://scenes/village/village.tscn") as PackedScene).instantiate() as Node2D
	add(v)
	await seconds(0.5)
	v.call("talk_to", &"priest_serena")
	await frames(2)
	var d: DialogueBox = v.get("dialogue")
	check(d.choose_containing("전직"), "Serena offers the job advancement")
	await frames(2)
	var jp: ModalPanel = v.get("panels")["job"]
	check(jp.visible, "job window open")
	jp.call(&"_pick", &"guardian_knight")
	check_eq(Profile.job, &"guardian_knight", "picked 수호기사")
	jp.close()
	await frames(2)
	var sp: ModalPanel = v.get("panels")["shop"]
	sp.open()
	await frames(1)
	var gold := Profile.gold
	sp.call(&"_buy_relic", &"relic_vampire_ring")
	check(Profile.owns_relic(&"relic_vampire_ring"), "relic bought")
	check_eq(Profile.gold, gold - 1500, "1500 G")
	sp.call(&"_buy_relic", &"relic_vampire_ring")
	check_eq(Profile.gold, gold - 1500, "cannot buy twice")
	sp.close()
	await frames(1)
	var menu: Control = v.get("character_menu")
	menu.call(&"open")
	menu.call(&"show_tab", "유물")
	await frames(2)
	var tabs := menu.find_children("*", "TabContainer", true, false)
	var tc := tabs[0] as TabContainer
	check_eq(tc.get_tab_title(tc.current_tab), "유물", "relic tab exists")
	check(tc.get_current_tab_control().find_children("*", "Button", true, false).size() >= 30 + 4,
			"relic book (30) and 4 slots shown")
	menu.call(&"close")
	await frames(1)
