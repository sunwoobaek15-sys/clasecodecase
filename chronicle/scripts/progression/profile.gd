extends Node
## Persistent hero data (autoload "Profile"): level, EXP, gold, inventory,
## equipment, skill ranks and stage progress.
##
## Equipment bonuses and skill ranks use one set of stat keys and are summed
## into a single modifier table; build_stats() turns the base PlayerStats into
## the hero's current stats. Everything here is plain data so SaveSystem can
## write it as JSON (to_dict / from_dict).

signal changed
signal leveled_up(level: int)

const MAX_LEVEL := 30
const SKILL_DIR := "res://data/skills/tree"
const HP_PER_LEVEL := 10
const ATTACK_PER_LEVEL := 2
const MP_PER_LEVEL := 4.0
const SLOTS: Array[StringName] = [&"weapon", &"armor", &"accessory"]
const POTION_ID := &"item_potion_small"

## Stat keys shared by ItemData.bonuses and SkillNodeData.per_level.
const STAT_KEYS := {
	&"max_hp": "최대 HP",
	&"max_mp": "최대 MP",
	&"attack": "공격력",
	&"defense_pct": "받는 피해 감소",
	&"crit_chance": "치명타 확률",
	&"basic_damage_pct": "기본 공격 피해",
	&"skill_damage_pct": "스킬 피해",
	&"skill_cooldown": "스킬 재사용 대기 감소",
	&"dodge_cooldown": "회피 재사용 대기 감소",
	&"dodge_iframes": "회피 무적 시간",
	&"ult_damage_pct": "궁극기 피해",
	&"ult_gain_pct": "궁극기 게이지 충전",
	&"hp_regen": "5초마다 HP 회복",
	&"gold_pct": "골드 획득",
	&"exp_pct": "경험치 획득",
	&"magnet": "아이템 끌어오기 범위",
}
const PERCENT_KEYS := [&"defense_pct", &"crit_chance", &"basic_damage_pct", &"skill_damage_pct",
		&"ult_damage_pct", &"ult_gain_pct", &"gold_pct", &"exp_pct"]
const SECONDS_KEYS := [&"skill_cooldown", &"dodge_cooldown", &"dodge_iframes"]
const BASIC_ATTACKS := [&"combo1", &"combo2", &"combo3", &"air_slash", &"heavy"]
## Blacksmith enhancement (+1 .. +5): bonus per level by slot, and its cost.
const MAX_ENHANCE := 5
const ENHANCE_BONUS := {
	&"weapon": {&"attack": 2.0},
	&"armor": {&"max_hp": 8.0, &"defense_pct": 0.01},
	&"accessory": {&"max_mp": 3.0, &"crit_chance": 0.01},
}
const ENHANCE_MATERIAL := &"item_slime_gel"

var level: int = 1
var xp: int = 0
var gold: int = 0
var skill_points: int = 0
var skill_levels: Dictionary = {}  ## StringName -> rank
var equipment: Dictionary = {}     ## slot -> item id (&"" = empty)
var inventory := Inventory.new()
var cleared_stages: Array[String] = []
var enhance: Dictionary = {}       ## item id -> +level (blacksmith)
var skill_tree: Array[SkillNodeData] = []


func _ready() -> void:
	_load_skill_tree()
	inventory.changed.connect(func() -> void: changed.emit())
	Events.enemy_killed.connect(_on_enemy_killed)
	reset(true)


## Fresh hero. starting_kit gives the cloak, the sword, 3 potions and 1 SP.
func reset(starting_kit: bool = true) -> void:
	level = 1
	xp = 0
	gold = 0
	skill_points = 1 if starting_kit else 0
	skill_levels.clear()
	equipment = {&"weapon": &"", &"armor": &"", &"accessory": &""}
	cleared_stages.clear()
	enhance.clear()
	inventory.clear()
	if starting_kit:
		equipment[&"weapon"] = &"item_sword_cheongwol"
		equipment[&"armor"] = &"item_cloak_traveler"
		inventory.add(POTION_ID, 3)
	changed.emit()


func _load_skill_tree() -> void:
	skill_tree.clear()
	var dir := DirAccess.open(SKILL_DIR)
	if dir == null:
		push_error("Profile: cannot open %s" % SKILL_DIR)
		return
	for f in dir.get_files():
		var file_name := f.trim_suffix(".remap")
		if file_name.ends_with(".tres"):
			var res := load(SKILL_DIR.path_join(file_name))
			if res is SkillNodeData:
				skill_tree.append(res as SkillNodeData)
	skill_tree.sort_custom(func(a: SkillNodeData, b: SkillNodeData) -> bool: return a.order < b.order)


func skill_node(id: StringName) -> SkillNodeData:
	for n in skill_tree:
		if n.id == id:
			return n
	return null


# --------------------------------------------------------------- EXP/level ---
## EXP needed to go from `lv` to `lv + 1` (30, 55, 80, ...).
static func exp_to_next(lv: int) -> int:
	return 30 + 25 * (lv - 1)


## Returns the number of levels gained.
func add_exp(amount: int) -> int:
	if amount <= 0 or level >= MAX_LEVEL:
		return 0
	xp += amount
	var gained := 0
	while level < MAX_LEVEL and xp >= exp_to_next(level):
		xp -= exp_to_next(level)
		level += 1
		skill_points += 1
		gained += 1
	if level >= MAX_LEVEL:
		xp = 0
	if gained > 0:
		leveled_up.emit(level)
		Events.toast.emit("레벨 업! Lv.%d  (스킬 포인트 +%d)" % [level, gained])
	changed.emit()
	return gained


func add_gold(amount: int) -> void:
	gold = maxi(0, gold + amount)
	changed.emit()


func _on_enemy_killed(enemy: Node) -> void:
	var e := enemy as Enemy
	if e == null or e.stats == null:
		return
	var m := modifiers()
	var ex := roundi(e.stats.exp_reward * (1.0 + float(m.get(&"exp_pct", 0.0))))
	var g := roundi(e.stats.gold_reward * (1.0 + float(m.get(&"gold_pct", 0.0))))
	if ex > 0 or g > 0:
		var text := "+%d EXP" % ex if g <= 0 else "+%d EXP  +%dG" % [ex, g]
		FX.floating_text(text, e.global_position + Vector2(0, -e.body_height - 18), Color(0.7, 0.95, 1.0), 11)
	add_gold(g)
	add_exp(ex)


# --------------------------------------------------------------- modifiers ---
## Sum of equipment (with blacksmith levels), skill ranks, the active pet's
## passive and the priest's blessing.
func modifiers() -> Dictionary:
	var m := {}
	for slot in SLOTS:
		var item := ItemDB.get_item(equipment.get(slot, &""))
		if item != null:
			for key in item.bonuses:
				m[StringName(key)] = float(m.get(StringName(key), 0.0)) + float(item.bonuses[key])
			var lv := enhance_level(item.id)
			for key in ENHANCE_BONUS.get(slot, {}):
				m[key] = float(m.get(key, 0.0)) + float(ENHANCE_BONUS[slot][key]) * lv
	var pets := get_node_or_null(^"/root/Pets")
	if pets != null:
		var pm: Dictionary = pets.call(&"modifiers")
		for key in pm:
			m[StringName(key)] = float(m.get(StringName(key), 0.0)) + float(pm[key])
	var village := get_node_or_null(^"/root/Village")
	if village != null:
		m[&"exp_pct"] = float(m.get(&"exp_pct", 0.0)) + float(village.call(&"exp_bonus"))
	for node in skill_tree:
		var rank := int(skill_levels.get(node.id, 0))
		if rank > 0:
			for key in node.per_level:
				m[StringName(key)] = float(m.get(StringName(key), 0.0)) + float(node.per_level[key]) * rank
	return m


func mod(key: StringName) -> float:
	return float(modifiers().get(key, 0.0))


## The hero's current stats: base + level growth + equipment + skills.
func build_stats(base: PlayerStats) -> PlayerStats:
	var s := base.duplicate() as PlayerStats
	var m := modifiers()
	s.max_hp = base.max_hp + (level - 1) * HP_PER_LEVEL + int(m.get(&"max_hp", 0.0))
	s.attack = base.attack + (level - 1) * ATTACK_PER_LEVEL + int(m.get(&"attack", 0.0))
	s.max_mp = base.max_mp + (level - 1) * MP_PER_LEVEL + float(m.get(&"max_mp", 0.0))
	s.crit_chance = clampf(base.crit_chance + float(m.get(&"crit_chance", 0.0)), 0.0, 0.75)
	s.dodge_cooldown = maxf(0.15, base.dodge_cooldown - float(m.get(&"dodge_cooldown", 0.0)))
	s.dodge_iframes = base.dodge_iframes + float(m.get(&"dodge_iframes", 0.0))
	return s


func defense() -> float:
	return clampf(mod(&"defense_pct"), 0.0, 0.6)


func damage_multiplier(attack_id: StringName) -> float:
	if attack_id in BASIC_ATTACKS:
		return 1.0 + mod(&"basic_damage_pct")
	if attack_id == &"skill" or attack_id == &"crescent":
		return 1.0 + mod(&"skill_damage_pct")
	if attack_id == &"ultimate":
		return 1.0 + mod(&"ult_damage_pct")
	return 1.0


func skill_cooldown_reduction() -> float:
	return mod(&"skill_cooldown")


func ult_gain_multiplier() -> float:
	return 1.0 + mod(&"ult_gain_pct")


func equipped_weapon() -> WeaponData:
	var item := ItemDB.get_item(equipment.get(&"weapon", &""))
	return item.weapon if item != null else null


static func describe_stat(key: StringName, value: float) -> String:
	var label: String = STAT_KEYS.get(key, str(key))
	if key in PERCENT_KEYS:
		return "%s +%d%%" % [label, roundi(value * 100.0)]
	if key in SECONDS_KEYS:
		return "%s %.2f초" % [label, value]
	if key == &"hp_regen":
		return "%s +%.1f" % [label, value]
	return "%s +%d" % [label, roundi(value)]


# --------------------------------------------------------------- equipment ---
func owns(id: StringName) -> bool:
	if inventory.count(id) > 0:
		return true
	for slot in SLOTS:
		if equipment.get(slot, &"") == id:
			return true
	return false


## Moves an item from the bag into its slot (the old item goes back to the bag).
func equip(id: StringName) -> bool:
	var item := ItemDB.get_item(id)
	if item == null or not item.is_equipment() or inventory.count(id) < 1:
		return false
	var slot := item.slot()
	var old: StringName = equipment.get(slot, &"")
	inventory.remove(id, 1)
	if old != &"":
		inventory.add(old, 1)
	equipment[slot] = id
	changed.emit()
	return true


func unequip(slot: StringName) -> bool:
	var old: StringName = equipment.get(slot, &"")
	if old == &"" or slot == &"weapon":  # the hero always holds a weapon
		return false
	if inventory.add(old, 1) < 1:
		return false
	equipment[slot] = &""
	changed.emit()
	return true


# ------------------------------------------------------------- blacksmith ---
func enhance_level(id: StringName) -> int:
	return int(enhance.get(id, 0))


## {"gold": int, "gel": int} for the next level.
func enhance_cost(id: StringName) -> Dictionary:
	var lv := enhance_level(id)
	return {"gold": 40 * (lv + 1), "gel": 2 * (lv + 1)}


func can_enhance(id: StringName) -> bool:
	var item := ItemDB.get_item(id)
	if item == null or not item.is_equipment() or not owns(id) or enhance_level(id) >= MAX_ENHANCE:
		return false
	var c := enhance_cost(id)
	return gold >= int(c["gold"]) and inventory.count(ENHANCE_MATERIAL) >= int(c["gel"])


func enhance_item(id: StringName) -> bool:
	if not can_enhance(id):
		return false
	var c := enhance_cost(id)
	gold -= int(c["gold"])
	inventory.remove(ENHANCE_MATERIAL, int(c["gel"]))
	enhance[id] = enhance_level(id) + 1
	Events.item_enhanced.emit(id, enhance_level(id))
	changed.emit()
	return true


static func enhance_text(slot: StringName, lv: int) -> String:
	var parts: PackedStringArray = []
	var b: Dictionary = ENHANCE_BONUS.get(slot, {})
	for key in b:
		parts.append(describe_stat(key, float(b[key]) * lv))
	return ", ".join(parts)


## Display name with the enhancement level, e.g. "숲지기의 검 +2".
func item_label(id: StringName) -> String:
	var item := ItemDB.get_item(id)
	if item == null:
		return ""
	var lv := enhance_level(id)
	return item.display_name if lv <= 0 else "%s +%d" % [item.display_name, lv]


## Refunds every skill point (priest at the training ground).
func reset_skills() -> int:
	var refund := 0
	for node in skill_tree:
		refund += skill_rank(node.id) * node.cost
	skill_levels.clear()
	skill_points += refund
	changed.emit()
	return refund


# ------------------------------------------------------------------ skills ---
func skill_rank(id: StringName) -> int:
	return int(skill_levels.get(id, 0))


func can_upgrade_skill(id: StringName) -> bool:
	var node := skill_node(id)
	if node == null:
		return false
	return skill_points >= node.cost and skill_rank(id) < node.max_level and level >= node.required_level


func upgrade_skill(id: StringName) -> bool:
	if not can_upgrade_skill(id):
		return false
	var node := skill_node(id)
	skill_points -= node.cost
	skill_levels[id] = skill_rank(id) + 1
	changed.emit()
	return true


# ------------------------------------------------------------------- items ---
## Uses a consumable on the player. Returns true if it was used.
func use_consumable(id: StringName, player: Player) -> bool:
	var item := ItemDB.get_item(id)
	if item == null or item.type != ItemData.Type.CONSUMABLE or player == null or player.is_dead:
		return false
	var needs_hp := item.heal_hp > 0 and player.hp < player.max_hp
	var needs_mp := item.heal_mp > 0 and player.mp < player.stats.max_mp
	if not (needs_hp or needs_mp) or not inventory.remove(id, 1):
		return false
	if item.heal_hp > 0:
		player.heal(item.heal_hp)
	if item.heal_mp > 0:
		player.restore_mana(item.heal_mp)
	return true


func mark_stage_cleared(stage_id: String) -> void:
	if not cleared_stages.has(stage_id):
		cleared_stages.append(stage_id)
	changed.emit()


# ------------------------------------------------------------- save data ---
func to_dict() -> Dictionary:
	var eq := {}
	for slot in SLOTS:
		eq[str(slot)] = str(equipment.get(slot, &""))
	var sk := {}
	for id in skill_levels:
		sk[str(id)] = int(skill_levels[id])
	return {
		"level": level,
		"exp": xp,
		"gold": gold,
		"skill_points": skill_points,
		"skills": sk,
		"equipment": eq,
		"inventory": inventory.to_array(),
		"cleared_stages": Array(cleared_stages),
		"enhance": _enhance_dict(),
	}


func _enhance_dict() -> Dictionary:
	var e := {}
	for id in enhance:
		e[str(id)] = int(enhance[id])
	return e


## Restores from save data. Every value is validated: unknown items and
## skills are dropped, numbers are clamped.
func from_dict(d: Dictionary) -> void:
	level = clampi(int(d.get("level", 1)), 1, MAX_LEVEL)
	xp = clampi(int(d.get("exp", 0)), 0, exp_to_next(level))
	gold = maxi(0, int(d.get("gold", 0)))
	skill_points = clampi(int(d.get("skill_points", 0)), 0, MAX_LEVEL + 5)
	skill_levels.clear()
	var sk: Variant = d.get("skills", {})
	if typeof(sk) == TYPE_DICTIONARY:
		for key in sk:
			var node := skill_node(StringName(str(key)))
			if node != null:
				skill_levels[node.id] = clampi(int(sk[key]), 0, node.max_level)
	equipment = {&"weapon": &"", &"armor": &"", &"accessory": &""}
	var eq: Variant = d.get("equipment", {})
	if typeof(eq) == TYPE_DICTIONARY:
		for slot in SLOTS:
			var id := StringName(str((eq as Dictionary).get(str(slot), "")))
			var item := ItemDB.get_item(id)
			if item != null and item.slot() == slot:
				equipment[slot] = id
	if equipment[&"weapon"] == &"":
		equipment[&"weapon"] = &"item_sword_cheongwol"
	var inv: Variant = d.get("inventory", [])
	inventory.load_array(inv if typeof(inv) == TYPE_ARRAY else [])
	enhance.clear()
	var en: Variant = d.get("enhance", {})
	if typeof(en) == TYPE_DICTIONARY:
		for key in en:
			var item := ItemDB.get_item(StringName(str(key)))
			if item != null and item.is_equipment():
				enhance[item.id] = clampi(int((en as Dictionary)[key]), 0, MAX_ENHANCE)
	cleared_stages.clear()
	var cs: Variant = d.get("cleared_stages", [])
	if typeof(cs) == TYPE_ARRAY:
		for s in cs:
			cleared_stages.append(str(s))
	changed.emit()
