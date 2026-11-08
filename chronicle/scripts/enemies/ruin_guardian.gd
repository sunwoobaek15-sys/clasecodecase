class_name RuinGuardian
extends Enemy
## 폐허 수호상 — stone guardian of the sky ruins.
## Stands dormant until the hero comes close, then walks slowly towards
## them. Attack: raises both arms (ground circle warning, 0.85 s) and slams,
## sending a shockwave along the ground. Heavy: super armour, little
## knockback. States: dormant -> wake -> walk <-> windup -> slam, stagger, dead

const WAKE_RANGE := 130.0
const SLAM_RANGE := 64.0
const WINDUP := 0.85
const SLAM_W := 110.0

var _cd := 0.0


func _ready() -> void:
	stats = preload("res://data/enemies/ruin_guardian.tres")
	super._ready()
	body_height = 56.0
	_bar_width = 32.0
	fsm.add_state(&"dormant", _st_dormant, func() -> void: play_anim(&"dormant"))
	fsm.add_state(&"wake", _st_wake, _enter_wake)
	fsm.add_state(&"walk", _st_walk, func() -> void: play_anim(&"walk"))
	fsm.add_state(&"windup", _st_windup, _enter_windup)
	fsm.add_state(&"slam", _st_slam, _enter_slam)
	fsm.add_state(&"stagger", _st_stagger, func() -> void: play_anim(&"hurt"))
	fsm.add_state(&"dead", _st_dead, _enter_dead)
	fsm.change(&"dormant")


func _physics_process(delta: float) -> void:
	tick_invulnerability(delta)
	update_hp_bar(delta)
	if not has_target():
		find_target()
	_cd = maxf(0.0, _cd - delta)
	fsm.update(delta)
	apply_gravity(delta)
	velocity.x += _knock.x
	_knock = _knock.move_toward(Vector2.ZERO, 900.0 * delta)
	move_and_slide()


func _st_dormant(_delta: float) -> StringName:
	velocity.x = 0.0
	if has_target() and sees_target(WAKE_RANGE, 60.0):
		return &"wake"
	return &""


func _enter_wake() -> void:
	play_anim(&"idle")
	flash(Color(1.0, 0.9, 0.5), 0.4)
	FX.floating_text("!", global_position + Vector2(0, -body_height - 10), Color(1.0, 0.85, 0.4), 16)


func _st_wake(_delta: float) -> StringName:
	return &"walk" if fsm.time_in_state > 0.6 else &""


func _st_walk(_delta: float) -> StringName:
	if not has_target():
		velocity.x = 0.0
		return &""
	face_target()
	var dx := absf(to_target().x)
	if dx < SLAM_RANGE and _cd <= 0.0 and absf(to_target().y) < 60.0:
		velocity.x = 0.0
		return &"windup"
	velocity.x = facing * stats.move_speed if dx > 30.0 else 0.0
	if ledge_ahead(facing) or wall_ahead(facing):
		velocity.x = 0.0
	return &""


func _enter_windup() -> void:
	velocity.x = 0.0
	play_anim(&"windup")
	flash(Color(1.0, 0.7, 0.3), 0.35)
	var tele := Telegraph.new()
	tele.shape = Telegraph.Shape.CIRCLE
	tele.radius = SLAM_W / 2.0
	tele.duration = WINDUP
	FX._parent().add_child(tele)
	tele.global_position = global_position + Vector2(facing * 20.0, 0)


func _st_windup(_delta: float) -> StringName:
	return &"slam" if fsm.time_in_state >= WINDUP else &""


func _enter_slam() -> void:
	play_anim(&"slam")
	var h := HitData.make(stats.attack_damage, Vector2(facing * 170.0, -220.0), self, &"guardian_slam")
	Hitbox.blast(FX._parent(), global_position + Vector2(facing * 20.0, 0), Rect2(-SLAM_W / 2.0, -26, SLAM_W, 28), h,
			Hitbox.LAYER_PLAYER_HURTBOX, 0.12, self)
	FX.shake(3.5, 0.25)
	FX.spark(global_position + Vector2(facing * 26.0, -4), Color(0.9, 0.9, 1.0), true)
	_cd = stats.attack_cooldown


func _st_slam(_delta: float) -> StringName:
	return &"walk" if fsm.time_in_state >= 0.7 else &""


func _on_hurt(hit: HitData) -> void:
	_knock = knockback_from(hit)
	if fsm.current == &"dormant":
		fsm.change(&"wake")
	elif breaks_poise(hit) and fsm.current != &"windup":
		fsm.change(&"stagger")


func _st_stagger(_delta: float) -> StringName:
	velocity.x = 0.0
	return &"walk" if fsm.time_in_state > 0.5 else &""


func _on_death(hit: HitData) -> void:
	super._on_death(hit)
	fsm.change(&"dead")


func _enter_dead() -> void:
	velocity.x = 0.0
	play_anim(&"dormant")
	sprite.modulate = Color(0.6, 0.6, 0.7)
	FX.shake(2.5, 0.2)
	for i in 3:
		FX.spark(global_position + Vector2(randf_range(-14, 14), -randf_range(10, 50)), Color(0.85, 0.85, 0.95), i == 0)
	vanish(0.4)


func _st_dead(_delta: float) -> StringName:
	velocity.x = 0.0
	return &""
