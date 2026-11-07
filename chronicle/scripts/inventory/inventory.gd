class_name Inventory
extends RefCounted
## Bag of item stacks. Stacks respect ItemData.max_stack; the bag has a
## fixed number of slots. Equipped items are NOT in the bag (see Profile).

signal changed

const MAX_SLOTS := 30

var slots: Array[Dictionary] = []  ## [{"id": StringName, "count": int}]


func count(id: StringName) -> int:
	var n := 0
	for s in slots:
		if s["id"] == id:
			n += int(s["count"])
	return n


func is_full_for(id: StringName) -> bool:
	return space_for(id) <= 0


## How many of this item still fit.
func space_for(id: StringName) -> int:
	var item := ItemDB.get_item(id)
	if item == null:
		return 0
	var room := (MAX_SLOTS - slots.size()) * item.max_stack
	for s in slots:
		if s["id"] == id:
			room += item.max_stack - int(s["count"])
	return room


## Adds up to `amount`; returns how many were actually added.
func add(id: StringName, amount: int = 1) -> int:
	var item := ItemDB.get_item(id)
	if item == null or amount <= 0:
		if item == null:
			push_warning("Inventory: unknown item '%s'" % id)
		return 0
	var left := amount
	for s in slots:
		if left <= 0:
			break
		if s["id"] == id and int(s["count"]) < item.max_stack:
			var n := mini(left, item.max_stack - int(s["count"]))
			s["count"] = int(s["count"]) + n
			left -= n
	while left > 0 and slots.size() < MAX_SLOTS:
		var n := mini(left, item.max_stack)
		slots.append({"id": id, "count": n})
		left -= n
	if left != amount:
		changed.emit()
	return amount - left


## Removes `amount` (from the last stacks first). False if not enough.
func remove(id: StringName, amount: int = 1) -> bool:
	if amount <= 0 or count(id) < amount:
		return false
	var left := amount
	for i in range(slots.size() - 1, -1, -1):
		if left <= 0:
			break
		if slots[i]["id"] != id:
			continue
		var n := mini(left, int(slots[i]["count"]))
		slots[i]["count"] = int(slots[i]["count"]) - n
		left -= n
		if int(slots[i]["count"]) <= 0:
			slots.remove_at(i)
	changed.emit()
	return true


func clear() -> void:
	slots.clear()
	changed.emit()


func to_array() -> Array:
	var out: Array = []
	for s in slots:
		out.append({"id": str(s["id"]), "count": int(s["count"])})
	return out


## Restores from save data, skipping unknown ids and bad counts.
func load_array(data: Array) -> void:
	slots.clear()
	for entry in data:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var d: Dictionary = entry
		var id := StringName(str(d.get("id", "")))
		var n := int(d.get("count", 0))
		if n > 0 and ItemDB.exists(id):
			add(id, n)
	changed.emit()
