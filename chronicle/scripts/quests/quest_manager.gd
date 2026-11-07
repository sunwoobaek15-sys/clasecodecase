extends Node
## Quest progress (autoload "Quests").
##
## Quest definitions live in res://data/quests (QuestData). A quest is
##   locked     requirements not met
##   available  can be accepted from its giver (or is accepted automatically)
##   active     objectives in progress
##   ready      objectives done, hand in to the giver
##   done       rewards received (daily quests become available again the
##              next day)
## Event objectives count things that happen while the quest is active;
## state objectives (level, restored facilities, ...) read the game state.

signal changed
signal quest_accepted(q: QuestData)
signal quest_ready(q: QuestData)
signal quest_finished(q: QuestData)

const DIR := "res://data/quests"
const EVENT_TYPES := [&"kill", &"boss", &"clear_stage", &"talk", &"enhance", &"harvest"]

var quests: Array[QuestData] = []
var state: Dictionary = {}   ## id -> {"status": String, "progress": Array, "date": String}
var _refresh_queued := false
var _silent := false


func _ready() -> void:
	for r in DataDir.load_all(DIR):
		if r is QuestData:
			quests.append(r as QuestData)
	quests.sort_custom(func(a: QuestData, b: QuestData) -> bool: return a.order < b.order)
	Events.enemy_killed.connect(_on_enemy_killed)
	Events.npc_talked.connect(func(id: StringName) -> void: notify(&"talk", str(id)))
	Events.item_enhanced.connect(func(_id: StringName, _lv: int) -> void: notify(&"enhance", ""))
	Events.farm_harvested.connect(func(_n: int) -> void: notify(&"harvest", ""))
	Events.stage_cleared.connect(func(s: Dictionary) -> void: notify(&"clear_stage", str(s.get("stage_id", ""))))
	for sig in [Profile.changed, Village.changed, Pets.changed, Codex.changed]:
		(sig as Signal).connect(queue_refresh)
	reset()


func reset() -> void:
	state.clear()
	_silent = true
	refresh()
	_silent = false


func quest(id: StringName) -> QuestData:
	for q in quests:
		if q.id == id:
			return q
	return null


func status(id: StringName) -> String:
	var s: Dictionary = state.get(id, {})
	if not s.is_empty():
		return str(s.get("status", "active"))
	var q := quest(id)
	return "available" if q != null and _requirements_met(q) else "locked"


func _requirements_met(q: QuestData) -> bool:
	if q.type != QuestData.Type.ACHIEVEMENT and not Village.arrived:
		return false
	for r in q.requires:
		if status(r) != "done":
			return false
	return Village.is_restored(q.requires_facility)


func list(statuses: Array, type: int = -1) -> Array[QuestData]:
	var out: Array[QuestData] = []
	for q in quests:
		if (type < 0 or q.type == type) and status(q.id) in statuses:
			out.append(q)
	return out


func offered_by(npc: StringName) -> Array[QuestData]:
	var out: Array[QuestData] = []
	for q in quests:
		if q.giver == npc and not q.auto_accept and status(q.id) == "available":
			out.append(q)
	return out


func ready_for(npc: StringName) -> Array[QuestData]:
	var out: Array[QuestData] = []
	for q in quests:
		if q.giver == npc and status(q.id) == "ready":
			out.append(q)
	return out


func active_from(npc: StringName) -> Array[QuestData]:
	var out: Array[QuestData] = []
	for q in quests:
		if q.giver == npc and status(q.id) == "active":
			out.append(q)
	return out


## Marker over an NPC: "turnin", "offer" or "".
func marker_for(npc: StringName) -> String:
	if not ready_for(npc).is_empty():
		return "turnin"
	if not offered_by(npc).is_empty():
		return "offer"
	return ""


## The quest shown on the HUD: first main quest in progress, else a side quest.
func tracked() -> QuestData:
	for t in [QuestData.Type.MAIN, QuestData.Type.SUB, QuestData.Type.DAILY]:
		for q in quests:
			if q.type == t and status(q.id) in ["active", "ready"]:
				return q
	return null


func accept(id: StringName) -> bool:
	var q := quest(id)
	if q == null or status(id) != "available":
		return false
	var prog: Array = []
	for o in q.objectives:
		prog.append(0)
	state[id] = {"status": "active", "progress": prog, "date": ""}
	quest_accepted.emit(q)
	if not _silent and q.type != QuestData.Type.ACHIEVEMENT:
		Events.toast.emit("퀘스트 수락: %s" % q.title)
	_check(q)
	changed.emit()
	return true


func progress(q: QuestData, i: int) -> int:
	var o: Dictionary = q.objectives[i]
	var need := int(o.get("count", 1))
	var t := StringName(str(o.get("type", "")))
	if t in EVENT_TYPES:
		var p: Array = (state.get(q.id, {}) as Dictionary).get("progress", [])
		return mini(need, int(p[i]) if i < p.size() else 0)
	var target := str(o.get("target", ""))
	match t:
		&"level":
			return mini(need, Profile.level)
		&"restore":
			return 1 if Village.is_restored(StringName(target)) else 0
		&"restore_count":
			return mini(need, Village.restored_count())
		&"pet_count":
			return mini(need, Pets.count())
		&"codex_count":
			return mini(need, Codex.count_known())
		&"collect":
			return mini(need, Profile.inventory.count(StringName(target)))
	return 0


func objective_done(q: QuestData, i: int) -> bool:
	return progress(q, i) >= int((q.objectives[i] as Dictionary).get("count", 1))


func objective_text(q: QuestData, i: int) -> String:
	var o: Dictionary = q.objectives[i]
	var need := int(o.get("count", 1))
	var text := str(o.get("text", ""))
	return text if need <= 1 else "%s (%d/%d)" % [text, progress(q, i), need]


func all_done(q: QuestData) -> bool:
	for i in q.objectives.size():
		if not objective_done(q, i):
			return false
	return true


## Hands a finished quest in: takes collected items, pays the rewards.
func turn_in(id: StringName) -> bool:
	var q := quest(id)
	if q == null or status(id) != "ready" or not all_done(q):
		return false
	_finish(q)
	return true


func _finish(q: QuestData) -> void:
	for o in q.objectives:
		if str((o as Dictionary).get("type", "")) == "collect":
			Profile.inventory.remove(StringName(str(o["target"])), int(o.get("count", 1)))
	var s: Dictionary = state[q.id]
	s["status"] = "done"
	s["date"] = Time.get_date_string_from_system()
	var label := "업적 달성" if q.type == QuestData.Type.ACHIEVEMENT else "퀘스트 완료"
	if not _silent:
		Events.toast.emit("%s: %s" % [label, q.title])
	if q.reward_gold > 0:
		Profile.add_gold(q.reward_gold)
	for item_id in q.reward_items:
		Profile.inventory.add(StringName(str(item_id)), int(q.reward_items[item_id]))
	if q.reward_exp > 0:
		Profile.add_exp(q.reward_exp)
	if q.reward_pet != &"":
		Pets.grant(q.reward_pet)
	quest_finished.emit(q)
	changed.emit()
	queue_refresh()


func _check(q: QuestData) -> void:
	if status(q.id) != "active" or not all_done(q):
		return
	if q.turn_in and q.giver != &"":
		(state[q.id] as Dictionary)["status"] = "ready"
		quest_ready.emit(q)
		if not _silent:
			Events.toast.emit("퀘스트 목표 달성: %s" % q.title)
	else:
		_finish(q)


## Counts an event for every active quest objective of that type.
func notify(type: StringName, target: String, amount: int = 1) -> void:
	var touched := false
	for q in quests:
		if status(q.id) != "active":
			continue
		for i in q.objectives.size():
			var o: Dictionary = q.objectives[i]
			if StringName(str(o.get("type", ""))) == type and _matches(str(o.get("target", "")), target):
				var p: Array = state[q.id]["progress"]
				p[i] = mini(int(o.get("count", 1)), int(p[i]) + amount)
				touched = true
	if touched:
		refresh()


static func _matches(want: String, got: String) -> bool:
	if want.is_empty() or want == "any":
		return true
	if want == "slime":
		return got.begins_with("forest_slime")
	return want == got


func _on_enemy_killed(enemy: Node) -> void:
	var e := enemy as Enemy
	if e == null or e.stats == null:
		return
	notify(&"boss" if e is Verdan else &"kill", str(e.stats.id))


func queue_refresh() -> void:
	if not _refresh_queued:
		_refresh_queued = true
		refresh.call_deferred()


## Auto-accepts, completes and resets daily quests.
func refresh() -> void:
	_refresh_queued = false
	var today := Time.get_date_string_from_system()
	for q in quests:
		var st := status(q.id)
		if st == "done" and q.type == QuestData.Type.DAILY and str(state[q.id].get("date", "")) != today:
			state.erase(q.id)
			st = status(q.id)
		if st == "available" and q.auto_accept:
			accept(q.id)
		elif st == "active":
			_check(q)
	changed.emit()


# ------------------------------------------------------------- save data ---
func to_dict() -> Dictionary:
	var out := {}
	for id in state:
		var s: Dictionary = state[id]
		out[str(id)] = {"status": str(s["status"]), "progress": (s["progress"] as Array).duplicate(),
				"date": str(s.get("date", ""))}
	return out


func from_dict(d: Dictionary) -> void:
	state.clear()
	for key in d:
		var q := quest(StringName(str(key)))
		var s: Variant = d[key]
		if q == null or typeof(s) != TYPE_DICTIONARY:
			continue
		var st := str((s as Dictionary).get("status", "active"))
		if not st in ["active", "ready", "done"]:
			continue
		var prog: Array = []
		var raw: Variant = (s as Dictionary).get("progress", [])
		for i in q.objectives.size():
			var v := int((raw as Array)[i]) if typeof(raw) == TYPE_ARRAY and i < (raw as Array).size() else 0
			prog.append(clampi(v, 0, int((q.objectives[i] as Dictionary).get("count", 1))))
		state[q.id] = {"status": st, "progress": prog, "date": str((s as Dictionary).get("date", ""))}
	_silent = true
	refresh()
	_silent = false
