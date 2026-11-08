class_name RelicData
extends Resource
## One relic (res://data/relics/relic_*.tres): a passive trinket. Relics are
## collected separately from the bag; up to Profile.relic_slots() of them are
## equipped at once. Bonuses use the same stat keys as equipment, skills and
## pets (Profile.STAT_KEYS).

enum Rarity { COMMON, RARE, EPIC, LEGENDARY }

const RARITY_NAMES := ["일반", "희귀", "영웅", "전설"]
const RARITY_COLORS := [Color(0.85, 0.87, 0.9), Color(0.45, 0.75, 1.0), Color(0.8, 0.55, 1.0), Color(1.0, 0.78, 0.3)]

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var icon: Texture2D
@export var rarity: Rarity = Rarity.COMMON
@export var bonuses: Dictionary = {}
## How to get it (shown in the relic book before it is found).
@export var source: String = ""
## Shop price (0 = not sold). Duplicates turn into price / 2 gold (min 50).
@export var price: int = 0
@export var order: int = 0


func rarity_name() -> String:
	return RARITY_NAMES[rarity]


func rarity_color() -> Color:
	return RARITY_COLORS[rarity]


func bonus_text() -> String:
	var parts: PackedStringArray = []
	for key in bonuses:
		parts.append(Profile.describe_stat(StringName(key), float(bonuses[key])))
	return ", ".join(parts)


func duplicate_gold() -> int:
	return maxi(50, price / 2)
