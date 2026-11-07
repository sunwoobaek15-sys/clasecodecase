extends TestCase
## Every script and scene in the project loads and compiles. Catches parse
## errors in files no other test touches (title screen, bot, tools).


func _collect(dir_path: String, ext: String, out: Array[String]) -> void:
	var dir := DirAccess.open(dir_path)
	if dir == null:
		return
	for f in dir.get_files():
		var name := f.trim_suffix(".remap")
		if name.ends_with(ext):
			out.append(dir_path.path_join(name))
	for d in dir.get_directories():
		if not d.begins_with("."):
			_collect(dir_path.path_join(d), ext, out)


func test_all_scripts_compile() -> void:
	var files: Array[String] = []
	_collect("res://scripts", ".gd", files)
	_collect("res://tests", ".gd", files)
	check(files.size() >= 30, "found the project scripts (%d)" % files.size())
	for path in files:
		var s := load(path) as GDScript
		check(s != null and s.can_instantiate(), "%s compiles" % path)


func test_all_scenes_instantiate() -> void:
	var files: Array[String] = []
	_collect("res://scenes", ".tscn", files)
	check(files.size() >= 12, "found the project scenes (%d)" % files.size())
	for path in files:
		var ps := load(path) as PackedScene
		if not check(ps != null, "%s loads" % path):
			continue
		var inst := ps.instantiate()
		check(inst != null, "%s instantiates" % path)
		if inst:
			inst.free()


func test_title_screen_runs() -> void:
	var title := (load("res://scenes/boot/title.tscn") as PackedScene).instantiate()
	add(title)
	await frames(10)
	check(title.is_inside_tree(), "title screen runs")
	var buttons := title.find_children("*", "Button", true, false)
	check(buttons.size() >= 2, "title has start and settings buttons (%d)" % buttons.size())
