extends TestCase
## Phase 3: village restoration, quests, pets, blacksmith, codex, the village
## scene and the save format v2.


func before_each() -> void:
	SaveSystem.delete_save()
	Game.reset_progress(false)
	Game.location = "stage"


func after_each() -> void:
	SaveSystem.delete_save()
	Game.reset_progress(false)
	Game.location = "stage"


func _arrive() -> void:
	Village.arrived = true
	Quests.refresh()


func test_restoration_costs_and_unlocks() -> void:
	check(not Village.can_restore(&"shop"), "no gold -> cannot restore")
	check(Village.missing_cost(&"shop").contains("골드"), "missing gold is reported")
	Profile.add_gold(1000)
	Profile.inventory.add(&"item_slime_gel", 20)
	check(Village.restore(&"shop"), "shop restored")
	check_eq(Profile.gold, 950, "50 G paid")
	check(not Village.restore(&"shop"), "cannot restore twice")
	check(not Village.can_restore(&"lab"), "lab needs a time core shard")
	Profile.inventory.add(&"item_time_shard", 1)
	check(Village.restore(&"lab"), "lab restored with the shard")
	check_eq(Profile.inventory.count(&"item_time_shard"), 0, "shard used")
	check(Pets.owns(&"cat"), "the shadow cat moves in with the lab")
	check(Village.restore(&"farm"), "farm restored")
	check(Pets.owns(&"bird"), "the little bird comes with the farm")
	check_eq(Village.restored_count(), 3, "3 facilities")
	Events.stage_cleared.emit({"stage_id": "forest_1"})
	check_eq(Village.crops, 1, "crops grow after a stage clear")
	var potions := Profile.inventory.count(Profile.POTION_ID)
	check_eq(Village.harvest(), 1, "harvest 1")
	check_eq(Profile.inventory.count(Profile.POTION_ID), potions + 1, "harvest gives a potion")


func test_main_quest_chain() -> void:
	check_eq(Quests.status(&"q_main_01"), "locked", "nothing before reaching the village")
	_arrive()
	check_eq(Quests.status(&"q_main_01"), "active", "first quest starts on arrival")
	Events.npc_talked.emit(&"keeper_mia")
	check_eq(Quests.status(&"q_main_01"), "done", "talking to Mia finishes it")
	check(Pets.owns(&"spirit_slime"), "reward pet: spirit slime")
	check_eq(Pets.active, &"spirit_slime", "first pet becomes active")
	check_eq(Quests.status(&"q_main_02"), "available", "next main quest offered")
	check(Quests.offered_by(&"keeper_mia").has(Quests.quest(&"q_main_02")), "Mia offers it")
	check(Quests.accept(&"q_main_02"), "accepted")
	check_eq(Quests.marker_for(&"keeper_mia"), "", "no marker while in progress")
	Profile.add_gold(100)
	Village.restore(&"shop")
	await frames(1)
	check_eq(Quests.status(&"q_main_02"), "ready", "objective done -> hand in")
	check_eq(Quests.marker_for(&"keeper_mia"), "turnin", "Mia shows the hand-in marker")
	var potions := Profile.inventory.count(Profile.POTION_ID)
	check(Quests.turn_in(&"q_main_02"), "handed in")
	check_eq(Profile.inventory.count(Profile.POTION_ID), potions + 2, "reward potions")
	check_eq(Quests.status(&"q_main_03"), "available", "chain continues")
	check(Quests.tracked() == null or Quests.tracked().type != QuestData.Type.MAIN, "no main quest tracked until accepted")


func test_kill_collect_and_daily_quests() -> void:
	_arrive()
	Events.npc_talked.emit(&"keeper_mia")
	check(Quests.accept(&"q_sub_slime"), "slime hunt accepted")
	for i in 14:
		Quests.notify(&"kill", "forest_slime_small")
	check_eq(Quests.status(&"q_sub_slime"), "active", "14/15")
	Quests.notify(&"kill", "verdan")
	check_eq(Quests.status(&"q_sub_slime"), "active", "the boss is not a slime")
	Quests.notify(&"kill", "forest_slime")
	check_eq(Quests.status(&"q_sub_slime"), "ready", "15/15")
	check(Quests.turn_in(&"q_sub_slime"), "turned in")
	check(Pets.owns(&"fox"), "reward pet: snow fox")
	# the same 15 kills also finished today's daily hunt (12 monsters)
	check_eq(Quests.status(&"q_daily_hunt"), "done", "daily done (completes by itself)")
	(Quests.state[&"q_daily_hunt"] as Dictionary)["date"] = "2000-01-01"
	Quests.refresh()
	check_eq(Quests.status(&"q_daily_hunt"), "active", "next day: daily hunt is back")
	var gold := Profile.gold
	for i in 12:
		Quests.notify(&"kill", "forest_slime")
	check_eq(Quests.status(&"q_daily_hunt"), "done", "done again")
	check_eq(Profile.gold, gold + 40, "daily reward")
	# collect quest takes the items
	Profile.add_gold(200)
	Profile.inventory.add(&"item_slime_gel", 13)
	Village.restore(&"smithy")
	check(Quests.accept(&"q_sub_gel"), "gel request accepted")
	await frames(1)
	check_eq(Quests.status(&"q_sub_gel"), "ready", "8 gel in the bag")
	check(Quests.turn_in(&"q_sub_gel"), "handed in")
	check_eq(Profile.inventory.count(&"item_slime_gel"), 0, "13 - 5 (smithy) - 8 (quest) = 0")


func test_achievements() -> void:
	check_eq(Quests.status(&"ach_level5"), "active", "achievements are tracked from the start")
	var gold := Profile.gold
	Profile.add_exp(30 + 55 + 80 + 105)
	await frames(1)
	check_eq(Profile.level, 5, "level 5")
	check_eq(Quests.status(&"ach_level5"), "done", "achievement unlocked")
	check_eq(Profile.gold, gold + 50, "achievement reward")


func test_pets_levels_and_passives() -> void:
	check(Pets.grant(&"cat"), "cat obtained")
	check(not Pets.grant(&"cat"), "only once")
	check_between(Profile.mod(&"crit_chance"), 0.039, 0.041, "cat passive +4% crit")
	check_eq(Pets.add_exp(20), 1, "20 EXP -> Lv.2")
	check_between(Profile.mod(&"crit_chance"), 0.045, 0.047, "passive grows with level")
	check(not Pets.feed(&"cat"), "no treat")
	Profile.inventory.add(Pets.TREAT_ID, 1)
	check(Pets.feed(&"cat"), "fed")
	check_eq(Pets.level_of(&"cat"), 3, "treat EXP (40) -> Lv.3")
	Pets.grant(&"dragon")
	check(Pets.set_active(&"dragon"), "switch to the dragon")
	check_eq(Profile.mod(&"crit_chance"), 0.0, "cat passive gone")
	check_eq(roundi(Profile.mod(&"attack")), 2, "dragon passive +2 attack")
	var base := load("res://data/player/hero_stats.tres") as PlayerStats
	check_eq(Profile.build_stats(base).attack, base.attack + 2, "pet bonus reaches the hero's stats")


func test_pet_follows_and_sleeps() -> void:
	make_floor()
	var p := spawn_player()
	Pets.grant(&"fox")
	await frames(2)
	var pet := Pet.spawn(runner, p)
	check(pet != null, "pet spawned")
	p.global_position.x = 200
	await seconds(1.5)
	check(absf(pet.global_position.x - (200 - Pet.FOLLOW_DIST * p.facing)) < 20.0, "pet follows the hero (%.0f)" % pet.global_position.x)
	await seconds(Pet.SLEEP_AFTER + 0.5)
	check_eq(pet.state, &"sleep", "pet falls asleep when the hero stands still")


func test_blacksmith_enhancement() -> void:
	Profile.reset(true)
	var sword := &"item_sword_cheongwol"
	check(not Profile.can_enhance(sword), "no gold / gel")
	Profile.add_gold(1000)
	Profile.inventory.add(&"item_slime_gel", 40)
	var base := load("res://data/player/hero_stats.tres") as PlayerStats
	var atk0 := Profile.build_stats(base).attack
	check(Profile.enhance_item(sword), "+1")
	check_eq(Profile.build_stats(base).attack, atk0 + 2, "+2 attack per level")
	check_eq(Profile.item_label(sword), "청월검 +1", "label shows the level")
	check_eq(int(Profile.enhance_cost(sword)["gold"]), 80, "cost grows")
	for i in 10:
		Profile.enhance_item(sword)
	check_eq(Profile.enhance_level(sword), Profile.MAX_ENHANCE, "capped at +5")
	check(Profile.enhance_item(&"item_cloak_traveler"), "armour can be enhanced")
	check_between(Profile.defense(), 0.059, 0.061, "cloak 5% + 1%")


func test_codex_records() -> void:
	check(Codex.is_known(&"item_sword_cheongwol") == false, "bare hero owns no sword")
	Codex.record_kill(&"forest_slime")
	Codex.record_kill(&"forest_slime")
	check(Codex.is_known(&"forest_slime"), "slime recorded")
	check_eq(int(Codex.kills[&"forest_slime"]), 2, "kill count")
	Codex.discover(&"chronos")
	check(not Codex.is_known(&"chronos"), "future entries cannot be recorded")
	var gold := Profile.gold
	check_eq(Codex.claim_rewards(), Codex.REWARD_PER_ENTRY, "library reward")
	check_eq(Profile.gold, gold + Codex.REWARD_PER_ENTRY, "gold paid")
	check_eq(Codex.claim_rewards(), 0, "paid once")


func test_save_v2_round_trip() -> void:
	Profile.reset(true)
	_arrive()
	Events.npc_talked.emit(&"keeper_mia")
	Profile.add_gold(500)
	Profile.inventory.add(&"item_slime_gel", 10)
	Village.restore(&"shop")
	Village.restore(&"smithy")
	Profile.enhance_item(&"item_sword_cheongwol")
	Quests.accept(&"q_sub_slime")
	Quests.notify(&"kill", "forest_slime", 4)
	Codex.record_kill(&"forest_slime")
	Pets.add_exp(30)
	Game.location = "village"
	check(SaveSystem.save_game(), "saved (%s)" % SaveSystem.last_error)
	var payload: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SaveSystem.save_path))["payload"]
	for key in ["profile", "stage", "quests", "village", "pets", "codex"]:
		check(payload.has(key), "section " + key)
	Game.reset_progress(false)
	Game.location = "stage"
	check(SaveSystem.load_game(), "loaded")
	check(Village.is_restored(&"smithy"), "village restored")
	check(Village.arrived, "arrived flag")
	check_eq(Game.location, "village", "continue in the village")
	check_eq(Profile.enhance_level(&"item_sword_cheongwol"), 1, "enhancement")
	check_eq(Quests.status(&"q_sub_slime"), "active", "quest state")
	check_eq(Quests.progress(Quests.quest(&"q_sub_slime"), 0), 4, "quest progress")
	check_eq(Quests.status(&"q_main_01"), "done", "finished quest")
	check(Codex.is_known(&"forest_slime"), "codex")
	check_eq(Pets.level_of(&"spirit_slime"), 2, "pet level")


func test_migrates_version_1() -> void:
	var payload := {"profile": {"level": 3, "exp": 5, "gold": 40, "cleared_stages": ["forest_1"],
			"equipment": {"weapon": "item_sword_cheongwol"}, "inventory": []},
			"stage": {"stage_id": "forest_1", "checkpoint_id": 0}}
	var f := FileAccess.open(SaveSystem.save_path, FileAccess.WRITE)
	f.store_string(JSON.stringify({"version": 1, "checksum": SaveSystem.checksum(payload), "payload": payload}))
	f.close()
	check(SaveSystem.load_game(), "v1 file loads")
	check(Village.arrived, "a hero who cleared the forest has reached the village")
	check_eq(Game.location, "village", "continue in the village")
	check_eq(Profile.level, 3, "profile kept")
	check_eq(Quests.status(&"q_main_01"), "active", "first village quest starts")


func test_village_scene_flow() -> void:
	_arrive()
	Profile.add_gold(300)
	Game.location = "village"
	var v := (load("res://scenes/village/village.tscn") as PackedScene).instantiate() as Node2D
	add(v)
	await seconds(0.6)
	var npcs: Dictionary = v.get("npcs")
	check_eq(npcs.size(), 8, "8 NPCs placed")
	check((npcs[&"keeper_mia"] as Npc).visible, "Mia is always there")
	check(not (npcs[&"merchant_kairo"] as Npc).visible, "merchant waits for the shop")
	v.call("talk_to", &"keeper_mia")
	await frames(2)
	var d: DialogueBox = v.get("dialogue")
	check(d.visible, "dialogue opens")
	check(tree().paused, "game paused while talking")
	check_eq(Quests.status(&"q_main_01"), "done", "talking finished the first quest")
	check(d.choice_texts().size() >= 2, "choices offered (%s)" % str(d.choice_texts()))
	check(d.choose_containing("마을 재건"), "open restoration from the dialogue")
	await frames(2)
	var rp: ModalPanel = v.get("panels")["restore"]
	check(rp.visible, "restoration window open")
	rp.call(&"_restore", &"shop")
	rp.close()
	await frames(2)
	check(not tree().paused, "unpaused after closing")
	check((npcs[&"merchant_kairo"] as Npc).visible, "merchant arrives with the shop")
	check_eq(tree().get_nodes_in_group(&"pet").size(), 1, "the new pet follows the hero")
	var p: Player = v.get("player")
	p.global_position.x = (npcs[&"merchant_kairo"] as Npc).global_position.x + 10
	await frames(3)
	check(v.get("target") == npcs[&"merchant_kairo"], "merchant is the interaction target")
	Game.send_action(&"interact", true)
	await frames(2)
	Game.send_action(&"interact", false)
	check(d.visible and d.choice_texts().has("상점"), "interact key talks to the merchant")
	d.close()
	await frames(1)


func test_stage_clear_returns_to_village() -> void:
	Game.checkpoint_id = -1
	var st := (load("res://scenes/world/forest_stage.tscn") as PackedScene).instantiate() as Node2D
	add(st)
	await seconds(0.5)
	st.call("_on_core_collected", null)
	await frames(2)
	check_eq(Profile.inventory.count(&"item_time_shard"), 1, "first clear keeps the core shard")
	check_eq(Game.location, "village", "next start is the village")
	check(Village.arrived, "village reached")
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SaveSystem.save_path))
	check_eq(str(d["payload"]["stage"]["location"]), "village", "saved location")
	st.call("_on_core_collected", null)
	check_eq(Profile.inventory.count(&"item_time_shard"), 1, "no second shard")
