extends Node
## JSON save system (autoload "SaveSystem").
##
## File layout (user://save_slot1.json):
##   {"version": 2, "saved_at": <unix>, "checksum": <sha256 of payload>,
##    "payload": {"profile": {...},
##                "stage": {"stage_id", "checkpoint_id", "location"},
##                "quests": {...}, "village": {...}, "pets": {...}, "codex": {...}}}
## location is "village" or "stage" (where Continue starts).
##
## Safety:
##   * atomic write: the new file is written to *.tmp, read back and checked,
##     then the old save is kept as *.bak.json and the tmp file takes its place
##   * load verifies JSON + checksum; a broken file falls back to the backup
##   * `version` + _migrate() upgrade older files step by step
## Settings live separately in user://settings.cfg (Game).

signal saved
signal loaded

const VERSION := 2
const STAGE_ID := "forest_1"

var save_path: String = "user://save_slot1.json"
var last_error: String = ""


func _ready() -> void:
	if Game.bot_mode:
		save_path = "user://bot_slot.json"


func backup_path() -> String:
	return save_path.trim_suffix(".json") + ".bak.json"


func tmp_path() -> String:
	return save_path + ".tmp"


func has_save() -> bool:
	return FileAccess.file_exists(save_path) or FileAccess.file_exists(backup_path())


func delete_save() -> void:
	for p in [save_path, backup_path(), tmp_path()]:
		if FileAccess.file_exists(p):
			DirAccess.remove_absolute(p)


static func checksum(payload: Dictionary) -> String:
	# Round-trip through JSON first so ints/floats compare the same way they
	# will look after loading.
	return JSON.stringify(JSON.parse_string(JSON.stringify(payload))).sha256_text()


func build_payload() -> Dictionary:
	return {
		"profile": Profile.to_dict(),
		"stage": {"stage_id": Game.current_stage_id, "checkpoint_id": Game.checkpoint_id,
				"location": Game.location},
		"quests": Quests.to_dict(),
		"village": Village.to_dict(),
		"pets": Pets.to_dict(),
		"codex": Codex.to_dict(),
	}


func save_game() -> bool:
	last_error = ""
	var payload := build_payload()
	var data := {
		"version": VERSION,
		"saved_at": int(Time.get_unix_time_from_system()),
		"checksum": checksum(payload),
		"payload": payload,
	}
	var text := JSON.stringify(data, "\t")
	var f := FileAccess.open(tmp_path(), FileAccess.WRITE)
	if f == null:
		return _fail("cannot write %s (%s)" % [tmp_path(), error_string(FileAccess.get_open_error())])
	f.store_string(text)
	f.close()
	if _read_valid(tmp_path()).is_empty():
		return _fail("written file did not verify")
	if FileAccess.file_exists(save_path):
		if FileAccess.file_exists(backup_path()):
			DirAccess.remove_absolute(backup_path())
		var err := DirAccess.rename_absolute(save_path, backup_path())
		if err != OK:
			return _fail("cannot keep backup (%s)" % error_string(err))
	var err2 := DirAccess.rename_absolute(tmp_path(), save_path)
	if err2 != OK:
		return _fail("cannot move save into place (%s)" % error_string(err2))
	saved.emit()
	return true


## Loads the main save, or the backup if the main file is missing/broken.
func load_game() -> bool:
	for p in [save_path, backup_path()]:
		var data := _read_valid(p)
		if data.is_empty():
			continue
		var payload: Dictionary = data["payload"]
		Profile.from_dict(_section(payload, "profile"))
		Village.from_dict(_section(payload, "village"))
		Pets.from_dict(_section(payload, "pets"))
		Codex.from_dict(_section(payload, "codex"))
		Quests.from_dict(_section(payload, "quests"))
		var stage := _section(payload, "stage")
		Game.checkpoint_id = int(stage.get("checkpoint_id", -1))
		Game.current_stage_id = str(stage.get("stage_id", STAGE_ID))
		var loc := str(stage.get("location", "stage"))
		Game.location = loc if loc in ["village", "stage"] else "stage"
		if p != save_path:
			push_warning("SaveSystem: main save unreadable, restored from backup")
		loaded.emit()
		return true
	last_error = "no valid save"
	return false


static func _section(payload: Dictionary, key: String) -> Dictionary:
	var v: Variant = payload.get(key, {})
	return v if typeof(v) == TYPE_DICTIONARY else {}


## Parsed + verified + migrated save data, or {} when the file is unusable.
func _read_valid(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var json := JSON.new()
	if json.parse(FileAccess.get_file_as_string(path)) != OK:
		push_warning("SaveSystem: %s is not valid JSON (line %d)" % [path, json.get_error_line()])
		return {}
	var parsed: Variant = json.data
	if typeof(parsed) != TYPE_DICTIONARY:
		push_warning("SaveSystem: %s is not valid JSON" % path)
		return {}
	var data: Dictionary = parsed
	if not data.has("payload") or typeof(data["payload"]) != TYPE_DICTIONARY or not data.has("version"):
		return {}
	var version := int(data["version"])
	if version > VERSION:
		push_warning("SaveSystem: %s is from a newer game version (%d)" % [path, version])
		return {}
	if data.has("checksum"):
		if str(data["checksum"]) != checksum(data["payload"]):
			push_warning("SaveSystem: checksum mismatch in %s" % path)
			return {}
	elif version >= 1:
		return {}  # only pre-checksum (v0) files may lack it
	return _migrate(data)


## Upgrades old save layouts one version at a time.
func _migrate(data: Dictionary) -> Dictionary:
	var v := int(data["version"])
	while v < VERSION:
		match v:
			0:
				data = _migrate_0_to_1(data)
			1:
				data = _migrate_1_to_2(data)
		v += 1
	data["version"] = VERSION
	return data


## v0 (early prototype): profile stored "xp" and "items" (id -> count).
func _migrate_0_to_1(data: Dictionary) -> Dictionary:
	var payload: Dictionary = data["payload"]
	var prof: Dictionary = payload.get("profile", {})
	if prof.has("xp") and not prof.has("exp"):
		prof["exp"] = prof["xp"]
		prof.erase("xp")
	if prof.has("items") and typeof(prof["items"]) == TYPE_DICTIONARY:
		var arr: Array = []
		var items: Dictionary = prof["items"]
		for id in items:
			arr.append({"id": str(id), "count": int(items[id])})
		prof["inventory"] = arr
		prof.erase("items")
	payload["profile"] = prof
	if not payload.has("stage"):
		payload["stage"] = {"stage_id": STAGE_ID, "checkpoint_id": -1}
	data["payload"] = payload
	return data


## v1 (Phase 2): no quests / village / pets / codex. A hero who already
## cleared the forest has reached the village; continue from there.
func _migrate_1_to_2(data: Dictionary) -> Dictionary:
	var payload: Dictionary = data["payload"]
	var prof: Dictionary = _section(payload, "profile")
	var cleared: Variant = prof.get("cleared_stages", [])
	var arrived: bool = typeof(cleared) == TYPE_ARRAY and (cleared as Array).has(STAGE_ID)
	var stage: Dictionary = _section(payload, "stage")
	stage["location"] = "village" if arrived else "stage"
	if arrived:
		stage["checkpoint_id"] = -1
	payload["stage"] = stage
	payload["village"] = {"arrived": arrived}
	for key in ["quests", "pets", "codex"]:
		if not payload.has(key):
			payload[key] = {}
	data["payload"] = payload
	return data


func _fail(msg: String) -> bool:
	last_error = msg
	push_warning("SaveSystem: " + msg)
	return false
