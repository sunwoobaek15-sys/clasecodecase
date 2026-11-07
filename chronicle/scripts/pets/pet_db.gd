class_name PetDB
## Static lookup of all PetData resources in res://data/pets.

const DIR := "res://data/pets"
static var _cache: Dictionary = {}
static var _list: Array[PetData] = []


static func _ensure() -> void:
	if not _list.is_empty():
		return
	var dir := DirAccess.open(DIR)
	if dir == null:
		push_error("PetDB: cannot open %s" % DIR)
		return
	for f in dir.get_files():
		var file_name := f.trim_suffix(".remap")
		if file_name.ends_with(".tres"):
			var res := load(DIR.path_join(file_name))
			if res is PetData:
				_list.append(res as PetData)
				_cache[(res as PetData).id] = res
	_list.sort_custom(func(a: PetData, b: PetData) -> bool: return a.order < b.order)


static func all() -> Array[PetData]:
	_ensure()
	return _list


static func get_pet(id: StringName) -> PetData:
	_ensure()
	return _cache.get(id, null)
