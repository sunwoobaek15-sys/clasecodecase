class_name WindWisp
extends Enemy
## 바람 정령 — floating wind spirit of the sky ruins.
## Drifts near its post; when the hero comes close it winds up (red eyes,
## shaking, 0.7 s) and dashes in a straight line at where the hero was,
## then floats back up. States: hover -> charge -> dash -> recover, hurt, dead

const CHARGE_TIME := 0.7
const DASH_TIME := 0.45
const DASH_SPEED := 300.0
const HOVER_HEIGHT := 56.0

var _home := Vector2.ZERO
var _dash_dir := Vector2.RIGHT
var _cd := 0.8
var _t := 0.0


func _ready() -> void:
	stats = preload("res://data/enemies/wind_wisp.tres")
	super._ready()
	body_height = 22.0
	_bar_width = 20.0
	_t = randf() * TAU
	position.y -= HOVER_HEIGHT
	_home = position
	fsm.add_state(&"hover", _st_hover, func() -> void: play_anim(&"idle"))
	fsm.add_state(&"charge", _st_charge, _enter_charge)
	fsm.add_state(&"dash", _st_dash, _enter_dash, func() -> void: set_contact_damage(true))
	fsm.add_state(&"recover", _st_recover, func() -> void: play_anim(&"idle"))
	fsm.add_state(&"hurt", _st_hurt, func() -> void: play_anim(&"hurt"))
	fsm.add_state(&"dead", _st_dead, _enter_dead)
	fsm.change(&"hover")


func _physics_process(delta: float) -> void:
	_t += delta
	tick_invulnerability(delta)
	update_hp_bar(delta)
	if not has_target():
		find_target()
	_cd = maxf(0.0, _cd - delta)
	fsm.update(delta)
	if fsm.current != &"dead":
		velocity += _knock
		_knock = _knock.move_toward(Vector2.ZERO, 900.0 * delta)
	move_and_slide()


func _drift(p: Vector2, speed: float, delta: float) -> void:
	var to := p - global_position
	velocity = velocity.lerp(to.limit_length(speed), minf(1.0, 3.0 * delta))


func _st_hover(delta: float) -> StringName:
	var goal := _home + Vector2(sin(_t * 0.8) * 30.0, sin(_t * 2.2) * 6.0)
	if has_target() and sees_target(stats.aggro_range, 150.0):
		face_target()
		goal = Vector2(target.global_position.x - signf(to_target().x) * 90.0, target.global_position.y - HOVER_HEIGHT)
		if _cd <= 0.0 and target_distance() < 150.0:
			return &"charge"
	_drift(goal, stats.chase_speed if has_target() else stats.move_speed, delta)
	return &""


func _enter_charge() -> void:
	play_anim(&"charge")
	flash(Color(1.0, 0.6, 0.5), 0.3)
	velocity = Vector2.ZERO


func _st_charge(delta: float) -> StringName:
	velocity = velocity.lerp(Vector2.ZERO, minf(1.0, 6.0 * delta))
	visual.position = Vector2(randf_range(-1.5, 1.5), randf_range(-1.5, 1.5))
	face_target()
	if fsm.time_in_state >= CHARGE_TIME:
		visual.position = Vector2.ZERO
		var aim := target.global_position + Vector2(0, -18) if has_target() else global_position + Vector2(facing * 80.0, 40)
		_dash_dir = (aim - global_position).normalized()
		return &"dash"
	return &""


func _enter_dash() -> void:
	play_anim(&"dash")
	var h := HitData.make(stats.attack_damage, _dash_dir * 180.0 + Vector2(0, -80), self, &"wisp_dash")
	contact_hitbox.activate(h)


func _st_dash(_delta: float) -> StringName:
	velocity = _dash_dir * DASH_SPEED
	if fsm.time_in_state >= DASH_TIME or is_on_wall() or is_on_floor():
		_cd = stats.attack_cooldown
		return &"recover"
	return &""


func _st_recover(delta: float) -> StringName:
	_drift(Vector2(global_position.x, (target.global_position.y if has_target() else _home.y + HOVER_HEIGHT) - HOVER_HEIGHT), 80.0, delta)
	if fsm.time_in_state >= 0.8:
		return &"hover"
	return &""


func _on_hurt(hit: HitData) -> void:
	_knock = knockback_from(hit) * 0.8
	if fsm.current != &"dash":
		fsm.change(&"hurt")


func _st_hurt(delta: float) -> StringName:
	velocity = velocity.lerp(Vector2.ZERO, minf(1.0, 3.0 * delta))
	if fsm.time_in_state > 0.3:
		return &"hover"
	return &""


func _on_death(hit: HitData) -> void:
	super._on_death(hit)
	fsm.change(&"dead")


func _enter_dead() -> void:
	velocity = Vector2(0, -30)
	play_anim(&"hurt")
	FX.spark(global_position, Color(0.8, 0.95, 1.0), true)
	vanish(0.25)


func _st_dead(delta: float) -> StringName:
	velocity = velocity.lerp(Vector2.ZERO, minf(1.0, 4.0 * delta))
	return &""
