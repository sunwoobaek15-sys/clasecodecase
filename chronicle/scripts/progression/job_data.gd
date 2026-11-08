class_name JobData
extends Resource
## One advanced class (res://data/jobs/job_*.tres), chosen at the priest
## Serena after the "새로운 길" quest. Works with every weapon; the bonuses
## (Profile.STAT_KEYS) favour one style of play, and any job adds one relic
## slot.

const DIR := "res://data/jobs"
static var _list: Array[JobData] = []

@export var id: StringName = &""
@export var display_name: String = ""
@export_multiline var description: String = ""
@export var icon: Texture2D
@export var bonuses: Dictionary = {}
## Weapons that suit the job (text only).
@export var suits: String = ""
@export var order: int = 0


func bonus_text() -> String:
	var parts: PackedStringArray = []
	for key in bonuses:
		parts.append(Profile.describe_stat(StringName(key), float(bonuses[key])))
	return ", ".join(parts)


static func all() -> Array[JobData]:
	if _list.is_empty():
		for r in DataDir.load_all(DIR):
			if r is JobData:
				_list.append(r as JobData)
		_list.sort_custom(func(a: JobData, b: JobData) -> bool: return a.order < b.order)
	return _list


static func find(job_id: StringName) -> JobData:
	for j in all():
		if j.id == job_id:
			return j
	return null
