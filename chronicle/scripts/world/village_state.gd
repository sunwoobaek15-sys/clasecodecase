extends Node
## Village restoration state (autoload "Village").
##
## Facilities (res://data/village) start in ruins. Restoring one costs gold
## and materials and unlocks its NPC and feature. Also holds the farm, the
## priest's blessing and small story flags.

signal changed
signal restored(id: StringName)

const DIR := "res://data/village"
const MAX_CROPS := 3
const BLESSING_COST := 50
const BLESSING_EXP := 0.2
## Pets that move in when a facility is rebuilt.
const PET_REWARDS := {&"farm": &"bird", &"lab": &"cat"}

var facilities: Array[FacilityData] = []
var restored_ids: Dictionary = {}
var arrived := false          ## reached the village at least once
var crops := 0                ## harvests waiting on the farm
var blessing := false         ## +20% EXP until the next stage clear
var met: Dictionary = {}      ## npc id -> true (first conversation done)


func _ready() -> void:
	for r in DataDir.load_all(DIR):
		if r is FacilityData:
			facilities.append(r as FacilityData)
	facilities.sort_custom(func(a: FacilityData, b: FacilityData) -> bool: return a.order < b.order)
	Events.stage_cleared.connect(_on_stage_cleared)


func reset() -> void:
	restored_ids.clear()
	arrived = false
	crops = 0
	blessing = false
	met.clear()
	changed.emit()


func facility(id: StringName) -> FacilityData:
	for f in facilities:
		if f.id == id:
			return f
	return null


func is_restored(id: StringName) -> bool:
	return id == &"" or restored_ids.has(id)


func restored_count() -> int:
	return restored_ids.size()


## Text of what is still missing, or "" when the player can pay.
func missing_cost(id: StringName) -> String:
	var f := facility(id)
	if f == null:
		return "알 수 없는 시설"
	var miss: PackedStringArray = []
	if Profile.gold < f.cost_gold:
		miss.append("골드 %d" % (f.cost_gold - Profile.gold))
	for item_id in f.cost_items:
		var need := int(f.cost_items[item_id]) - Profile.inventory.count(StringName(str(item_id)))
		if need > 0:
			var item := ItemDB.get_item(StringName(str(item_id)))
			miss.append("%s %d" % [item.display_name if item else str(item_id), need])
	return ", ".join(miss)


static func cost_text(f: FacilityData) -> String:
	var parts: PackedStringArray = ["%dG" % f.cost_gold]
	for item_id in f.cost_items:
		var item := ItemDB.get_item(StringName(str(item_id)))
		parts.append("%s x%d" % [item.display_name if item else str(item_id), int(f.cost_items[item_id])])
	return " + ".join(parts)


func can_restore(id: StringName) -> bool:
	return facility(id) != null and not is_restored(id) and missing_cost(id) == ""


func restore(id: StringName) -> bool:
	if not can_restore(id):
		return false
	var f := facility(id)
	Profile.add_gold(-f.cost_gold)
	for item_id in f.cost_items:
		Profile.inventory.remove(StringName(str(item_id)), int(f.cost_items[item_id]))
	restored_ids[id] = true
	Events.toast.emit("%s 복구 완료!" % f.display_name)
	restored.emit(id)
	if PET_REWARDS.has(id):
		Pets.grant(PET_REWARDS[id])
	changed.emit()
	return true


func harvest() -> int:
	if not is_restored(&"farm") or crops <= 0:
		return 0
	var n := crops
	crops = 0
	var added := Profile.inventory.add(Profile.POTION_ID, n)
	Profile.add_exp(5 * n)
	Events.toast.emit("수확! 소형 회복 물약 x%d" % added if added > 0 else "가방이 가득 찼어요.")
	Events.farm_harvested.emit(n)
	changed.emit()
	return n


func buy_blessing() -> bool:
	if blessing or not is_restored(&"training") or Profile.gold < BLESSING_COST:
		return false
	Profile.add_gold(-BLESSING_COST)
	blessing = true
	Events.toast.emit("축복을 받았다! 다음 스테이지 EXP +20%")
	changed.emit()
	Profile.changed.emit()
	return true


func exp_bonus() -> float:
	return BLESSING_EXP if blessing else 0.0


func meet(npc_id: StringName) -> bool:
	if met.has(npc_id):
		return false
	met[npc_id] = true
	return true


func _on_stage_cleared(_stats: Dictionary) -> void:
	if is_restored(&"farm"):
		crops = mini(MAX_CROPS, crops + 1)
	if blessing:
		blessing = false
		Profile.changed.emit()
	changed.emit()


# ------------------------------------------------------------- save data ---
func to_dict() -> Dictionary:
	var r: Array = []
	for id in restored_ids:
		r.append(str(id))
	var m: Array = []
	for id in met:
		m.append(str(id))
	return {"restored": r, "arrived": arrived, "crops": crops, "blessing": blessing, "met": m}


func from_dict(d: Dictionary) -> void:
	restored_ids.clear()
	var r: Variant = d.get("restored", [])
	if typeof(r) == TYPE_ARRAY:
		for id in r:
			if facility(StringName(str(id))) != null:
				restored_ids[StringName(str(id))] = true
	arrived = bool(d.get("arrived", false))
	crops = clampi(int(d.get("crops", 0)), 0, MAX_CROPS)
	blessing = bool(d.get("blessing", false))
	met.clear()
	var m: Variant = d.get("met", [])
	if typeof(m) == TYPE_ARRAY:
		for id in m:
			met[StringName(str(id))] = true
	changed.emit()
