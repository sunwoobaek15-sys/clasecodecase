extends Node
## Bestiary / collection book (autoload "Codex").
##
## Categories: monsters, bosses, weapons, pets, relics. Monsters and bosses
## are recorded when defeated, weapons, pets and relics when obtained. Entries
## marked "future" belong to content that is not in the game yet (shown as
## "준비 중"). An entry's "hint" is shown while it is still unknown.
## The library's scholar pays a reward for every recorded entry.

signal changed
signal discovered(id: StringName)

const REWARD_PER_ENTRY := 10
const CATEGORIES := [
	[&"monster", "몬스터"], [&"boss", "보스"], [&"weapon", "무기"], [&"pet", "펫"], [&"relic", "유물"],
]
## Static entries. Weapons, pets and relics are added from ItemDB / PetDB /
## RelicDB at start.
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
	{"id": &"clockwork_slime", "cat": &"monster", "name": "태엽 슬라임", "region": "무너진 시계 도시",
	 "tex": "res://assets/enemies/clockwork_slime/clockwork_slime_frames.tres",
	 "desc": "멈춘 시계의 태엽을 삼킨 청동빛 슬라임. 숲의 슬라임보다 단단하고 푸른 시간 탄을 쏜다."},
	{"id": &"clockwork_slime_small", "cat": &"monster", "name": "꼬마 태엽 슬라임", "region": "무너진 시계 도시",
	 "tex": "res://assets/enemies/clockwork_slime_small/clockwork_slime_small_frames.tres",
	 "desc": "작고 재빠른 태엽 슬라임. 떼로 몰려와 몸으로 부딪친다."},
	{"id": &"gear_sentinel", "cat": &"monster", "name": "톱니 파수꾼", "region": "무너진 시계 도시",
	 "tex": "res://assets/enemies/gear_sentinel/ring.png",
	 "desc": "외눈을 단 채 떠다니는 톱니바퀴. 눈이 붉게 빛나면 회전 톱니를 쏜다."},
	{"id": &"cloud_slime", "cat": &"monster", "name": "구름 슬라임", "region": "하늘의 폐허",
	 "tex": "res://assets/enemies/cloud_slime/cloud_slime_frames.tres",
	 "desc": "구름을 머금어 하얗게 부푼 슬라임. 가장 단단한 슬라임으로 번개 빛 탄을 쏜다."},
	{"id": &"cloud_slime_small", "cat": &"monster", "name": "꼬마 구름 슬라임", "region": "하늘의 폐허",
	 "tex": "res://assets/enemies/cloud_slime_small/cloud_slime_small_frames.tres",
	 "desc": "작은 구름 덩어리 같은 슬라임. 빠르게 튀어 오른다."},
	{"id": &"wind_wisp", "cat": &"monster", "name": "바람 정령", "region": "하늘의 폐허",
	 "tex": "res://assets/enemies/wind_wisp/wind_wisp_frames.tres",
	 "desc": "폐허를 떠도는 작은 바람. 눈이 붉어지며 몸을 떨면 곧장 돌진한다."},
	{"id": &"ruin_guardian", "cat": &"monster", "name": "폐허 수호상", "region": "하늘의 폐허",
	 "tex": "res://assets/enemies/ruin_guardian/ruin_guardian_frames.tres",
	 "desc": "가까이 가면 깨어나는 돌 수호상. 느리지만 두 팔로 내려찍는 충격파가 강하다."},
	{"id": &"verdan", "cat": &"boss", "name": "숲의 수호자 베르단", "region": "잊혀진 숲",
	 "tex": "res://assets/bosses/verdan/art/full_art.png",
	 "desc": "몸속에 시간의 결정을 품은 고대 나무 정령. 나무 던지기, 뿌리 돌진, 숲의 분노로 숲을 지킨다."},
	{"id": &"chronos", "cat": &"boss", "name": "시간의 지배자 크로노스", "region": "무너진 시계 도시",
	 "tex": "res://assets/bosses/chronos/art/portrait.png",
	 "desc": "무너진 시계 도시의 지배자. 시간 정지, 시계 톱니, 시간 역행, 푸른 시간 폭발을 다루며 체력이 절반 이하가 되면 시간이 보랏빛으로 폭주한다."},
	{"id": &"sky_dragon", "cat": &"boss", "name": "폭풍의 수호룡 템페스타", "region": "하늘의 폐허",
	 "tex": "res://assets/bosses/sky_dragon/art/full_art.png",
	 "desc": "하늘의 신전을 지키는 폭풍의 용. 폭풍 구슬, 급강하, 낙뢰를 다루며 체력이 절반 이하가 되면 강풍까지 부른다. (전용 디자인이 나오기 전까지 펫 시트의 용 디자인을 사용)"},
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
	Events.relic_obtained.connect(func(id: StringName) -> void: discover(id, true))


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
				"icon": pet.art, "hint": pet.unlock_hint})
	for relic in RelicDB.all():
		entries.append({"id": relic.id, "cat": &"relic", "name": relic.display_name, "icon": relic.icon,
				"desc": "[%s] %s\n%s\n얻는 곳: %s" % [relic.rarity_name(), relic.bonus_text(), relic.description, relic.source],
				"hint": relic.source})


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
		if known.has(e["id"]) or e.get("future", false):
			continue
		if (e["cat"] == &"weapon" and Profile.owns(e["id"])) or (e["cat"] == &"relic" and Profile.owns_relic(e["id"])):
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
