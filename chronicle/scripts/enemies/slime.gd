class_name Slime
extends Enemy
## 숲의 정령 슬라임 — forest spirit slime.
##
## Variants (from the reference sheet)
##   NORMAL  animated sheet; slime shot (ranged) + area splash (melee)
##   SMALL   same animations at a smaller size; faster, splash only
##   ELITE   amethyst slime (single reference frame, animated with
##           squash/stretch); tough, poise, 3-way shot and a wide splash
## theme: "forest" (region 1), "clockwork" (region 2: bronze recolour,
## stronger stats, blue time shots) or "cloud" (region 3: white/sky recolour,
## strongest). Elite exists only in the forest.
##
## AI states: idle -> patrol <-> chase -> shot / splash / hop, hurt, dead

enum Variant { NORMAL, SMALL, ELITE }

const FRAMES_NORMAL := preload("res://assets/enemies/forest_slime/slime_frames.tres")
const FRAMES_SMALL := preload("res://assets/enemies/forest_slime_small/slime_small_frames.tres")
const ELITE_TEX := preload("res://assets/enemies/forest_slime/art/elite.png")
const BALL_TEX := preload("res://assets/effects/slime/ball.png")
const SPLASH_TEX := preload("res://assets/effects/slime/splash.png")
const BURST_TEX := preload("res://assets/effects/slime/burst.png")
const PUDDLE_TEX := preload("res://assets/effects/slime/puddle_small.png")
const STATS_BY_VARIANT := {
	Variant.NORMAL: preload("res://data/enemies/forest_slime.tres"),
	Variant.SMALL: preload("res://data/enemies/forest_slime_small.tres"),
	Variant.ELITE: preload("res://data/enemies/forest_slime_elite.tres"),
}
const ELITE_TINT := Color(0.78, 0.5, 1.0)
const THEMES := {
	"clockwork": {
		"frames": [preload("res://assets/enemies/clockwork_slime/clockwork_slime_frames.tres"),
				preload("res://assets/enemies/clockwork_slime_small/clockwork_slime_small_frames.tres")],
		"stats": [preload("res://data/enemies/clockwork_slime.tres"), preload("res://data/enemies/clockwork_slime_small.tres")],
		"tint": Color(0.6, 0.8, 1.5),
	},
	"cloud": {
		"frames": [preload("res://assets/enemies/cloud_slime/cloud_slime_frames.tres"),
				preload("res://assets/enemies/cloud_slime_small/cloud_slime_small_frames.tres")],
		"stats": [preload("res://data/enemies/cloud_slime.tres"), preload("res://data/enemies/cloud_slime_small.tres")],
		"tint": Color(1.4, 1.4, 1.0),
	},
}

@export var variant: Variant = Variant.NORMAL
@export var theme: String = "forest"
## Compatibility alias for region 2 slimes.
var clockwork: bool:
	get:
		return theme == "clockwork"
	set(value):
		theme = "clockwork" if value else "forest"
@export var patrol_range: float = 70.0

var _patrol_dir: int = 1
var _attack_cd: float = 0.0
var _state_len: float = 1.0
var _fired: bool = false
var _splash_on: bool = false
var _elite_t: float = 0.0
var _splash_hitbox: Hitbox

@onready var body_shape: CollisionShape2D = $BodyShape


func _ready() -> void:
	var th: Dictionary = THEMES.get(theme, {})
	if not th.is_empty() and variant == Variant.ELITE:
		variant = Variant.NORMAL
	var vi := 1 if variant == Variant.SMALL else 0
	stats = th["stats"][vi] if not th.is_empty() else STATS_BY_VARIANT[variant]
	super._ready()
	var hurt_shape := hurtbox.get_child(0) as CollisionShape2D
	body_shape.shape = body_shape.shape.duplicate()
	hurt_shape.shape = hurt_shape.shape.duplicate()
	var contact_shape := contact_hitbox.get_child(0) as CollisionShape2D
	match variant:
		Variant.SMALL:
			apply_sprite_frames(th["frames"][1] if not th.is_empty() else FRAMES_SMALL)
			_resize(body_shape, Vector2(14, 12))
			_resize(hurt_shape, Vector2(18, 16))
			contact_hitbox.set_rect(Rect2(-7, -12, 14, 12))
			body_height = 22.0
			_bar_width = 18.0
		Variant.ELITE:
			apply_sprite_frames(_build_elite_frames())
			_resize(body_shape, Vector2(34, 26))
			_resize(hurt_shape, Vector2(40, 36))
			contact_hitbox.set_rect(Rect2(-16, -26, 32, 26))
			body_height = 50.0
			_bar_width = 34.0
		_:
			apply_sprite_frames(th["frames"][0] if not th.is_empty() else FRAMES_NORMAL)
			_resize(body_shape, Vector2(22, 18))
			_resize(hurt_shape, Vector2(26, 24))
			contact_hitbox.set_rect(Rect2(-11, -18, 22, 18))
			body_height = 32.0
	if contact_shape == null:
		push_warning("slime contact hitbox has no shape")
	var splash_r := 22.0 if variant == Variant.SMALL else (48.0 if variant == Variant.ELITE else 32.0)
	_splash_hitbox = Hitbox.create(Rect2(-splash_r, -splash_r * 0.9, splash_r * 2, splash_r * 0.9), Hitbox.LAYER_PLAYER_HURTBOX)
	_splash_hitbox.source_entity = self
	_splash_hitbox.radial_knockback = true
	add_child(_splash_hitbox)
	_patrol_dir = 1 if randf() < 0.5 else -1
	set_facing(_patrol_dir)
	fsm.add_state(&"idle", _st_idle, _enter_idle)
	fsm.add_state(&"patrol", _st_patrol, _enter_patrol)
	fsm.add_state(&"chase", _st_chase, _enter_chase)
	fsm.add_state(&"hop", _st_hop, _enter_hop)
	fsm.add_state(&"shot", _st_shot, _enter_shot)
	fsm.add_state(&"splash", _st_splash, _enter_splash, _exit_splash)
	fsm.add_state(&"hurt", _st_hurt, _enter_hurt)
	fsm.add_state(&"dead", _st_dead, _enter_dead)
	fsm.change(&"idle")


func _resize(cs: CollisionShape2D, size: Vector2) -> void:
	(cs.shape as RectangleShape2D).size = size
	cs.position = Vector2(0, -size.y / 2.0)


func _build_elite_frames() -> SpriteFrames:
	var sf := SpriteFrames.new()
	sf.remove_animation(&"default")
	for anim in [&"idle", &"move", &"run", &"jump", &"hurt", &"shot", &"splash", &"death"]:
		sf.add_animation(anim)
		sf.set_animation_loop(anim, true)
		sf.add_frame(anim, ELITE_TEX)
	sf.set_meta("anchor", Vector2(ELITE_TEX.get_width() / 2.0, ELITE_TEX.get_height() - 2.0))
	return sf


func _physics_process(delta: float) -> void:
	tick_invulnerability(delta)
	_attack_cd = maxf(0.0, _attack_cd - delta)
	if not has_target():
		find_target()
	fsm.update(delta)
	apply_gravity(delta)
	move_and_slide()
	if variant == Variant.ELITE:
		_animate_elite(delta)
	update_hp_bar(delta)


# ------------------------------------------------------------------- states ---
func _enter_idle() -> void:
	play_anim(&"idle")
	_state_len = randf_range(0.7, 1.5)


func _st_idle(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 600.0 * delta)
	if sees_target(stats.aggro_range):
		return &"chase"
	if fsm.time_in_state > _state_len:
		return &"patrol"
	return &""


func _enter_patrol() -> void:
	play_anim(&"move")
	_state_len = randf_range(1.6, 3.2)
	if absf(global_position.x - spawn_position.x) > patrol_range * 0.6:
		_patrol_dir = 1 if global_position.x < spawn_position.x else -1


func _st_patrol(_delta: float) -> StringName:
	if sees_target(stats.aggro_range):
		return &"chase"
	var off := global_position.x - spawn_position.x
	if ledge_ahead(_patrol_dir) or wall_ahead(_patrol_dir) or (off * _patrol_dir > patrol_range):
		_patrol_dir = -_patrol_dir
	set_facing(_patrol_dir)
	velocity.x = _patrol_dir * stats.move_speed
	if fsm.time_in_state > _state_len:
		return &"idle"
	return &""


func _enter_chase() -> void:
	play_anim(&"run")


func _st_chase(delta: float) -> StringName:
	if not has_target() or target_distance() > stats.lose_range:
		return &"idle"
	var d := to_target()
	var dir := 1 if d.x > 0.0 else -1
	set_facing(dir)
	if _attack_cd <= 0.0 and is_on_floor():
		if absf(d.x) <= stats.attack_range and absf(d.y) < 34.0:
			return &"splash"
		if stats.shot_range > 0.0 and absf(d.x) >= 70.0 and absf(d.x) <= stats.shot_range and absf(d.y) < 70.0:
			return &"shot"
	if is_on_floor() and d.y < -40.0 and absf(d.x) < 80.0 and fsm.time_in_state > 0.6:
		return &"hop"
	var stop := ledge_ahead(dir) and d.y <= 8.0
	if stop or absf(d.x) < stats.attack_range * 0.6:
		velocity.x = move_toward(velocity.x, 0.0, 800.0 * delta)
	else:
		velocity.x = dir * stats.chase_speed
	return &""


func _enter_hop() -> void:
	play_anim(&"jump", true)
	face_target()
	velocity = Vector2(facing * stats.chase_speed * 1.3, -330.0)


func _st_hop(_delta: float) -> StringName:
	if fsm.time_in_state > 0.15 and is_on_floor():
		return &"chase"
	return &""


func _enter_shot() -> void:
	velocity.x = 0.0
	face_target()
	_fired = false
	play_anim(&"shot", true)
	flash(Color(1.0, 0.9, 0.4), 0.15)


func _st_shot(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 900.0 * delta)
	if not _fired and fsm.time_in_state >= 0.27:
		_fired = true
		_fire_balls()
	if fsm.time_in_state >= 0.6:
		_attack_cd = stats.attack_cooldown * randf_range(0.85, 1.25)
		return &"chase"
	return &""


func _fire_balls() -> void:
	if not has_target():
		return
	var muzzle := global_position + Vector2(facing * (14.0 if variant != Variant.ELITE else 22.0), -body_height * 0.55)
	var aim := target.global_position + Vector2(0, -16)
	var offsets: Array[float] = [0.0]
	if variant == Variant.ELITE:
		offsets = [-34.0, 0.0, 34.0]
	for off in offsets:
		var p := Projectile.new()
		p.texture = BALL_TEX
		p.gravity = 420.0
		p.lifetime = 2.2
		p.hit_rect = Rect2(-6, -6, 12, 12)
		p.spin = 6.0
		p.z_index = 20
		if variant == Variant.ELITE:
			p.modulate = ELITE_TINT
		elif THEMES.has(theme):
			p.modulate = THEMES[theme]["tint"]
		var flight := clampf(absf(aim.x - muzzle.x) / 170.0, 0.45, 1.1)
		var vel := Projectile.ballistic_velocity(muzzle, aim + Vector2(off, 0), flight, p.gravity)
		var h := HitData.make(stats.attack_damage, Vector2(facing * 110.0, -70.0), self, &"slime_shot")
		p.setup(muzzle, vel, h, Hitbox.LAYER_PLAYER_HURTBOX, self)
		p.impacted.connect(_on_ball_impact)
		FX._parent().add_child(p)


func _on_ball_impact(at: Vector2, _hit_something: bool) -> void:
	var s := FX.burst(SPLASH_TEX, at, 0.3, 0.3, 0.55, false)
	if s and variant == Variant.ELITE:
		s.modulate = ELITE_TINT


func _enter_splash() -> void:
	velocity.x = 0.0
	face_target()
	_splash_on = false
	play_anim(&"splash", true)
	flash(Color(1.0, 0.6, 0.3), 0.2)


func _st_splash(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 900.0 * delta)
	var t := fsm.time_in_state
	if t >= 0.26 and not _splash_on and t < 0.5:
		_splash_on = true
		var push := Vector2(150.0, -120.0) if variant != Variant.ELITE else Vector2(220.0, -160.0)
		_splash_hitbox.activate(HitData.make(stats.attack_damage, push, self, &"slime_splash"))
		var fx := FX.burst(BURST_TEX if variant == Variant.ELITE else PUDDLE_TEX, global_position + Vector2(0, -6),
				0.35, 0.4 if variant != Variant.SMALL else 0.3, 0.8 if variant == Variant.ELITE else 0.6, false)
		if fx and variant == Variant.ELITE:
			fx.modulate = ELITE_TINT
		FX.shake(1.0 if variant != Variant.ELITE else 2.5, 0.12)
	if t >= 0.5 and _splash_on:
		_splash_hitbox.deactivate()
	if t >= 0.66:
		_attack_cd = stats.attack_cooldown * randf_range(0.85, 1.2)
		return &"chase"
	return &""


func _exit_splash() -> void:
	_splash_hitbox.deactivate()


# ------------------------------------------------------------------ damage ---
func _on_hurt(hit: HitData) -> void:
	if fsm.current == &"dead":
		return
	if not breaks_poise(hit):
		return  # super armour: flash only
	_knock = knockback_from(hit)
	fsm.change(&"hurt")


func _enter_hurt() -> void:
	_splash_hitbox.deactivate()
	play_anim(&"hurt", true)
	velocity = _knock
	if _knock.x != 0.0:
		set_facing(-signf(_knock.x))


func _st_hurt(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 500.0 * delta)
	if fsm.time_in_state >= 0.32 and is_on_floor():
		return &"chase" if has_target() else &"idle"
	return &""


func _on_death(hit: HitData) -> void:
	super._on_death(hit)
	_knock = knockback_from(hit)
	fsm.change(&"dead")


func _enter_dead() -> void:
	_splash_hitbox.deactivate()
	play_anim(&"death", true)
	velocity = Vector2(_knock.x * 0.4, -60.0)
	if variant == Variant.ELITE:
		var t := create_tween().set_parallel(true)
		t.tween_property(sprite, "scale", Vector2(1.5, 0.15), 0.45)
		var s := FX.burst(BURST_TEX, global_position + Vector2(0, -10), 0.6, 0.6, 1.3, true)
		if s:
			s.modulate = ELITE_TINT
		FX.shake(3.0, 0.25)
	vanish(0.55)


func _st_dead(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 400.0 * delta)
	return &""


# -------------------------------------------------------- elite animation ---
func _animate_elite(delta: float) -> void:
	if is_dead:
		return
	_elite_t += delta
	var sy := 1.0
	match fsm.current:
		&"idle", &"patrol":
			sy = 1.0 + 0.05 * sin(_elite_t * 5.0)
		&"chase":
			sy = 0.9 + 0.18 * absf(sin(_elite_t * 9.0))
		&"shot":
			sy = 0.82 if fsm.time_in_state < 0.27 else 1.12
		&"splash":
			sy = 0.74 if fsm.time_in_state < 0.26 else 1.22
		&"hurt":
			sy = 0.85
		&"hop":
			sy = 1.15 if velocity.y < 0.0 else 0.9
	var target_scale := Vector2(2.0 - sy, sy)
	sprite.scale = sprite.scale.lerp(target_scale, clampf(delta * 14.0, 0.0, 1.0))
