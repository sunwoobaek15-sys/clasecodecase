extends TestCase
## Save system: round trip, atomic write + backup, corruption, migration.


func before_each() -> void:
	SaveSystem.delete_save()
	Profile.reset(false)
	Game.checkpoint_id = -1


func after_each() -> void:
	SaveSystem.delete_save()
	Profile.reset(false)
	Game.checkpoint_id = -1


func _write(path: String, text: String) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(text)
	f.close()


func _make_progress() -> void:
	Profile.add_exp(30 + 55 + 10)
	Profile.add_gold(77)
	Profile.inventory.add(&"item_potion_small", 4)
	Profile.inventory.add(&"item_sword_forest", 1)
	Profile.equip(&"item_sword_forest")
	Profile.inventory.add(&"item_ring_time", 1)
	Profile.equip(&"item_ring_time")
	Profile.upgrade_skill(&"node_combo_mastery")
	Profile.mark_stage_cleared("forest_1")
	Game.checkpoint_id = 0


func test_round_trip() -> void:
	_make_progress()
	var before := Profile.to_dict()
	check(SaveSystem.save_game(), "save works (%s)" % SaveSystem.last_error)
	check(SaveSystem.has_save(), "file exists")
	Profile.reset(true)
	Game.checkpoint_id = -1
	check(SaveSystem.load_game(), "load works")
	check_eq(SaveSystem.checksum(Profile.to_dict()), SaveSystem.checksum(before), "profile restored exactly")
	check_eq(Profile.level, 3, "level")
	check_eq(Profile.xp, 10, "exp")
	check_eq(Profile.gold, 77, "gold")
	check_eq(Profile.equipment[&"weapon"], &"item_sword_forest", "weapon slot")
	check_eq(Profile.equipment[&"accessory"], &"item_ring_time", "accessory slot")
	check_eq(Profile.inventory.count(&"item_potion_small"), 4, "potions")
	check_eq(Profile.skill_rank(&"node_combo_mastery"), 1, "skill rank")
	check(Profile.cleared_stages.has("forest_1"), "stage progress")
	check_eq(Game.checkpoint_id, 0, "checkpoint")


func test_file_format_has_version_and_checksum() -> void:
	SaveSystem.save_game()
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SaveSystem.save_path))
	check_eq(int(d["version"]), SaveSystem.VERSION, "version field")
	check(str(d.get("checksum", "")).length() == 64, "sha256 checksum")
	check(d["payload"].has("profile") and d["payload"].has("stage"), "payload sections")
	check(not FileAccess.file_exists(SaveSystem.tmp_path()), "no temp file left behind")


func test_second_save_keeps_backup() -> void:
	Profile.add_gold(10)
	SaveSystem.save_game()
	Profile.add_gold(5)
	SaveSystem.save_game()
	check(FileAccess.file_exists(SaveSystem.backup_path()), "previous save kept as backup")
	var bak: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SaveSystem.backup_path()))
	check_eq(int(bak["payload"]["profile"]["gold"]), 10, "backup holds the previous state")


func test_corrupted_save_falls_back_to_backup() -> void:
	Profile.add_gold(10)
	SaveSystem.save_game()
	Profile.add_gold(5)
	SaveSystem.save_game()
	_write(SaveSystem.save_path, "{ this is not json")
	Profile.reset(false)
	check(SaveSystem.load_game(), "loads from the backup")
	check_eq(Profile.gold, 10, "backup state restored")


func test_tampered_save_is_rejected() -> void:
	Profile.add_gold(10)
	SaveSystem.save_game()
	var text := FileAccess.get_file_as_string(SaveSystem.save_path).replace("\"gold\": 10", "\"gold\": 99999")
	_write(SaveSystem.save_path, text)
	Profile.reset(false)
	check(not SaveSystem.load_game(), "checksum mismatch and no backup -> not loaded")
	check_eq(Profile.gold, 0, "profile untouched")


func test_migrates_version_0() -> void:
	var v0 := {"version": 0, "payload": {"profile": {"level": 4, "xp": 12, "gold": 5,
			"items": {"item_potion_small": 3, "bogus_item": 2}, "equipment": {"weapon": "item_sword_cheongwol"}}}}
	_write(SaveSystem.save_path, JSON.stringify(v0))
	check(SaveSystem.load_game(), "v0 file loads")
	check_eq(Profile.level, 4, "level kept")
	check_eq(Profile.xp, 12, "xp renamed to exp")
	check_eq(Profile.inventory.count(&"item_potion_small"), 3, "item map converted to stacks")
	check_eq(Profile.inventory.count(&"bogus_item"), 0, "unknown items dropped")
	check_eq(Game.checkpoint_id, -1, "missing stage section gets defaults")


func test_rejects_newer_and_invalid_values() -> void:
	_write(SaveSystem.save_path, JSON.stringify({"version": 99, "payload": {"profile": {}}}))
	check(not SaveSystem.load_game(), "file from a newer version is refused")
	var payload := {"profile": {"level": 999, "exp": -5, "gold": -10, "skills": {"node_combo_mastery": 50, "fake": 3},
			"equipment": {"weapon": "item_potion_small", "armor": "item_cloak_traveler"}, "inventory": "oops"},
			"stage": {"checkpoint_id": 0}}
	_write(SaveSystem.save_path, JSON.stringify({"version": 1, "checksum": SaveSystem.checksum(payload), "payload": payload}))
	check(SaveSystem.load_game(), "loads with bad values")
	check_eq(Profile.level, Profile.MAX_LEVEL, "level clamped")
	check_eq(Profile.xp, 0, "exp clamped")
	check_eq(Profile.gold, 0, "gold clamped")
	check_eq(Profile.skill_rank(&"node_combo_mastery"), 3, "skill rank clamped")
	check_eq(Profile.equipment[&"weapon"], &"item_sword_cheongwol", "invalid weapon replaced by the default sword")
	check_eq(Profile.equipment[&"armor"], &"item_cloak_traveler", "valid armour kept")


func test_checkpoint_autosaves() -> void:
	Profile.reset(false)
	Game.checkpoint_id = -1
	var st := (load("res://scenes/world/forest_stage.tscn") as PackedScene).instantiate() as Node2D
	add(st)
	await seconds(0.5)
	var p: Player = st.get("player")
	var cp: Vector2 = (st.get("level") as LevelBuilder).first_marker("C")
	p.global_position = cp + Vector2(-30, -2)
	Input.action_press(&"move_right", 1.0)
	await wait_until(func() -> bool: return Game.checkpoint_id == 0, 2.0)
	Input.action_release(&"move_right")
	check(SaveSystem.has_save(), "checkpoint wrote the save file")
	var d: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(SaveSystem.save_path))
	check_eq(int(d["payload"]["stage"]["checkpoint_id"]), 0, "saved at the checkpoint")
