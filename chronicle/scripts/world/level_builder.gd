class_name LevelBuilder
extends RefCounted
## Builds a stage from a plain-text map (res://data/levels/*.txt):
## a TileSet with collision (solid tiles + one-way ledges), auto-tiled ground,
## random decorations, and a list of markers (player start, enemies, signs...).
## Text maps keep level layout data-driven and easy to diff and edit.

const TILE := 16
const SOLID_CHARS := "#S"
const DECOR_CHANCE := 0.38

## Atlas coordinates in assets/environments/forgotten_forest/tiles.png
const T_TOP: Array[Vector2i] = [Vector2i(0, 0), Vector2i(1, 0)]
const T_TOP_LEFT := Vector2i(2, 0)
const T_TOP_RIGHT := Vector2i(3, 0)
const T_TOP_SINGLE := Vector2i(7, 2)
const T_LEDGE_LEFT := Vector2i(4, 0)
const T_LEDGE_MID := Vector2i(5, 0)
const T_LEDGE_RIGHT := Vector2i(6, 0)
const T_LEDGE_SINGLE := Vector2i(7, 0)
const T_FILL: Array[Vector2i] = [Vector2i(0, 1), Vector2i(1, 1), Vector2i(4, 1), Vector2i(5, 1)]
const T_DEEP: Array[Vector2i] = [Vector2i(6, 1), Vector2i(7, 1)]
const T_LEFT := Vector2i(2, 1)
const T_RIGHT := Vector2i(3, 1)
const T_BOTTOM: Array[Vector2i] = [Vector2i(0, 2), Vector2i(1, 2)]
const T_BOTTOM_LEFT := Vector2i(2, 2)
const T_BOTTOM_RIGHT := Vector2i(3, 2)
const T_STONE: Array[Vector2i] = [Vector2i(4, 2), Vector2i(5, 2)]
const T_STONE_MOSS := Vector2i(6, 2)
const T_DECOR: Array[Vector2i] = [Vector2i(0, 3), Vector2i(1, 3), Vector2i(2, 3), Vector2i(3, 3),
		Vector2i(4, 3), Vector2i(5, 3), Vector2i(6, 3), Vector2i(7, 3)]

var rows: PackedStringArray = []
var width: int = 0
var height: int = 0
var signs: Dictionary = {}       ## int -> String
var markers: Array[Dictionary] = []  ## {char, cell: Vector2i, position: Vector2}


static func load_map(path: String) -> LevelBuilder:
	var lb := LevelBuilder.new()
	var text := FileAccess.get_file_as_string(path)
	if text.is_empty():
		push_error("LevelBuilder: cannot read %s" % path)
		return lb
	var in_map := false
	for raw in text.split("\n"):
		var line := raw.strip_edges(false, true)
		if not in_map:
			if line.begins_with("# ") or line == "#" or line.is_empty():
				continue
			if line.begins_with("sign "):
				var colon := line.find(":")
				var idx := int(line.substr(5, colon - 5))
				lb.signs[idx] = line.substr(colon + 1).strip_edges().replace("\\n", "\n")
			elif line == "map:":
				in_map = true
			continue
		if line.is_empty():
			continue
		lb.rows.append(line)
	lb.height = lb.rows.size()
	for r in lb.rows:
		lb.width = maxi(lb.width, r.length())
	lb._collect_markers()
	return lb


func char_at(x: int, y: int) -> String:
	if y < 0 or y >= height:
		return "#" if y >= height else "."
	if x < 0 or x >= width:
		return "#"
	var r := rows[y]
	return r[x] if x < r.length() else "."


func is_solid(x: int, y: int) -> bool:
	return SOLID_CHARS.contains(char_at(x, y))


func cell_to_world(cell: Vector2i) -> Vector2:
	## Bottom centre of a cell = the ground point for something standing in it.
	return Vector2(cell.x * TILE + TILE / 2.0, (cell.y + 1) * TILE)


func pixel_size() -> Vector2:
	return Vector2(width * TILE, height * TILE)


func _collect_markers() -> void:
	for y in height:
		var r := rows[y]
		for x in r.length():
			var c := r[x]
			if c in ["#", "S", "=", "."]:
				continue
			markers.append({"char": c, "cell": Vector2i(x, y), "position": cell_to_world(Vector2i(x, y))})


func markers_of(c: String) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for m in markers:
		if m["char"] == c:
			out.append(m)
	return out


func first_marker(c: String, fallback: Vector2 = Vector2.ZERO) -> Vector2:
	for m in markers:
		if m["char"] == c:
			return m["position"]
	return fallback


static func build_tileset(texture: Texture2D) -> TileSet:
	var ts := TileSet.new()
	ts.tile_size = Vector2i(TILE, TILE)
	ts.add_physics_layer()
	ts.set_physics_layer_collision_layer(0, 1)
	ts.set_physics_layer_collision_mask(0, 0)
	var src := TileSetAtlasSource.new()
	src.texture = texture
	src.texture_region_size = Vector2i(TILE, TILE)
	ts.add_source(src, 0)
	var h := TILE / 2.0
	var full := PackedVector2Array([Vector2(-h, -h), Vector2(h, -h), Vector2(h, h), Vector2(-h, h)])
	var ledge := PackedVector2Array([Vector2(-h, -h), Vector2(h, -h), Vector2(h, -h + 6), Vector2(-h, -h + 6)])
	for y in 4:
		for x in 8:
			var c := Vector2i(x, y)
			src.create_tile(c)
			if y == 3:
				continue  # decorations: no collision
			var td := src.get_tile_data(c, 0)
			td.add_collision_polygon(0)
			if y == 0 and x >= 4:
				td.set_collision_polygon_points(0, 0, ledge)
				td.set_collision_polygon_one_way(0, 0, true)
			else:
				td.set_collision_polygon_points(0, 0, full)
	return ts


## Fills the ground and decoration layers. Returns the number of solid cells.
func paint(ground: TileMapLayer, decor: TileMapLayer, seed_value: int = 7) -> int:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_value
	var count := 0
	for y in height:
		for x in width:
			var c := char_at(x, y)
			if c == "#":
				ground.set_cell(Vector2i(x, y), 0, _ground_tile(x, y, rng))
				count += 1
				if not is_solid(x, y - 1) and char_at(x, y - 1) == "." and rng.randf() < DECOR_CHANCE:
					decor.set_cell(Vector2i(x, y - 1), 0, T_DECOR[rng.randi_range(0, T_DECOR.size() - 1)])
			elif c == "S":
				ground.set_cell(Vector2i(x, y), 0, T_STONE_MOSS if not is_solid(x, y - 1) else T_STONE[rng.randi_range(0, 1)])
				count += 1
			elif c == "=":
				var l := char_at(x - 1, y) == "="
				var r := char_at(x + 1, y) == "="
				var tile := T_LEDGE_MID
				if not l and not r:
					tile = T_LEDGE_SINGLE
				elif not l:
					tile = T_LEDGE_LEFT
				elif not r:
					tile = T_LEDGE_RIGHT
				ground.set_cell(Vector2i(x, y), 0, tile)
	return count


func _ground_tile(x: int, y: int, rng: RandomNumberGenerator) -> Vector2i:
	var up := is_solid(x, y - 1)
	var down := is_solid(x, y + 1)
	var left := is_solid(x - 1, y)
	var right := is_solid(x + 1, y)
	if not up:
		if not left and not right:
			return T_TOP_SINGLE
		if not left:
			return T_TOP_LEFT
		if not right:
			return T_TOP_RIGHT
		return T_TOP[rng.randi_range(0, 1)]
	if not down:
		if not left:
			return T_BOTTOM_LEFT
		if not right:
			return T_BOTTOM_RIGHT
		return T_BOTTOM[rng.randi_range(0, 1)]
	if not left:
		return T_LEFT
	if not right:
		return T_RIGHT
	var depth := 0
	while depth < 4 and is_solid(x, y - depth - 1):
		depth += 1
	if depth >= 3:
		return T_DEEP[rng.randi_range(0, 1)]
	return T_FILL[rng.randi_range(0, T_FILL.size() - 1)]
