class_name RelicDB
extends RefCounted
## Static lookup of every RelicData in res://data/relics (sorted by order).

const DIR := "res://data/relics"
static var _list: Array[RelicData] = []
static var _by_id: Dictionary = {}


static func _ensure() -> void:
	if not _list.is_empty():
		return
	for r in DataDir.load_all(DIR):
		if r is RelicData:
			_list.append(r as RelicData)
			_by_id[(r as RelicData).id] = r
	_list.sort_custom(func(a: RelicData, b: RelicData) -> bool: return a.order < b.order)


static func all() -> Array[RelicData]:
	_ensure()
	return _list


static func get_relic(id: StringName) -> RelicData:
	_ensure()
	return _by_id.get(id, null) as RelicData


static func exists(id: StringName) -> bool:
	_ensure()
	return _by_id.has(id)
