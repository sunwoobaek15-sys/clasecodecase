extends SceneTree
## Step 3 of the asset pipeline: turns the *_sprites.json files written by
## tools/build_sprites.py into SpriteFrames resources (*_frames.tres).
##
## Every frame becomes an AtlasTexture whose margin restores the shared cell,
## so all frames of a character have the same size and the ground anchor stays
## fixed. The anchor is stored as metadata ("anchor") on the SpriteFrames and
## Entity.apply_sprite_frames() turns it into the sprite offset.
##
## Run:  godot --headless --path . -s res://tools/build_sprite_frames.gd

const SOURCES := [
	"res://assets/characters/hero/hero_sprites.json",
	"res://assets/enemies/forest_slime/slime_sprites.json",
	"res://assets/enemies/forest_slime_small/slime_small_sprites.json",
	"res://assets/bosses/verdan/verdan_sprites.json",
	"res://assets/effects/hero/hero_fx_sprites.json",
	"res://assets/effects/slime/slime_fx_sprites.json",
	"res://assets/effects/verdan/verdan_fx_sprites.json",
	"res://assets/pets/cat/pet_cat_sprites.json",
	"res://assets/pets/fox/pet_fox_sprites.json",
	"res://assets/pets/dragon/pet_dragon_sprites.json",
	"res://assets/pets/spirit_slime/pet_spirit_slime_sprites.json",
	"res://assets/pets/bird/pet_bird_sprites.json",
]


func _initialize() -> void:
	var failures := 0
	for path in SOURCES:
		if not _build(path):
			failures += 1
	print("build_sprite_frames: %d built, %d failed" % [SOURCES.size() - failures, failures])
	quit(0 if failures == 0 else 1)


func _build(json_path: String) -> bool:
	var text := FileAccess.get_file_as_string(json_path)
	if text.is_empty():
		push_error("missing %s" % json_path)
		return false
	var data: Variant = JSON.parse_string(text)
	if typeof(data) != TYPE_DICTIONARY:
		push_error("bad json %s" % json_path)
		return false
	var atlas := load(str(data["atlas"])) as Texture2D
	if atlas == null:
		push_error("atlas not imported: %s" % data["atlas"])
		return false
	var cell := Vector2(data["cell"][0], data["cell"][1])
	var textures := {}
	for fname in data["frames"]:
		var f: Dictionary = data["frames"][fname]
		var at := AtlasTexture.new()
		at.atlas = atlas
		at.region = Rect2(f["region"][0], f["region"][1], f["region"][2], f["region"][3])
		at.margin = Rect2(f["offset"][0], f["offset"][1], cell.x - float(f["region"][2]), cell.y - float(f["region"][3]))
		at.filter_clip = true
		textures[fname] = at
	var frames := SpriteFrames.new()
	if frames.has_animation(&"default"):
		frames.remove_animation(&"default")
	for aname in data["animations"]:
		var a: Dictionary = data["animations"][aname]
		frames.add_animation(aname)
		frames.set_animation_speed(aname, float(a["fps"]))
		frames.set_animation_loop(aname, bool(a["loop"]))
		for fname in a["frames"]:
			frames.add_frame(aname, textures[fname])
	frames.set_meta("anchor", Vector2(data["anchor"][0], data["anchor"][1]))
	frames.set_meta("cell", cell)
	frames.set_meta("source_sheet", str(data.get("source_sheet", "")))
	var out := json_path.replace("_sprites.json", "_frames.tres")
	var err := ResourceSaver.save(frames, out)
	if err != OK:
		push_error("could not save %s: %s" % [out, error_string(err)])
		return false
	print("  ", out, "  animations=", frames.get_animation_names().size())
	return true
