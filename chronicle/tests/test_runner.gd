extends Node
## Runs every res://tests/test_*.gd file and exits with 0 (all passed) or 1.
## Optional filter:  -- --only=test_player

func _ready() -> void:
	await get_tree().process_frame
	var only := str(Game.cmd_options.get("only", ""))
	var files: Array[String] = []
	var dir := DirAccess.open("res://tests")
	for f in dir.get_files():
		var name := f.trim_suffix(".remap")
		if name.begins_with("test_") and name.ends_with(".gd") and name != "test_case.gd" and name != "test_runner.gd":
			if only.is_empty() or name.begins_with(only):
				files.append(name)
	files.sort()
	var total_checks := 0
	var total_tests := 0
	var all_failures: Array[String] = []
	var started := Time.get_ticks_msec()
	for f in files:
		var script := load("res://tests/" + f) as GDScript
		if script == null or not script.can_instantiate():
			print("\n[%s]\n  FAIL (script does not compile)" % f)
			all_failures.append("%s: script does not compile" % f)
			total_tests += 1
			continue
		var tc: TestCase = script.new()
		tc.runner = self
		var methods: Array[String] = []
		for m in script.get_script_method_list():
			var n: String = m["name"]
			if n.begins_with("test_") and not methods.has(n):
				methods.append(n)
		print("\n[%s]" % f)
		for m in methods:
			tc.current = "%s.%s" % [f.get_basename(), m]
			var before := tc.failures.size()
			tc.before_each()
			await tc.call(m)
			tc.after_each()
			tc.cleanup()
			await get_tree().physics_frame
			await get_tree().physics_frame
			total_tests += 1
			var ok := tc.failures.size() == before
			print("  %s %s" % ["PASS" if ok else "FAIL", m])
			for i in range(before, tc.failures.size()):
				print("       - " + tc.failures[i])
		total_checks += tc.checks
		all_failures.append_array(tc.failures)
	print("\n==== %d tests, %d checks, %d failed  (%.1fs) ====" % [total_tests, total_checks, all_failures.size(), (Time.get_ticks_msec() - started) / 1000.0])
	get_tree().quit(0 if all_failures.is_empty() else 1)
