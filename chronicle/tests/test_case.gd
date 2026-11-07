class_name TestCase
extends RefCounted
## Base class for the project's lightweight test suite (no plugins needed).
## Methods named test_* are run in order; they may await frames.
## Run all tests:
##   godot --headless --path . --fixed-fps 60 res://tests/test_runner.tscn

var runner: Node
var failures: Array[String] = []
var checks: int = 0
var current: String = ""
var _nodes: Array[Node] = []


func before_each() -> void:
	pass


func after_each() -> void:
	pass


# ---------------------------------------------------------------- asserts ---
func check(cond: bool, msg: String) -> bool:
	checks += 1
	if not cond:
		failures.append("%s: %s" % [current, msg])
	return cond


func check_eq(a: Variant, b: Variant, msg: String) -> bool:
	return check(a == b, "%s (got %s, expected %s)" % [msg, str(a), str(b)])


func check_between(v: float, lo: float, hi: float, msg: String) -> bool:
	return check(v >= lo and v <= hi, "%s (got %.2f, expected %.2f..%.2f)" % [msg, v, lo, hi])


# ---------------------------------------------------------------- helpers ---
func tree() -> SceneTree:
	return runner.get_tree()


func add(node: Node) -> Node:
	runner.add_child(node)
	_nodes.append(node)
	return node


func cleanup() -> void:
	for n in _nodes:
		if is_instance_valid(n):
			n.queue_free()
	_nodes.clear()
	# effects/projectiles spawned through FX land in the current scene (runner)
	for c in runner.get_children():
		c.queue_free()
	for a in [&"move_left", &"move_right", &"move_up", &"move_down", &"jump", &"attack", &"dodge", &"skill", &"ultimate"]:
		Input.action_release(a)
	tree().paused = false
	Engine.time_scale = 1.0
	FX.reset_time()


func frames(n: int) -> void:
	for i in n:
		await tree().physics_frame


func seconds(s: float) -> void:
	await frames(int(ceil(s * 60.0)))


## Waits until cond.call() is true or the timeout (seconds) passes.
func wait_until(cond: Callable, timeout: float) -> bool:
	var n := int(timeout * 60.0)
	for i in n:
		if cond.call():
			return true
		await tree().physics_frame
	return bool(cond.call())


func press(action: StringName, strength: float = 1.0) -> void:
	Game.send_action(action, true, strength)


func release(action: StringName) -> void:
	Game.send_action(action, false)


func tap(action: StringName, hold_frames: int = 3) -> void:
	press(action)
	await frames(hold_frames)
	release(action)


## Flat test arena: a floor at y = 0 from x = -2000 to 2000 (+ walls).
func make_floor(width: float = 4000.0) -> StaticBody2D:
	var body := StaticBody2D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	var cs := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(width, 64)
	cs.shape = rect
	cs.position = Vector2(0, 32)
	body.add_child(cs)
	add(body)
	return body


func spawn_player(pos: Vector2 = Vector2.ZERO) -> Player:
	Profile.reset(false)  # bare level-1 hero: tests use the base numbers
	var p := (load("res://scenes/player/player.tscn") as PackedScene).instantiate() as Player
	p.position = pos
	p.stats = p.stats.duplicate()
	p.stats.crit_chance = 0.0
	add(p)
	return p
