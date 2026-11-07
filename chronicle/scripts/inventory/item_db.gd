class_name ItemDB
extends RefCounted
## Loads every ItemData in res://data/items once and looks items up by id.
## Works in exported builds too (resources are listed as *.tres.remap there).

const DIR := "res://data/items"

static var _items: Dictionary = {}


static func all() -> Dictionary:
	if _items.is_empty():
		_load()
	return _items


static func get_item(id: StringName) -> ItemData:
	return all().get(id) as ItemData


static func exists(id: StringName) -> bool:
	return all().has(id)


static func _load() -> void:
	var dir := DirAccess.open(DIR)
	if dir == null:
		push_error("ItemDB: cannot open %s" % DIR)
		return
	for f in dir.get_files():
		var file_name := f.trim_suffix(".remap")
		if not file_name.ends_with(".tres"):
			continue
		var res := load(DIR.path_join(file_name))
		if res is ItemData:
			var item := res as ItemData
			_items[item.id] = item
