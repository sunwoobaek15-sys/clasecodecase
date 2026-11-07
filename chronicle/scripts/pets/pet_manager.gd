extends Node
## Pets the hero owns (autoload "Pets"): levels, EXP and the active pet.
##
## The active pet's passive bonuses are added to Profile.modifiers(); pets
## gain half of the EXP the hero earns from monsters, and treats from the
## shop give extra EXP.

signal changed
signal pet_obtained(id: StringName)
signal pet_leveled(id: StringName, level: int)

const MAX_LEVEL := 10
const TREAT_ID := &"item_pet_treat"
const TREAT_EXP := 40

var owned: Dictionary = {}   ## id -> {"level": int, "exp": int}
var active: StringName = &""


func _ready() -> void:
	Events.enemy_killed.connect(_on_enemy_killed)


func reset() -> void:
	owned.clear()
	active = &""
	_changed()


static func exp_to_next(lv: int) -> int:
	return 20 + 15 * (lv - 1)


func owns(id: StringName) -> bool:
	return owned.has(id)


func count() -> int:
	return owned.size()


func level_of(id: StringName) -> int:
	return int((owned.get(id, {}) as Dictionary).get("level", 0))


func exp_of(id: StringName) -> int:
	return int((owned.get(id, {}) as Dictionary).get("exp", 0))


func active_pet() -> PetData:
	return PetDB.get_pet(active) if active != &"" else null


func grant(id: StringName) -> bool:
	if owns(id) or PetDB.get_pet(id) == null:
		return false
	owned[id] = {"level": 1, "exp": 0}
	if active == &"":
		active = id
	pet_obtained.emit(id)
	Events.toast.emit("새로운 동료! %s" % PetDB.get_pet(id).display_name)
	_changed()
	return true


func set_active(id: StringName) -> bool:
	if not owns(id):
		return false
	active = id
	_changed()
	return true


## Returns the number of levels gained.
func add_exp(amount: int, id: StringName = &"") -> int:
	var pid := id if id != &"" else active
	if pid == &"" or not owns(pid) or amount <= 0:
		return 0
	var d: Dictionary = owned[pid]
	var lv := int(d["level"])
	if lv >= MAX_LEVEL:
		return 0
	var xp := int(d["exp"]) + amount
	var gained := 0
	while lv < MAX_LEVEL and xp >= exp_to_next(lv):
		xp -= exp_to_next(lv)
		lv += 1
		gained += 1
	if lv >= MAX_LEVEL:
		xp = 0
	owned[pid] = {"level": lv, "exp": xp}
	if gained > 0:
		pet_leveled.emit(pid, lv)
		Events.toast.emit("%s 레벨 업! Lv.%d" % [PetDB.get_pet(pid).display_name, lv])
	_changed()
	return gained


func feed(id: StringName) -> bool:
	if not owns(id) or level_of(id) >= MAX_LEVEL or not Profile.inventory.remove(TREAT_ID, 1):
		return false
	add_exp(TREAT_EXP, id)
	return true


func modifiers() -> Dictionary:
	var pet := active_pet()
	return pet.bonuses_at(level_of(active)) if pet != null else {}


func _on_enemy_killed(enemy: Node) -> void:
	var e := enemy as Enemy
	if e != null and e.stats != null and e.stats.exp_reward > 0:
		add_exp(maxi(1, e.stats.exp_reward / 2))


func _changed() -> void:
	changed.emit()
	Profile.changed.emit()   # pet passives change the hero's stats


# ------------------------------------------------------------- save data ---
func to_dict() -> Dictionary:
	var o := {}
	for id in owned:
		o[str(id)] = {"level": level_of(id), "exp": exp_of(id)}
	return {"owned": o, "active": str(active)}


func from_dict(d: Dictionary) -> void:
	owned.clear()
	var o: Variant = d.get("owned", {})
	if typeof(o) == TYPE_DICTIONARY:
		for key in o:
			var id := StringName(str(key))
			var v: Variant = (o as Dictionary)[key]
			if PetDB.get_pet(id) == null or typeof(v) != TYPE_DICTIONARY:
				continue
			var lv := clampi(int((v as Dictionary).get("level", 1)), 1, MAX_LEVEL)
			owned[id] = {"level": lv, "exp": clampi(int((v as Dictionary).get("exp", 0)), 0, exp_to_next(lv))}
	active = StringName(str(d.get("active", "")))
	if not owns(active):
		active = owned.keys()[0] if not owned.is_empty() else &""
	_changed()
