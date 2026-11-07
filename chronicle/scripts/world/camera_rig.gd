class_name CameraRig
extends Camera2D
## Follows the player with look-ahead and smoothing, handles screen shake and
## can temporarily focus another target (boss intro).

var target: Node2D = null
var look_ahead: float = 34.0
var vertical_offset: float = -84.0
var follow_speed: float = 7.0
var _focus: Node2D = null
var _focus_offset: Vector2 = Vector2.ZERO
var _shake_strength: float = 0.0
var _shake_time: float = 0.0
var _shake_total: float = 0.0
var _look: float = 0.0


func _ready() -> void:
	process_callback = Camera2D.CAMERA2D_PROCESS_PHYSICS
	Events.camera_shake.connect(shake)
	make_current()


func set_limits(rect: Rect2) -> void:
	limit_left = int(rect.position.x)
	limit_top = int(rect.position.y)
	limit_right = int(rect.end.x)
	limit_bottom = int(rect.end.y)


func focus_on(node: Node2D, offset_px: Vector2 = Vector2.ZERO) -> void:
	_focus = node
	_focus_offset = offset_px


func clear_focus() -> void:
	_focus = null


func snap_to_target() -> void:
	if target:
		global_position = _desired()
		reset_smoothing()


func _desired() -> Vector2:
	if _focus != null and is_instance_valid(_focus):
		return _focus.global_position + _focus_offset
	if target == null or not is_instance_valid(target):
		return global_position
	var f := 0.0
	if "facing" in target:
		f = float(target.get("facing"))
	_look = lerpf(_look, f * look_ahead, 0.05)
	return target.global_position + Vector2(_look, vertical_offset)


func _physics_process(delta: float) -> void:
	var desired := _desired()
	global_position = global_position.lerp(desired, 1.0 - exp(-follow_speed * delta))
	if _shake_time > 0.0:
		_shake_time -= delta
		var k := clampf(_shake_time / maxf(_shake_total, 0.001), 0.0, 1.0)
		offset = Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * _shake_strength * k
	else:
		offset = Vector2.ZERO


func shake(strength: float, duration: float) -> void:
	if strength >= _shake_strength * (_shake_time / maxf(_shake_total, 0.001)):
		_shake_strength = strength
		_shake_time = duration
		_shake_total = duration
