extends Node
## Bestiary / collection book (autoload "Codex").
##
## Categories: monsters, bosses, weapons, pets, relics. Monsters and bosses
## are recorded when defeated, weapons and pets when obtained. Entries marked
## "future" belong to content that is not in the game yet (shown as "준비 중").
## The library's scholar pays a reward for every recorded entry.

signal changed
signal discovered(id: StringName)

const REWARD_PER_ENTRY := 10
const CATEGORIES := [
	[&"monster", "몬스터"], [&"boss", "보스"], [&"weapon", "무기"], [&"pet", "펫"], [&"relic", "유물"],
]
## Static entries. Weapons and pets are added from ItemDB / PetDB at start.
const BASE_ENTRIES := [
	{"id": &"forest_slime", "cat": &"monster", "name": "숲의 정령 슬라임", "region": "잊혀진 숲",
	 "tex": "res://assets/enemies/forest_slime/slime_frames.tres",
	 "desc": "머리에 나뭇잎을 단 초록 슬라임. 슬라임 탄을 쏘고, 가까이 가면 몸을 부풀려 주변을 덮친다."},
	{"id": &"forest_slime_small", "cat": &"monster", "name": "꼬마 숲 슬라임", "region": "잊혀진 숲",
	 "tex": "res://assets/enemies/forest_slime_small/slime_small_frames.tres",
	 "desc": "작고 재빠른 슬라임. 원거리 공격은 못 하지만 떼로 몰려다닌다."},
	{"id": &"forest_slime_elite", "cat": &"monster", "name": "자수정 슬라임", "region": "잊혀진 숲",
	 "tex": "res://assets/enemies/forest_slime/art/elite.png",
	 "desc": "시간의 결정을 삼켜 보랏빛으로 변한 강화형 슬라임. 3방향 탄과 넓은 튀김 공격을 쓴다."},
	{"id": &"verdan", "cat": &"boss", "name": "숲의 수호자 베르단", "region": "잊혀진 숲",
	 "tex": "res://assets/bosses/verdan/art/full_art.png",
	 "desc": "몸속에 시간의 결정을 품은 고대 나무 정령. 나무 던지기, 뿌리 돌진, 숲의 분노로 숲을 지킨다."},
	{"id": &"chronos", "cat": &"boss", "name": "크로노스", "region": "무너진 시계 도시", "future": true,
	 "desc": "무너진 시계 도시의 지배자. (다음 업데이트에서 만날 수 있습니다)"},
	{"id": &"weapon_greatsword", "cat": &"weapon", "name": "대검", "future": true, "desc": "준비 중인 무기 (Phase 4)"},
	{"id": &"weapon_dual", "cat": &"weapon", "name": "쌍검", "future": true, "desc": "준비 중인 무기 (Phase 4)"},
	{"id": &"weapon_staff", "cat": &"weapon", "name": "지팡이", "future": true, "desc": "준비 중인 무기 (Phase 4)"},
	{"id": &"weapon_spear", "cat": &"weapon", "name": "창", "future": true, "desc": "준비 중인 무기 (Phase 4)"},
	{"id": &"relic_placeholder", "cat": &"relic", "name": "유물", "future": true,
	 "desc": "유물 시스템은 Phase 4에서 추가됩니다."},
]

var entries: Array[Dictionary] = []
var known: Dictionary = {}     ## id -> true
var kills: Dictionary = {}     ## id -> count
var claimed: Dictionary = {}   ## id -> true (library reward paid)


func _ready() -> void:
	_build_entries()
	Events.enemy_killed.connect(_on_enemy_killed)
	Profile.changed.connect(_check_owned, CONNECT_DEFERRED)
	Pets.pet_obtained.connect(func(id: StringName) -> void: discover(id))


func _build_entries() -> void:
	entries.clear()
	for e in BASE_ENTRIES:
		if e["cat"] == &"weapon":
			continue
		entries.append(e.duplicate())
	var weapons: Array = []
	for id in ItemDB.all():
		var item := ItemDB.get_item(id)
		if item.type == ItemData.Type.WEAPON:
			weapons.append(item)
	weapons.sort_custom(func(a: ItemData, b: ItemData) -> bool: return a.price < b.price)
	for item in weapons:
		entries.append({"id": item.id, "cat": &"weapon", "name": item.display_name, "desc": item.description,
				"icon": item.icon})
	for e in BASE_ENTRIES:
		if e["cat"] == &"weapon":
			entries.append(e.duplicate())
	for pet in PetDB.all():
		entries.append({"id": pet.id, "cat": &"pet", "name": pet.display_name, "desc": pet.description,
				"icon": pet.art})


func reset() -> void:
	known.clear()
	kills.clear()
	claimed.clear()
	_check_owned(true)
	changed.emit()


func entries_in(cat: StringName) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for e in entries:
		if e["cat"] == cat:
			out.append(e)
	return out


func entry(id: StringName) -> Dictionary:
	for e in entries:
		if e["id"] == id:
			return e
	return {}


## Picture for an entry: a Texture2D, or the first idle frame of SpriteFrames.
static func texture_of(e: Dictionary) -> Texture2D:
	if e.has("icon") and e["icon"] is Texture2D:
		return e["icon"]
	var path := str(e.get("tex", ""))
	if path.is_empty() or not ResourceLoader.exists(path):
		return null
	var res := load(path)
	if res is Texture2D:
		return res
	if res is SpriteFrames:
		var sf := res as SpriteFrames
		var anim: StringName = &"idle" if sf.has_animation(&"idle") else StringName(sf.get_animation_names()[0])
		return sf.get_frame_texture(anim, 0)
	return null


func is_known(id: StringName) -> bool:
	return known.has(id)


func count_known() -> int:
	return known.size()


func count_total() -> int:
	var n := 0
	for e in entries:
		if not e.get("future", false):
			n += 1
	return n


func discover(id: StringName, silent: bool = false) -> void:
	var e := entry(id)
	if e.is_empty() or e.get("future", false) or known.has(id):
		return
	known[id] = true
	discovered.emit(id)
	if not silent:
		Events.toast.emit("도감 등록: %s" % e["name"])
	changed.emit()


func record_kill(id: StringName) -> void:
	if entry(id).is_empty():
		return
	kills[id] = int(kills.get(id, 0)) + 1
	discover(id)
	changed.emit()


func unclaimed_count() -> int:
	var n := 0
	for id in known:
		if not claimed.has(id):
			n += 1
	return n


## Pays the library reward for every new entry. Returns the gold paid.
func claim_rewards() -> int:
	var n := unclaimed_count()
	if n <= 0:
		return 0
	for id in known:
		claimed[id] = true
	Profile.add_gold(n * REWARD_PER_ENTRY)
	changed.emit()
	return n * REWARD_PER_ENTRY


func _on_enemy_killed(enemy: Node) -> void:
	var e := enemy as Enemy
	if e != null and e.stats != null:
		record_kill(e.stats.id)


func _check_owned(silent: bool = false) -> void:
	for e in entries:
		if e["cat"] == &"weapon" and not e.get("future", false) and not known.has(e["id"]):
			if Profile.owns(e["id"]):
				discover(e["id"], silent)


# ------------------------------------------------------------- save data ---
func to_dict() -> Dictionary:
	var k: Array = []
	for id in known:
		k.append(str(id))
	var c: Array = []
	for id in claimed:
		c.append(str(id))
	var kl := {}
	for id in kills:
		kl[str(id)] = int(kills[id])
	return {"known": k, "kills": kl, "claimed": c}


func from_dict(d: Dictionary) -> void:
	known.clear()
	kills.clear()
	claimed.clear()
	var k: Variant = d.get("known", [])
	if typeof(k) == TYPE_ARRAY:
		for id in k:
			var e := entry(StringName(str(id)))
			if not e.is_empty() and not e.get("future", false):
				known[StringName(str(id))] = true
	var kl: Variant = d.get("kills", {})
	if typeof(kl) == TYPE_DICTIONARY:
		for id in kl:
			if not entry(StringName(str(id))).is_empty():
				kills[StringName(str(id))] = maxi(0, int((kl as Dictionary)[id]))
	var c: Variant = d.get("claimed", [])
	if typeof(c) == TYPE_ARRAY:
		for id in c:
			if known.has(StringName(str(id))):
				claimed[StringName(str(id))] = true
	changed.emit()
