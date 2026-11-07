extends TestCase
## Asset pipeline output, data resources and level data.

const FRAMES := {
	"res://assets/characters/hero/hero_frames.tres": [&"idle", &"walk", &"run", &"jump", &"fall", &"land",
		&"attack1", &"attack2", &"attack3", &"air_attack", &"heavy_charge", &"heavy", &"dodge", &"hurt",
		&"death", &"skill", &"ultimate"],
	"res://assets/enemies/forest_slime/slime_frames.tres": [&"idle", &"move", &"run", &"jump", &"hurt",
		&"shot", &"splash", &"death"],
	"res://assets/enemies/forest_slime_small/slime_small_frames.tres": [&"idle", &"move", &"run", &"jump",
		&"hurt", &"shot", &"splash", &"death"],
	"res://assets/bosses/verdan/verdan_frames.tres": [&"idle", &"move", &"throw", &"roots", &"wrath", &"hit", &"die"],
}


func test_sprite_frames_have_all_animations() -> void:
	for path in FRAMES:
		var sf := load(path) as SpriteFrames
		if not check(sf != null, "loads " + path):
			continue
		check(sf.has_meta("anchor"), path.get_file() + " stores the ground anchor")
		var cell: Vector2 = sf.get_meta("cell", Vector2.ZERO)
		check(cell.x > 0 and cell.y > 0, path.get_file() + " stores the cell size")
		for anim in FRAMES[path]:
			if not check(sf.has_animation(anim), "%s has '%s'" % [path.get_file(), anim]):
				continue
			var n := sf.get_frame_count(anim)
			check(n >= 1, "%s/%s has frames" % [path.get_file(), anim])
			for i in n:
				var tex := sf.get_frame_texture(anim, i)
				check(tex != null and tex.get_size() == cell, "%s/%s[%d] uses the shared cell" % [path.get_file(), anim, i])


func test_frame_counts_match_reference_sheets() -> void:
	var hero := load("res://assets/characters/hero/hero_frames.tres") as SpriteFrames
	check_eq(hero.get_frame_count(&"run"), 4, "hero run = 4 frames from sheet row 1")
	check_eq(hero.get_frame_count(&"idle"), 8, "hero idle = 5 frames ping-pong")
	var slime := load("res://assets/enemies/forest_slime/slime_frames.tres") as SpriteFrames
	check_eq(slime.get_frame_count(&"idle"), 7, "slime idle = 7 frames")
	check_eq(slime.get_frame_count(&"move"), 6, "slime move = 6 frames")
	var verdan := load("res://assets/bosses/verdan/verdan_frames.tres") as SpriteFrames
	check_eq(verdan.get_frame_count(&"idle"), 6, "verdan idle = 6 frames")
	check_eq(verdan.get_frame_count(&"move"), 6, "verdan move = 6 frames")


func test_sprites_render_one_to_one() -> void:
	check_eq(int(ProjectSettings.get_setting("rendering/textures/canvas_textures/default_texture_filter")), 0,
			"nearest-neighbour filtering")
	for scene in ["res://scenes/player/player.tscn", "res://scenes/enemies/slime.tscn", "res://scenes/bosses/verdan.tscn"]:
		var inst := (load(scene) as PackedScene).instantiate()
		var spr := inst.get_node("Visual/Sprite") as AnimatedSprite2D
		check(spr.scale == Vector2.ONE, scene.get_file() + ": sprite is not rescaled at runtime")
		inst.free()


func test_weapon_and_attack_data() -> void:
	var w := load("res://data/items/weapon_cheongwol_sword.tres") as WeaponData
	if not check(w != null, "sword weapon loads"):
		return
	check_eq(w.combo().size(), 3, "3-hit combo")
	for a in [w.air_attack, w.heavy_attack, w.skill, w.ultimate]:
		check(a != null, "weapon move set complete")
	for a in w.combo() + [w.air_attack, w.heavy_attack, w.skill]:
		check(a.active_start < a.active_end and a.active_end <= a.duration, "%s hit window inside duration" % a.id)
	check(w.combo_3.damage_multiplier > w.combo_1.damage_multiplier, "finisher is stronger")
	check(w.heavy_attack.damage_multiplier > w.combo_3.damage_multiplier, "heavy is strongest melee")
	check(w.skill.mp_cost > 0.0 and w.skill.cooldown > 0.0, "skill costs MP and has a cooldown")
	var stats := load("res://data/player/hero_stats.tres") as PlayerStats
	check(stats.dodge_iframes >= stats.dodge_time, "dodge is invulnerable for its whole duration")


func test_enemy_data() -> void:
	var normal := load("res://data/enemies/forest_slime.tres") as EnemyStats
	var small := load("res://data/enemies/forest_slime_small.tres") as EnemyStats
	var elite := load("res://data/enemies/forest_slime_elite.tres") as EnemyStats
	var verdan := load("res://data/enemies/verdan.tres") as EnemyStats
	check(small.max_hp < normal.max_hp and normal.max_hp < elite.max_hp, "small < normal < elite HP")
	check(small.chase_speed > normal.chase_speed, "small slime is faster")
	check_eq(small.shot_range, 0.0, "small slime has no ranged attack")
	check(elite.poise > 0.0, "elite has super armour")
	check(verdan.max_hp >= 800, "boss has boss-level HP")


func test_level_data() -> void:
	var lb := LevelBuilder.load_map("res://data/levels/forest_stage_01.txt")
	check(lb.width >= 150 and lb.height >= 20, "map size %dx%d" % [lb.width, lb.height])
	check_eq(lb.markers_of("P").size(), 1, "one player start")
	check_eq(lb.markers_of("B").size(), 1, "one boss")
	check_eq(lb.markers_of("C").size(), 1, "one checkpoint")
	check_eq(lb.markers_of("L").size(), 1, "arena gate")
	check_eq(lb.markers_of("A").size(), 1, "arena trigger")
	var slimes := lb.markers_of("n").size() + lb.markers_of("s").size() + lb.markers_of("e").size()
	check(slimes >= 8, "at least 8 slimes (%d)" % slimes)
	check_eq(lb.markers_of("e").size(), 1, "one elite slime")
	check(lb.signs.size() >= 6, "tutorial texts")
	for m in lb.markers:
		var c: String = m["char"]
		if c in ["n", "s", "e", "P", "C", "B"]:
			var cell: Vector2i = m["cell"]
			var below := lb.char_at(cell.x, cell.y + 1)
			check(below in ["#", "=", "S"], "'%s' at %s stands on ground" % [c, cell])
