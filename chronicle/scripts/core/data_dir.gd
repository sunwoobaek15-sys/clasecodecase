class_name DataDir
extends RefCounted
## Loads every *.tres in a folder (also in exported builds, where they are
## listed as *.tres.remap).


static func load_all(dir_path: String) -> Array[Resource]:
	var out: Array[Resource] = []
	var dir := DirAccess.open(dir_path)
	if dir == null:
		push_error("DataDir: cannot open %s" % dir_path)
		return out
	var names: Array[String] = []
	for f in dir.get_files():
		var file_name := f.trim_suffix(".remap")
		if file_name.ends_with(".tres") and not names.has(file_name):
			names.append(file_name)
	names.sort()
	for n in names:
		var res := load(dir_path.path_join(n))
		if res != null:
			out.append(res)
	return out
