class_name GearSentinel
extends Enemy
## 톱니 파수꾼 — flying clockwork gear with one eye (region 2).
##
## Hovers near its post; when the hero comes close it keeps a distance above
## them, charges (eye turns red, ring spins fast) and fires a spinning gear
## shard at the hero. Light knockback; falls and shatters when destroyed.
## States: hover -> chase <-> charge -> shoot, hurt, dead

const RING_TEX := preload("res://assets/enemies/gear_sentinel/ring.png")
const CORE_TEX := preload("res://assets/enemies/gear_sentinel/core.png")
const CORE_CHARGE_TEX := preload("res://assets/enemies/gear_sentinel/core_charge.png")
const SHARD_TEX := preload("res://assets/enemies/gear_sentinel/shard.png")
const CHARGE_TIME := 0.85
const SHOT_SPEED := 175.0
const HOVER_HEIGHT := 64.0
const KEEP_DIST := 120.0

var _core: Sprite2D
var _spin := 1.5
var _cd := 1.0
var _home := Vector2.ZERO
var _t := 0.0


func _ready() -> void:
	stats = preload("res://data/enemies/gear_sentinel.tres")
	var sf := SpriteFrames.new()
	sf.add_frame(&"default", RING_TEX)
	sprite.sprite_frames = sf
	super._ready()
	sprite.centered = true
	sprite.offset = Vector2.ZERO
	_core = Sprite2D.new()
	_core.texture = CORE_TEX
	visual.add_child(_core)
	body_height = 22.0
	_bar_width = 24.0
	_t = randf() * TAU
	position.y -= HOVER_HEIGHT * 0.6
	_home = position
	fsm.add_state(&"hover", _st_hover)
	fsm.add_state(&"chase", _st_chase)
	fsm.add_state(&"charge", _st_charge, _enter_charge, _exit_charge)
	fsm.add_state(&"hurt", _st_hurt)
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
	sprite.rotation += _spin * delta
	if fsm.current != &"dead":
		velocity += _knock
		_knock = _knock.move_toward(Vector2.ZERO, 900.0 * delta)
	move_and_slide()


func _fly_to(p: Vector2, speed: float, delta: float) -> void:
	var to := p - global_position
	var want := to.limit_length(speed) if to.length() > 2.0 else Vector2.ZERO
	velocity = velocity.lerp(want, minf(1.0, 4.0 * delta))


func _st_hover(delta: float) -> StringName:
	_spin = 1.5
	_fly_to(_home + Vector2(sin(_t * 0.7) * 24.0, sin(_t * 2.0) * 4.0), stats.move_speed, delta)
	if sees_target(stats.aggro_range, 160.0):
		return &"chase"
	return &""


func _chase_point() -> Vector2:
	var d := to_target()
	var side := -signf(d.x) if d.x != 0.0 else -1.0
	return target.global_position + Vector2(side * KEEP_DIST, -HOVER_HEIGHT + sin(_t * 2.4) * 6.0)


func _st_chase(delta: float) -> StringName:
	_spin = 3.0
	if not has_target() or target_distance() > stats.lose_range:
		return &"hover"
	face_target()
	_fly_to(_chase_point(), stats.chase_speed, delta)
	if _cd <= 0.0 and target_distance() < stats.shot_range:
		return &"charge"
	return &""


func _enter_charge() -> void:
	_core.texture = CORE_CHARGE_TEX
	flash(Color(1.0, 0.5, 0.4), 0.3)


func _exit_charge() -> void:
	_core.texture = CORE_TEX


func _st_charge(delta: float) -> StringName:
	_spin = lerpf(3.0, 16.0, clampf(fsm.time_in_state / CHARGE_TIME, 0.0, 1.0))
	velocity = velocity.lerp(Vector2.ZERO, minf(1.0, 5.0 * delta))
	face_target()
	_core.position = Vector2(randf_range(-1, 1), randf_range(-1, 1)) * clampf(fsm.time_in_state * 2.0, 0.0, 1.0)
	if fsm.time_in_state >= CHARGE_TIME:
		_core.position = Vector2.ZERO
		_shoot()
		_cd = stats.attack_cooldown
		return &"chase"
	return &""


func _shoot() -> void:
	if not has_target():
		return
	var aim := (target.global_position + Vector2(0, -24) - global_position).normalized()
	var p := Projectile.new()
	p.texture = SHARD_TEX
	p.lifetime = 2.4
	p.spin = 14.0
	p.hit_rect = Rect2(-5, -5, 10, 10)
	p.z_index = 20
	var h := HitData.make(stats.attack_damage, Vector2(signf(aim.x) * 120.0, -80.0), self, &"gear_shard")
	p.setup(global_position + aim * 14.0, aim * SHOT_SPEED, h, Hitbox.LAYER_PLAYER_HURTBOX, self)
	get_parent().add_child(p)
	_knock = -aim * 60.0


func _on_hurt(hit: HitData) -> void:
	_knock = knockback_from(hit) * 0.6
	if fsm.current != &"charge" or breaks_poise(hit):
		fsm.change(&"hurt")


func _st_hurt(delta: float) -> StringName:
	velocity = velocity.lerp(Vector2.ZERO, minf(1.0, 3.0 * delta))
	if fsm.time_in_state > 0.3:
		return &"chase" if has_target() else &"hover"
	return &""


func _on_death(hit: HitData) -> void:
	super._on_death(hit)
	fsm.change(&"dead")


func _enter_dead() -> void:
	_spin = 10.0
	velocity = Vector2(randf_range(-40, 40), -60)
	_core.texture = CORE_CHARGE_TEX


func _st_dead(delta: float) -> StringName:
	velocity.y = minf(velocity.y + 700.0 * delta, 420.0)
	if fsm.time_in_state > 0.55 and not has_meta(&"shattered"):
		set_meta(&"shattered", true)
		for i in 3:
			FX.spark(global_position + Vector2(randf_range(-10, 10), randf_range(-10, 10)), Color(1.0, 0.8, 0.4), i == 0)
		vanish()
	return &""
