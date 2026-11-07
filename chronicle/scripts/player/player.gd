class_name Player
extends Entity
## 청월의 검사 — the player character.
##
## States
##   ground    idle / walk / run; jump, attack, dodge, skill, ultimate
##   air       jump / fall with variable height, coyote time, air slash, air dodge
##   attack    3-hit combo on the ground (WeaponData.combo_*), air slash in the air
##   charge    keep holding attack -> charge stance, release -> heavy
##   heavy     charged crescent slash (damage grows with charge time)
##   dodge     dash with invulnerability frames
##   skill     청월참: spin slash + flying crescent wave (costs MP)
##   ultimate  청월강림: pillar of light, repeated area damage (full gauge)
##   hurt      knock-back + short stun, then blinking invulnerability
##   dead
## Input arrives as actions (keyboard, gamepad, touch controls, autoplay bot
## all use the same actions), presses are buffered for responsiveness.

const BUFFERED_ACTIONS: Array[StringName] = [&"jump", &"attack", &"dodge", &"skill", &"ultimate"]
const ACTION_BUFFER := 0.22
const CRESCENT_TEX := preload("res://assets/effects/hero/crescent.png")
const SPIKE_TEX := preload("res://assets/effects/hero/spike_burst.png")
const CIRCLE_TEX := preload("res://assets/effects/hero/magic_circle.png")
const VORTEX_TEX := preload("res://assets/effects/hero/vortex.png")
const PILLAR_TEX := preload("res://assets/effects/hero/light_pillar.png")
const ULT_TICKS: Array[float] = [0.42, 0.62, 0.82, 1.02]

@export var stats: PlayerStats
@export var weapon: WeaponData

var mp: float = 0.0
var ult: float = 0.0
var fsm := StateMachine.new()
var input_enabled: bool = true
var move_axis: float = 0.0
var combo_hits: int = 0
var kill_y: float = 100000.0  ## falling below this costs HP and respawns
var combo_attacks: Array[AttackData] = []

var _buffer: Dictionary = {}
var _coyote: float = 0.0
var _jump_held: bool = false
var _jump_cut_done: bool = false
var _air_dodge_used: bool = false
var _dodge_cd: float = 0.0
var _skill_cd: float = 0.0
var _combo_index: int = 0
var _combo_queued: bool = false
var _attack: AttackData
var _attack_mult: float = 1.0
var _attack_held: float = 0.0
var _hit_active: bool = false
var _dodge_dir: int = 1
var _ghost_timer: float = 0.0
var _combo_timer: float = 0.0
var _ult_ticks: int = 0
var _skill_fired: bool = false
var _landing_lock: float = 0.0
var _fall_speed: float = 0.0
var _last_safe_pos: Vector2 = Vector2.ZERO
var _safe_check: int = 0
var _blink_time: float = 0.0
var _heavy_charge: float = 0.0
var _charge_full: bool = false
var _charge_fx: Sprite2D
var _knock: Vector2 = Vector2.ZERO
var _death_reported: bool = false
var _last_mp_emit: float = -1.0
var base_stats: PlayerStats
var _potion_cd: float = 0.0
var _skill_cd_total: float = 1.0
var _front_query: PhysicsShapeQueryParameters2D

@onready var attack_hitbox: Hitbox = $Visual/AttackHitbox


func _ready() -> void:
	is_player = true
	if stats == null:
		stats = PlayerStats.new()
	# Phase 2: level, equipment and skills from the Profile.
	base_stats = stats
	stats = Profile.build_stats(base_stats)
	var equipped := Profile.equipped_weapon()
	if equipped != null:
		weapon = equipped
	max_hp = stats.max_hp
	super._ready()
	mp = stats.max_mp
	Profile.changed.connect(refresh_stats)
	Profile.leveled_up.connect(_on_level_up)
	if weapon != null:
		combo_attacks = weapon.combo()
	add_to_group(&"player")
	hurtbox.entity = self
	attack_hitbox.source_entity = self
	attack_hitbox.target_mask = Hitbox.LAYER_ENEMY_HURTBOX
	attack_hitbox.landed.connect(_on_attack_landed)
	health_changed.connect(func(h: int, m: int) -> void: Events.player_health_changed.emit(h, m))
	_last_safe_pos = global_position
	fsm.add_state(&"ground", _st_ground, _enter_ground)
	fsm.add_state(&"air", _st_air)
	fsm.add_state(&"attack", _st_attack, _enter_attack, _exit_attack)
	fsm.add_state(&"charge", _st_charge, _enter_charge, _exit_charge)
	fsm.add_state(&"heavy", _st_heavy, _enter_heavy, _exit_attack)
	fsm.add_state(&"dodge", _st_dodge, _enter_dodge, _exit_dodge)
	fsm.add_state(&"skill", _st_skill, _enter_skill, _exit_attack)
	fsm.add_state(&"ultimate", _st_ultimate, _enter_ultimate, _exit_ultimate)
	fsm.add_state(&"hurt", _st_hurt, _enter_hurt)
	fsm.add_state(&"dead", _st_dead, _enter_dead)
	fsm.change(&"air")
	Events.player_spawned.emit(self)
	emit_all_stats()


func emit_all_stats() -> void:
	Events.player_health_changed.emit(hp, max_hp)
	Events.player_mana_changed.emit(mp, stats.max_mp)
	Events.player_ult_changed.emit(ult, stats.ult_max)


# ------------------------------------------------------------------ input ---
func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled or is_dead:
		return
	for a in BUFFERED_ACTIONS:
		if event.is_action_pressed(a):
			_buffer[a] = stats.jump_buffer if a == &"jump" else ACTION_BUFFER
	if event.is_action_pressed(&"use_potion"):
		use_potion()


## Quick-slot potion (touch button / Q). Returns true if one was drunk.
func use_potion() -> bool:
	if is_dead or _potion_cd > 0.0:
		return false
	if Profile.inventory.count(Profile.POTION_ID) <= 0:
		Events.toast.emit("회복 물약이 없어요.")
		return false
	if not Profile.use_consumable(Profile.POTION_ID, self):
		Events.toast.emit("HP가 이미 가득 찼어요.")
		return false
	_potion_cd = 0.8
	FX.spark(global_position + Vector2(0, -30), Color(1.0, 0.5, 0.5), true)
	return true


## Re-applies Profile stats (level up, equipment or skill change) keeping
## the current HP/MP; extra max HP is added to the current HP.
func refresh_stats() -> void:
	if base_stats == null:
		return
	var fresh := Profile.build_stats(base_stats)
	var hp_gain := maxi(0, fresh.max_hp - max_hp)
	stats = fresh
	max_hp = fresh.max_hp
	if not is_dead:
		hp = clampi(hp + hp_gain, 1, max_hp)
	mp = minf(mp, stats.max_mp)
	var w := Profile.equipped_weapon()
	if w != null and w != weapon:
		weapon = w
		combo_attacks = weapon.combo()
	emit_all_stats()


func _on_level_up(_level: int) -> void:
	if is_dead:
		return
	refresh_stats()
	hp = max_hp
	mp = stats.max_mp
	emit_all_stats()
	FX.burst(PILLAR_TEX, global_position + Vector2(0, -30), 0.7, 0.8, 1.6, true, false, 5)
	FX.floating_text("LEVEL UP!", global_position + Vector2(0, -body_height - 20), Color(1.0, 0.9, 0.4), 16)


## Armour and skills reduce incoming damage (falling into pits excluded).
func take_hit(hit: HitData) -> bool:
	if is_dead or is_invulnerable():
		return false
	var d := Profile.defense()
	if d > 0.0 and hit.tag != &"fall":
		hit.damage = maxi(1, roundi(hit.damage * (1.0 - d)))
	apply_damage(hit)
	return true


func _buffered(action: StringName) -> bool:
	return float(_buffer.get(action, 0.0)) > 0.0


func _consume(action: StringName) -> bool:
	if _buffered(action):
		_buffer[action] = 0.0
		return true
	return false


func clear_input() -> void:
	_buffer.clear()
	move_axis = 0.0


# ---------------------------------------------------------------- physics ---
func _physics_process(delta: float) -> void:
	_tick_timers(delta)
	if input_enabled and not is_dead:
		move_axis = Input.get_axis(&"move_left", &"move_right")
		_jump_held = Input.is_action_pressed(&"jump")
		_attack_held = _attack_held + delta if Input.is_action_pressed(&"attack") else 0.0
	else:
		move_axis = 0.0
		_jump_held = false
		_attack_held = 0.0
	fsm.update(delta)
	if _gravity_enabled():
		_apply_gravity(delta)
	if velocity.y > 0.0:
		_fall_speed = velocity.y
	move_and_slide()
	_after_move(delta)


func _tick_timers(delta: float) -> void:
	tick_invulnerability(delta)
	_potion_cd = maxf(0.0, _potion_cd - delta)
	for a in _buffer.keys():
		_buffer[a] = maxf(0.0, float(_buffer[a]) - delta)
	if _dodge_cd > 0.0:
		_dodge_cd = maxf(0.0, _dodge_cd - delta)
		Events.player_cooldown_changed.emit(&"dodge", _dodge_cd, stats.dodge_cooldown + stats.dodge_time)
	if _skill_cd > 0.0 and weapon and weapon.skill:
		_skill_cd = maxf(0.0, _skill_cd - delta)
		Events.player_cooldown_changed.emit(&"skill", _skill_cd, _skill_cd_total)
	if not is_dead and mp < stats.max_mp:
		mp = minf(stats.max_mp, mp + stats.mp_regen * delta)
		if absf(mp - _last_mp_emit) >= 0.5 or mp >= stats.max_mp:
			_emit_mp()
	if _combo_timer > 0.0:
		_combo_timer -= delta
		if _combo_timer <= 0.0:
			combo_hits = 0
			Events.player_combo_changed.emit(0)
	_landing_lock = maxf(0.0, _landing_lock - delta)
	if _blink_time > 0.0:
		_blink_time = maxf(0.0, _blink_time - delta)
		visual.modulate.a = 0.35 if fmod(_blink_time, 0.12) < 0.06 else 1.0
		if _blink_time <= 0.0:
			visual.modulate.a = 1.0


func _gravity_enabled() -> bool:
	return not (fsm.current in [&"dodge", &"ultimate"])


func _apply_gravity(delta: float) -> void:
	if is_on_floor() and velocity.y >= 0.0:
		return
	var g := stats.gravity_up if (velocity.y < 0.0 and _jump_held) else stats.gravity_down
	velocity.y = minf(velocity.y + g * delta, stats.max_fall_speed)


func _after_move(delta: float) -> void:
	if is_on_floor():
		_coyote = stats.coyote_time
		_safe_check += 1
		if _safe_check % 10 == 0 and _is_safe_ground():
			_last_safe_pos = global_position
	else:
		_coyote = maxf(0.0, _coyote - delta)
	if global_position.y > kill_y and not is_dead:
		fall_out()


func _is_safe_ground() -> bool:
	var space := get_world_2d().direct_space_state
	for dx in [-10.0, 10.0]:
		var from := global_position + Vector2(dx, -4)
		var q := PhysicsRayQueryParameters2D.create(from, from + Vector2(0, 14), 1)
		if space.intersect_ray(q).is_empty():
			return false
	return true


## Fell into a pit: lose some HP and return to the last safe ground.
func fall_out() -> void:
	var h := HitData.make(15, Vector2.ZERO, null, &"fall")
	invuln_time = 0.0
	velocity = Vector2.ZERO
	global_position = _last_safe_pos
	apply_damage(h)
	if not is_dead:
		invuln_time = 1.0
		_blink_time = 1.0


func _move_horizontal(delta: float, accel: float, speed_mult: float = 1.0) -> void:
	var target := 0.0
	var mag := absf(move_axis)
	if mag > 0.08:
		var speed := stats.run_speed if mag >= 0.6 else stats.walk_speed
		target = signf(move_axis) * speed * speed_mult
	var rate := accel if target != 0.0 else (stats.ground_friction if is_on_floor() else stats.air_accel * 0.5)
	velocity.x = move_toward(velocity.x, target, rate * delta)


# ------------------------------------------------------------------ helpers ---
func can_dodge() -> bool:
	return _dodge_cd <= 0.0 and not is_dead


func can_use_skill() -> bool:
	return weapon != null and weapon.skill != null and _skill_cd <= 0.0 and mp >= weapon.skill.mp_cost


func ult_ready() -> bool:
	return ult >= stats.ult_max


func add_ult(amount: float) -> void:
	var before := ult
	ult = clampf(ult + amount, 0.0, stats.ult_max)
	if ult != before:
		Events.player_ult_changed.emit(ult, stats.ult_max)
		if before < stats.ult_max and ult >= stats.ult_max:
			Events.toast.emit("궁극기 준비 완료!")


func restore_mana(amount: float) -> void:
	mp = minf(stats.max_mp, mp + amount)
	_emit_mp()


func _emit_mp() -> void:
	_last_mp_emit = mp
	Events.player_mana_changed.emit(mp, stats.max_mp)


func _make_hit(a: AttackData, mult: float) -> HitData:
	var h := HitData.new()
	var crit := randf() < stats.crit_chance
	var dmg := float(stats.attack) * mult * Profile.damage_multiplier(a.id) * randf_range(0.92, 1.08)
	if crit:
		dmg *= stats.crit_multiplier
	h.damage = maxi(1, roundi(dmg))
	h.critical = crit
	h.knockback = Vector2(a.knockback.x * facing, a.knockback.y)
	h.hit_stop = a.hit_stop
	h.stagger = a.stagger
	h.shake = a.shake
	h.source = self
	h.tag = a.id
	return h


func _actions_from_ground_or_air() -> StringName:
	if _buffered(&"ultimate") and ult_ready() and weapon and weapon.ultimate:
		_consume(&"ultimate")
		return &"ultimate"
	if _buffered(&"skill") and can_use_skill():
		_consume(&"skill")
		return &"skill"
	if _buffered(&"dodge") and can_dodge() and (is_on_floor() or not _air_dodge_used):
		_consume(&"dodge")
		return &"dodge"
	if _buffered(&"attack") and (not combo_attacks.is_empty() or not is_on_floor()):
		_consume(&"attack")
		_combo_index = 0
		return &"attack"
	return &""


# ------------------------------------------------------------------ ground ---
func _enter_ground() -> void:
	_air_dodge_used = false
	_jump_cut_done = false
	if _fall_speed > 330.0:
		_landing_lock = 0.07
	_fall_speed = 0.0


func _st_ground(delta: float) -> StringName:
	_move_horizontal(delta, stats.ground_accel)
	if absf(move_axis) > 0.08:
		set_facing(move_axis)
	if _landing_lock > 0.0:
		play_anim(&"land")
	elif absf(velocity.x) < 8.0:
		play_anim(&"idle")
	elif absf(move_axis) >= 0.6 or absf(velocity.x) > stats.walk_speed + 6.0:
		play_anim(&"run")
	else:
		play_anim(&"walk")
	var next := _actions_from_ground_or_air()
	if next != &"":
		return next
	if _buffered(&"jump") and (is_on_floor() or _coyote > 0.0):
		_consume(&"jump")
		_do_jump()
		return &"air"
	if _attack_held >= stats.heavy_charge_min and weapon and weapon.heavy_attack:
		return &"charge"
	if not is_on_floor():
		return &"air"
	return &""


func _do_jump() -> void:
	velocity.y = -stats.jump_velocity
	_coyote = 0.0
	_jump_cut_done = false
	play_anim(&"jump", true)


# --------------------------------------------------------------------- air ---
func _st_air(delta: float) -> StringName:
	_move_horizontal(delta, stats.air_accel)
	if absf(move_axis) > 0.08:
		set_facing(move_axis)
	if velocity.y < 0.0 and not _jump_held and not _jump_cut_done:
		velocity.y *= stats.jump_cut
		_jump_cut_done = true
	play_anim(&"jump" if velocity.y < 0.0 else &"fall")
	if _buffered(&"jump") and _coyote > 0.0:
		_consume(&"jump")
		_do_jump()
		return &""
	var next := _actions_from_ground_or_air()
	if next == &"dodge":
		_air_dodge_used = true
	if next != &"":
		return next
	if is_on_floor():
		return &"ground"
	return &""


# ------------------------------------------------------------------ attack ---
func _start_attack(a: AttackData, mult: float) -> void:
	_attack = a
	_attack_mult = mult
	_hit_active = false
	attack_hitbox.deactivate()
	attack_hitbox.set_rect(a.hitbox)
	play_anim(a.animation, true)


func _enter_attack() -> void:
	if absf(move_axis) > 0.3:
		set_facing(move_axis)
	_combo_queued = false
	if not is_on_floor() and weapon and weapon.air_attack:
		_start_attack(weapon.air_attack, weapon.air_attack.damage_multiplier)
	else:
		var a := combo_attacks[clampi(_combo_index, 0, combo_attacks.size() - 1)]
		_start_attack(a, a.damage_multiplier)


func _exit_attack() -> void:
	_hit_active = false
	attack_hitbox.deactivate()


## Shared timing for attack, heavy and skill states. Returns true when done.
func _run_attack_timing(delta: float) -> bool:
	var a := _attack
	var t := fsm.time_in_state
	if is_on_floor():
		if t < a.step_time and not _enemy_in_front(26.0):
			velocity.x = facing * a.step_speed
		else:
			velocity.x = move_toward(velocity.x, 0.0, stats.ground_friction * delta)
	else:
		_move_horizontal(delta, stats.air_accel * 0.5, 0.7)
	if t >= a.active_start and t < a.active_end:
		if not _hit_active:
			_hit_active = true
			attack_hitbox.activate(_make_hit(a, _attack_mult))
	elif _hit_active:
		_hit_active = false
		attack_hitbox.deactivate()
	return t >= a.duration


## True when an enemy hurtbox is within `reach` px in front of the body.
## Attack steps stop there, so combos never walk the hero into a monster.
func _enemy_in_front(reach: float) -> bool:
	if _front_query == null:
		_front_query = PhysicsShapeQueryParameters2D.new()
		_front_query.shape = RectangleShape2D.new()
		_front_query.collision_mask = Hitbox.LAYER_ENEMY_HURTBOX
		_front_query.collide_with_areas = true
		_front_query.collide_with_bodies = false
	(_front_query.shape as RectangleShape2D).size = Vector2(reach, 30)
	_front_query.transform = Transform2D(0.0, global_position + Vector2(facing * (6.0 + reach / 2.0), -22))
	return not get_world_2d().direct_space_state.intersect_shape(_front_query, 1).is_empty()


func _cancel_options() -> StringName:
	if fsm.time_in_state < _attack.cancel_time:
		return &""
	if _buffered(&"dodge") and can_dodge() and (is_on_floor() or not _air_dodge_used):
		_consume(&"dodge")
		if not is_on_floor():
			_air_dodge_used = true
		return &"dodge"
	if _buffered(&"skill") and can_use_skill():
		_consume(&"skill")
		return &"skill"
	if _buffered(&"ultimate") and ult_ready():
		_consume(&"ultimate")
		return &"ultimate"
	return &""


func _st_attack(delta: float) -> StringName:
	var is_air_attack := weapon != null and _attack == weapon.air_attack
	if not is_air_attack and fsm.time_in_state >= _attack.chain_time and _consume(&"attack"):
		_combo_queued = true
	var cancel := _cancel_options()
	if cancel != &"":
		return cancel
	if not _run_attack_timing(delta):
		return &""
	if _combo_queued and not is_air_attack and _combo_index < combo_attacks.size() - 1:
		_combo_index += 1
		_exit_attack()
		_enter_attack()
		fsm.time_in_state = 0.0
		return &""
	if not is_air_attack and _attack_held >= stats.heavy_charge_min and weapon.heavy_attack and is_on_floor():
		return &"charge"
	_combo_index = 0
	return &"ground" if is_on_floor() else &"air"


# ------------------------------------------------------------ charge/heavy ---
func _enter_charge() -> void:
	play_anim(&"heavy_charge", true)
	_charge_full = false
	_heavy_charge = 0.0
	_charge_fx = Sprite2D.new()
	_charge_fx.texture = VORTEX_TEX
	_charge_fx.position = Vector2(0, -28)
	_charge_fx.scale = Vector2.ONE * 0.35
	_charge_fx.modulate = Color(1, 1, 1, 0.65)
	_charge_fx.z_index = -1
	var mat := CanvasItemMaterial.new()
	mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	_charge_fx.material = mat
	add_child(_charge_fx)


func _st_charge(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, stats.ground_friction * delta)
	var span := maxf(0.05, stats.heavy_charge_full - stats.heavy_charge_min)
	_heavy_charge = clampf(fsm.time_in_state / span, 0.0, 1.0)
	if _charge_fx:
		_charge_fx.rotation += delta * (4.0 + 10.0 * _heavy_charge)
		_charge_fx.scale = Vector2.ONE * (0.35 + 0.35 * _heavy_charge)
	if _heavy_charge >= 1.0 and not _charge_full:
		_charge_full = true
		flash(Color(0.55, 0.8, 1.0), 0.2)
		FX.spark(global_position + Vector2(0, -30), Color(0.6, 0.85, 1.0), true)
	if _buffered(&"dodge") and can_dodge():
		_consume(&"dodge")
		return &"dodge"
	if not is_on_floor():
		return &"air"
	if _attack_held <= 0.0:
		return &"heavy"
	return &""


func _exit_charge() -> void:
	if _charge_fx:
		_charge_fx.queue_free()
		_charge_fx = null


func _enter_heavy() -> void:
	var a := weapon.heavy_attack
	# 65% damage when released right away, 100% at full charge.
	_start_attack(a, a.damage_multiplier * (0.65 + 0.35 * _heavy_charge))
	FX.shake(1.5, 0.12)


func _st_heavy(delta: float) -> StringName:
	var cancel := _cancel_options()
	if cancel != &"":
		return cancel
	if _run_attack_timing(delta):
		return &"ground" if is_on_floor() else &"air"
	return &""


# ------------------------------------------------------------------- dodge ---
func _enter_dodge() -> void:
	_dodge_dir = int(signf(move_axis)) if absf(move_axis) > 0.2 else facing
	set_facing(_dodge_dir)
	velocity = Vector2(_dodge_dir * stats.dodge_speed, 0.0)
	invuln_time = maxf(invuln_time, stats.dodge_iframes)
	_dodge_cd = stats.dodge_cooldown + stats.dodge_time
	_ghost_timer = 0.0
	play_anim(&"dodge", true)
	Game.vibrate(10)


func _st_dodge(delta: float) -> StringName:
	var t := fsm.time_in_state
	velocity.x = _dodge_dir * stats.dodge_speed * (1.0 if t < stats.dodge_time * 0.7 else 0.55)
	velocity.y = 0.0
	_ghost_timer -= delta
	if _ghost_timer <= 0.0:
		_ghost_timer = 0.035
		FX.afterimage(sprite)
	if t >= stats.dodge_time:
		return &"ground" if is_on_floor() else &"air"
	return &""


func _exit_dodge() -> void:
	velocity.x *= 0.45


# ------------------------------------------------------------------- skill ---
func _enter_skill() -> void:
	var a := weapon.skill
	mp -= a.mp_cost
	_emit_mp()
	_skill_cd = maxf(0.5, a.cooldown - Profile.skill_cooldown_reduction())
	_skill_cd_total = _skill_cd
	_skill_fired = false
	if absf(move_axis) > 0.3:
		set_facing(move_axis)
	velocity.x = 0.0
	_start_attack(a, a.damage_multiplier)
	FX.burst(VORTEX_TEX, global_position + Vector2(0, -26), 0.3, 0.2, 0.7, true, false, 5)


func _st_skill(delta: float) -> StringName:
	if not _skill_fired and fsm.time_in_state >= _attack.active_start:
		_skill_fired = true
		_spawn_crescent()
	if _run_attack_timing(delta):
		return &"ground" if is_on_floor() else &"air"
	return &""


func _spawn_crescent() -> void:
	var a := weapon.skill
	var p := Projectile.new()
	p.texture = CRESCENT_TEX
	p.lifetime = a.projectile_lifetime if a.projectile_lifetime > 0.0 else 0.8
	p.pierce = true
	p.collide_with_world = false
	p.additive = true
	p.hit_rect = Rect2(-20, -26, 40, 52)
	p.z_index = 40
	var h := _make_hit(a, a.projectile_multiplier if a.projectile_multiplier > 0.0 else a.damage_multiplier)
	h.tag = &"crescent"
	p.setup(global_position + Vector2(facing * 26, -30), Vector2(facing * maxf(a.projectile_speed, 200.0), 0.0),
			h, Hitbox.LAYER_ENEMY_HURTBOX, self)
	p.hit_landed.connect(_on_attack_landed)
	FX._parent().add_child(p)


# ---------------------------------------------------------------- ultimate ---
func _enter_ultimate() -> void:
	var a := weapon.ultimate
	ult = 0.0
	Events.player_ult_changed.emit(ult, stats.ult_max)
	invuln_time = 10.0
	velocity = Vector2.ZERO
	_ult_ticks = 0
	_attack = a
	attack_hitbox.deactivate()
	attack_hitbox.set_rect(a.hitbox)
	play_anim(a.animation, true)
	sprite.pause()
	sprite.frame = 0
	FX.burst(CIRCLE_TEX, global_position + Vector2(0, -6), 0.5, 0.4, 1.4, true, false, 5)
	Events.ultimate_cutin_requested.emit()
	Game.vibrate(60)


func _st_ultimate(_delta: float) -> StringName:
	var t := fsm.time_in_state
	velocity = Vector2.ZERO
	if t >= 0.36 and sprite.frame != 1:
		sprite.frame = 1
		flash(Color(0.6, 0.85, 1.0), 0.3)
		FX.burst(CIRCLE_TEX, global_position + Vector2(0, -4), 1.1, 0.9, 2.6, true, false, 5)
		FX.burst(PILLAR_TEX, global_position + Vector2(0, -30), 0.8, 1.0, 2.2)
		FX.shake(5.0, 0.6)
	while _ult_ticks < ULT_TICKS.size() and t >= ULT_TICKS[_ult_ticks]:
		attack_hitbox.activate(_make_hit(_attack, _attack.damage_multiplier))
		_ult_ticks += 1
		FX.shake(3.0, 0.12)
		for i in 2:
			var off := Vector2(randf_range(-120.0, 120.0), 0.0)
			FX.burst(SPIKE_TEX, global_position + off + Vector2(0, -26), 0.35, 0.5, 1.0)
	if t >= _attack.duration:
		return &"ground" if is_on_floor() else &"air"
	return &""


func _exit_ultimate() -> void:
	attack_hitbox.deactivate()
	invuln_time = 0.45
	sprite.play()


# -------------------------------------------------------------- hurt/dead ---
func _on_attack_landed(_target: Hurtbox, hit: HitData) -> void:
	if hit.tag != &"ultimate":
		# The ultimate itself neither refunds MP nor refills its own gauge.
		mp = minf(stats.max_mp, mp + stats.mp_on_hit)
		_emit_mp()
		add_ult(hit.damage * stats.ult_per_damage * Profile.ult_gain_multiplier())
	Game.add_stat("damage_dealt", hit.damage)
	combo_hits += 1
	_combo_timer = 2.0
	Events.player_combo_changed.emit(combo_hits)
	if combo_hits > int(Game.run.get("max_combo", 0)):
		Game.run["max_combo"] = combo_hits
	FX.hit_stop(hit.hit_stop)
	FX.shake(hit.shake, 0.14)
	FX.spark(hit.position, Color(0.7, 0.86, 1.0), hit.critical)
	Game.vibrate(12)


func _on_hurt(hit: HitData) -> void:
	add_ult(stats.ult_per_hit_taken)
	Game.add_stat("damage_taken", hit.damage)
	FX.shake(maxf(2.5, hit.shake), 0.2)
	Game.vibrate(45)
	if hit.tag == &"fall":
		return
	_knock = hit.knockback
	fsm.change(&"hurt")


func _enter_hurt() -> void:
	_exit_attack()
	_exit_charge()
	_combo_index = 0
	play_anim(&"hurt", true)
	if _knock.x != 0.0:
		set_facing(-signf(_knock.x))
	velocity = Vector2(_knock.x, minf(_knock.y, -60.0))
	invuln_time = stats.hurt_iframes
	_blink_time = stats.hurt_iframes
	combo_hits = 0
	Events.player_combo_changed.emit(0)


func _st_hurt(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 700.0 * delta)
	if fsm.time_in_state >= stats.hurt_stun:
		return &"ground" if is_on_floor() else &"air"
	return &""


func _on_death(hit: HitData) -> void:
	Game.add_stat("damage_taken", hit.damage)
	_knock = hit.knockback
	fsm.change(&"dead")


func _enter_dead() -> void:
	_exit_attack()
	_exit_charge()
	play_anim(&"death", true)
	velocity = Vector2(_knock.x * 0.5, -120.0)
	set_hurtbox_enabled(false)
	input_enabled = false
	_blink_time = 0.0
	visual.modulate.a = 1.0
	FX.time_scale(0.35, 0.8)
	Game.vibrate(120)


func _st_dead(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 400.0 * delta)
	if fsm.time_in_state > 1.6 and not _death_reported:
		_death_reported = true
		Events.player_died.emit()
	return &""


## Heal pickup (HP + a bit of MP).
func collect_heal(amount: int) -> void:
	heal(amount)
	restore_mana(amount * 0.5)
