class_name Verdan
extends Enemy
## 숲의 수호자 베르단 — mid boss of the Forgotten Forest.
##
## Every attack is telegraphed (orange flash + ground marker) so the player
## can read and avoid it:
##   tree_throw    wind-up + landing marker, a log flies in an arc
##                 (phase 2: a second log at the player's new position)
##   root_charge   crouch + glowing line, a root wave runs along the ground
##                 (phase 2: waves to both sides)
##   forest_wrath  arms raised + nature circle, green pillars erupt at marked
##                 spots, one of them under the player (phase 2: two waves)
## Poise: accumulated hits stagger him (hit animation, +30% damage taken).
## Phase 2 starts at 50% HP: roar, faster telegraphs, more pressure.
##
## States: dormant, intro, idle, walk, tree_throw, root_charge, forest_wrath,
##         stagger, phase_shift, dead

const LOG_TEX := preload("res://assets/effects/verdan/log.png")
const NATURE_CIRCLE_TEX := preload("res://assets/effects/verdan/nature_circle.png")
const LEAF_SWIRL_TEX := preload("res://assets/effects/verdan/leaf_swirl.png")
const GREEN_BURST_TEX := preload("res://assets/effects/verdan/green_burst.png")
const GROUND_BURST_TEX := preload("res://assets/effects/verdan/ground_burst.png")
const WARN_COLOR := Color(1.0, 0.55, 0.2)
## Big aura effects are drawn behind the characters so they never hide them
## (Effects layer z 0 + this < Enemies z 10 / Actors z 12).
const BEHIND_Z := 5
## Difficulty tuning (play-test feedback: the first version was too hard).
## Longer warnings, slower root waves, fewer bursts, longer breathing room.
const TELE_PHASE1 := 1.25
const TELE_PHASE2 := 1.05
const SPEED_PHASE1 := 0.85
const SPEED_PHASE2 := 1.0
const IDLE_MIN := 1.0
const IDLE_MAX := 1.6
const IDLE_PHASE2 := 0.8
const WRATH_BURSTS := 3
const WRATH_SECOND_WAVE := 2
const ROOT_BONUS_DAMAGE := 1
const WRATH_BONUS_DAMAGE := 2
const STAGGER_HEAL_CHANCE := 0.6

var phase: int = 1
var arena_left: float = -100000.0
var arena_right: float = 100000.0
var _history: Array[StringName] = []
var _pending: Array[Node] = []
var _flags: Dictionary = {}
var _idle_len: float = 1.0
var _aim: Vector2 = Vector2.ZERO
var _aim2: Vector2 = Vector2.ZERO
var _poise_max: float = 100.0
var _staggers: int = 0
var _intro_done: bool = false


func _ready() -> void:
	show_hp_bar = false
	super._ready()
	body_height = 120.0
	_poise_max = stats.poise if stats != null else 100.0
	add_to_group(&"boss")
	health_changed.connect(func(h: int, m: int) -> void: Events.boss_health_changed.emit(h, m))
	fsm.add_state(&"dormant", _st_dormant, _enter_dormant)
	fsm.add_state(&"intro", _st_intro, _enter_intro)
	fsm.add_state(&"idle", _st_idle, _enter_idle)
	fsm.add_state(&"walk", _st_walk, _enter_walk)
	fsm.add_state(&"tree_throw", _st_tree_throw, _enter_tree_throw)
	fsm.add_state(&"root_charge", _st_root_charge, _enter_root_charge)
	fsm.add_state(&"forest_wrath", _st_forest_wrath, _enter_forest_wrath)
	fsm.add_state(&"stagger", _st_stagger, _enter_stagger)
	fsm.add_state(&"phase_shift", _st_phase_shift, _enter_phase_shift)
	fsm.add_state(&"dead", _st_dead, _enter_dead)
	fsm.change(&"dormant")


func _physics_process(delta: float) -> void:
	tick_invulnerability(delta)
	if not has_target():
		find_target()
	fsm.update(delta)
	apply_gravity(delta)
	move_and_slide()
	_prune_pending()
	global_position.x = clampf(global_position.x, arena_left + 50.0, arena_right - 50.0)


## Telegraph length multiplier (phase 2 is a little faster).
func _tele() -> float:
	return TELE_PHASE1 if phase == 1 else TELE_PHASE2


func _speed() -> float:
	return SPEED_PHASE1 if phase == 1 else SPEED_PHASE2


func ground_y() -> float:
	return global_position.y


func _arena_x(x: float, margin: float = 24.0) -> float:
	return clampf(x, arena_left + margin, arena_right - margin)


func _warn() -> void:
	flash(WARN_COLOR, 0.35)


func _prune_pending() -> void:
	var alive: Array[Node] = []
	for n in _pending:
		if is_instance_valid(n):
			alive.append(n)
	_pending = alive


func _track(n: Node) -> Node:
	_pending.append(n)
	return n


func _cancel_pending() -> void:
	for n in _pending:
		if is_instance_valid(n):
			n.queue_free()
	_pending.clear()


func _make_hit(dmg: int, push: Vector2, tag: StringName) -> HitData:
	var h := HitData.make(dmg, push, self, tag)
	h.shake = 2.0
	return h


# ------------------------------------------------------------------- intro ---
func _enter_dormant() -> void:
	play_anim(&"idle")
	set_contact_damage(false)
	set_hurtbox_enabled(false)


func _st_dormant(_delta: float) -> StringName:
	velocity.x = 0.0
	return &""


## Called by the stage when the player walks into the arena.
func start_intro() -> void:
	if fsm.current == &"dormant":
		fsm.change(&"intro")


func _enter_intro() -> void:
	face_target()
	play_anim(&"idle")
	Events.boss_intro_started.emit(self)


func _st_intro(_delta: float) -> StringName:
	var t := fsm.time_in_state
	if t >= 1.0 and not _flags.get("roar", false):
		_flags["roar"] = true
		play_anim(&"wrath", true)
		FX.shake(6.0, 0.8)
		FX.burst(LEAF_SWIRL_TEX, global_position + Vector2(0, -70), 0.9, 0.8, 2.0, false, false, BEHIND_Z)
		Game.vibrate(150)
	if t >= 2.6:
		_flags.erase("roar")
		_intro_done = true
		set_contact_damage(true)
		set_hurtbox_enabled(true)
		Events.boss_started.emit(self)
		Events.boss_health_changed.emit(hp, max_hp)
		return &"idle"
	return &""


func is_active() -> bool:
	return _intro_done and not is_dead


# -------------------------------------------------------------- idle/walk ---
func _enter_idle() -> void:
	sprite.speed_scale = 1.0
	play_anim(&"idle")
	_idle_len = randf_range(IDLE_MIN, IDLE_MAX) * (1.0 if phase == 1 else IDLE_PHASE2)


func _st_idle(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 600.0 * delta)
	face_target()
	if not has_target():
		return &""
	if fsm.time_in_state < _idle_len:
		return &""
	return _choose_attack()


func _choose_attack() -> StringName:
	var d := absf(to_target().x)
	var weights: Dictionary
	if d > 230.0:
		weights = {&"tree_throw": 5.0, &"root_charge": 4.0, &"forest_wrath": 2.0, &"walk": 2.0}
	elif d > 110.0:
		weights = {&"tree_throw": 3.0, &"root_charge": 4.0, &"forest_wrath": 4.0, &"walk": 1.0}
	else:
		weights = {&"tree_throw": 1.5, &"root_charge": 3.0, &"forest_wrath": 5.0}
	if _history.size() >= 2 and _history[-1] == _history[-2]:
		weights.erase(_history[-1])
	var total := 0.0
	for k in weights:
		total += float(weights[k])
	var r := randf() * total
	var pick: StringName = weights.keys()[0]
	for k in weights:
		r -= float(weights[k])
		if r <= 0.0:
			pick = k
			break
	_history.append(pick)
	if _history.size() > 4:
		_history.pop_front()
	return pick


func _enter_walk() -> void:
	play_anim(&"move")


func _st_walk(_delta: float) -> StringName:
	if not has_target():
		return &"idle"
	face_target()
	velocity.x = facing * stats.move_speed * _speed()
	if absf(to_target().x) < 130.0 or fsm.time_in_state > 1.5:
		velocity.x = 0.0
		return _choose_attack() if absf(to_target().x) < 130.0 else &"idle"
	return &""


# -------------------------------------------------------------- tree throw ---
func _enter_tree_throw() -> void:
	velocity.x = 0.0
	face_target()
	_flags.clear()
	play_anim(&"throw", true)
	sprite.speed_scale = 1.0 / _tele()
	_warn()
	_aim = _predict_landing()
	_spawn_log_marker(_aim, (0.6 + 0.8) * _tele())


func _predict_landing() -> Vector2:
	var tx := target.global_position.x if has_target() else global_position.x + facing * 150.0
	if has_target():
		tx += target.velocity.x * 0.35
	return Vector2(_arena_x(tx), ground_y())


func _spawn_log_marker(at: Vector2, duration: float) -> void:
	var tele := Telegraph.new()
	tele.shape = Telegraph.Shape.CIRCLE
	tele.radius = 30.0
	tele.duration = duration
	tele.color = Color(1.0, 0.3, 0.2)
	FX._parent().add_child(tele)
	tele.global_position = at
	_track(tele)


func _st_tree_throw(_delta: float) -> StringName:
	var t := fsm.time_in_state
	var release := 0.6 * _tele()
	if t >= release and not _flags.get("log1", false):
		_flags["log1"] = true
		_throw_log(_aim, 0.8 * _tele())
	if phase == 2:
		if t >= release + 0.2 and not _flags.get("mark2", false):
			_flags["mark2"] = true
			_aim2 = _predict_landing()
			_spawn_log_marker(_aim2, 0.55 + 0.7 * _tele())
		if t >= release + 0.75 and not _flags.get("log2", false):
			_flags["log2"] = true
			play_anim(&"throw", true)
			_throw_log(_aim2, 0.7 * _tele())
	if t >= release + (1.9 if phase == 2 else 1.3):
		sprite.speed_scale = 1.0
		return &"idle"
	return &""


func _throw_log(at: Vector2, flight: float) -> void:
	var p := Projectile.new()
	p.texture = LOG_TEX
	p.gravity = 520.0
	p.lifetime = 3.0
	p.spin = 7.0
	p.hit_rect = Rect2(-18, -14, 36, 28)
	p.z_index = 25
	var from := global_position + Vector2(facing * 46.0, -96.0)
	var vel := Projectile.ballistic_velocity(from, at + Vector2(0, -6), flight, p.gravity)
	var h := _make_hit(stats.attack_damage, Vector2(facing * 160.0, -140.0), &"tree_throw")
	p.setup(from, vel, h, Hitbox.LAYER_PLAYER_HURTBOX, self)
	p.impacted.connect(_on_log_impact)
	FX._parent().add_child(p)
	_track(p)


func _on_log_impact(at: Vector2, _hit_something: bool) -> void:
	var h := _make_hit(int(stats.attack_damage * 0.8), Vector2(170.0, -160.0), &"log_impact")
	Hitbox.blast(FX._parent(), at, Rect2(-30, -30, 60, 32), h, Hitbox.LAYER_PLAYER_HURTBOX, 0.12, self)
	FX.burst(GROUND_BURST_TEX, at + Vector2(0, -28), 0.4, 0.5, 0.9, false)
	FX.shake(3.0, 0.2)


# ------------------------------------------------------------- root charge ---
func _enter_root_charge() -> void:
	velocity.x = 0.0
	face_target()
	_flags.clear()
	play_anim(&"roots", true)
	sprite.pause()
	sprite.frame = 0
	_warn()
	_spawn_root_line(facing)
	if phase == 2:
		_spawn_root_line(-facing)


func _root_start_x(dir: int) -> float:
	return global_position.x + dir * 54.0


func _root_length(dir: int) -> float:
	var start := _root_start_x(dir)
	return maxf(0.0, (arena_right - 16.0 - start) if dir > 0 else (start - arena_left - 16.0))


func _spawn_root_line(dir: int) -> void:
	var tele := Telegraph.new()
	tele.shape = Telegraph.Shape.LINE
	tele.direction = dir
	tele.length = _root_length(dir)
	tele.duration = 0.85 * _tele()
	FX._parent().add_child(tele)
	tele.global_position = Vector2(_root_start_x(dir), ground_y() - 2.0)
	_track(tele)


func _st_root_charge(_delta: float) -> StringName:
	var t := fsm.time_in_state
	var slam := 0.85 * _tele()
	if t >= slam and not _flags.get("slam", false):
		_flags["slam"] = true
		sprite.frame = 1
		FX.shake(4.0, 0.3)
		_spawn_root_wave(facing)
		if phase == 2:
			_spawn_root_wave(-facing)
	if t >= slam + 0.15 and sprite.frame == 1:
		sprite.frame = 2
	if t >= slam + 1.2:
		sprite.play()
		return &"idle"
	return &""


func _spawn_root_wave(dir: int) -> void:
	var w := RootWave.new()
	w.direction = dir
	w.speed = 280.0 * _speed()
	w.max_distance = _root_length(dir)
	w.source = self
	w.hit = _make_hit(stats.attack_damage + ROOT_BONUS_DAMAGE, Vector2(150.0, -260.0), &"root_wave")
	FX._parent().add_child(w)
	w.global_position = Vector2(_root_start_x(dir), ground_y())
	_track(w)


# ------------------------------------------------------------ forest wrath ---
func _enter_forest_wrath() -> void:
	velocity.x = 0.0
	face_target()
	_flags.clear()
	play_anim(&"wrath", true)
	_warn()
	var circle := FX.burst(NATURE_CIRCLE_TEX, global_position + Vector2(0, -150), 1.2 * _tele(), 0.5, 1.3, true, false, 4)
	if circle:
		var spin := circle.create_tween()
		spin.tween_property(circle, "rotation", TAU, 1.2 * _tele())
	_spawn_wrath_wave(WRATH_BURSTS, 1.0 * _tele())


func _spawn_wrath_wave(count: int, delay: float) -> void:
	var xs: Array[float] = []
	if has_target():
		xs.append(_arena_x(target.global_position.x))
	var tries := 0
	while xs.size() < count and tries < 60:
		tries += 1
		var x := randf_range(arena_left + 30.0, arena_right - 30.0)
		var ok := true
		for other in xs:
			if absf(other - x) < 56.0:
				ok = false
				break
		if ok:
			xs.append(x)
	for i in xs.size():
		var b := WrathBurst.new()
		b.delay = delay + i * 0.1
		b.source = self
		b.hit = _make_hit(stats.attack_damage + WRATH_BONUS_DAMAGE, Vector2(120.0, -280.0), &"forest_wrath")
		FX._parent().add_child(b)
		b.global_position = Vector2(xs[i], ground_y())
		_track(b)


func _st_forest_wrath(_delta: float) -> StringName:
	var t := fsm.time_in_state
	if phase == 2 and t >= 0.55 * _tele() and not _flags.get("wave2", false):
		_flags["wave2"] = true
		_spawn_wrath_wave(WRATH_SECOND_WAVE, 0.95 * _tele())
	if t >= (1.0 * _tele() + (1.6 if phase == 2 else 1.1)):
		return &"idle"
	return &""


# ---------------------------------------------------------- stagger/phase ---
func apply_damage(hit: HitData) -> void:
	if fsm.current == &"stagger":
		hit.damage = roundi(hit.damage * 1.3)
	super.apply_damage(hit)
	if not is_dead and phase == 1 and hp * 2 <= max_hp and fsm.current != &"phase_shift":
		fsm.change(&"phase_shift")


func breaks_poise(hit: HitData) -> bool:
	poise_damage += hit.stagger
	if poise_damage >= _poise_max:
		poise_damage = 0.0
		return true
	return false


func _on_hurt(hit: HitData) -> void:
	if fsm.current in [&"dormant", &"intro", &"phase_shift", &"stagger", &"dead"]:
		return
	if breaks_poise(hit):
		fsm.change(&"stagger")


func _enter_stagger() -> void:
	_cancel_pending()
	sprite.speed_scale = 1.0
	velocity.x = 0.0
	play_anim(&"hit", true)
	flash(Color(1, 1, 1), 0.2)
	_staggers += 1
	_poise_max *= 1.15  # harder to stun-lock
	FX.floating_text("그로기!", global_position + Vector2(0, -body_height - 16), Color(1.0, 0.85, 0.3), 16)
	if randf() < STAGGER_HEAL_CHANCE:
		call_deferred("_spawn_heal_orb")


func _st_stagger(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 600.0 * delta)
	if fsm.time_in_state >= 1.3:
		return &"idle"
	return &""


func _enter_phase_shift() -> void:
	_cancel_pending()
	sprite.speed_scale = 1.0
	velocity.x = 0.0
	invuln_time = 2.2
	play_anim(&"wrath", true)
	FX.shake(7.0, 1.0)
	FX.burst(GREEN_BURST_TEX, global_position + Vector2(0, -60), 0.9, 1.0, 2.2, true, false, BEHIND_Z)
	FX.burst(LEAF_SWIRL_TEX, global_position + Vector2(0, -70), 1.0, 0.8, 2.4, false, false, BEHIND_Z)
	Game.vibrate(200)
	if has_target() and absf(to_target().x) < 150.0:
		target.velocity.x = signf(to_target().x) * 320.0
		target.velocity.y = -160.0


func _st_phase_shift(_delta: float) -> StringName:
	if fsm.time_in_state >= 1.8:
		phase = 2
		poise_damage = 0.0
		modulate = Color(1.08, 1.18, 1.05)
		Events.boss_phase_changed.emit(2)
		Events.toast.emit("베르단이 분노했다!")
		return &"idle"
	return &""


# -------------------------------------------------------------------- death ---
func _on_death(hit: HitData) -> void:
	set_contact_damage(false)
	set_hurtbox_enabled(false)
	Game.add_stat("kills", 1)
	_knock = hit.knockback
	fsm.change(&"dead")


func _enter_dead() -> void:
	_cancel_pending()
	sprite.speed_scale = 1.0
	velocity = Vector2.ZERO
	play_anim(&"die", true)
	FX.time_scale(0.3, 1.3)
	FX.shake(8.0, 1.2)
	FX.burst(LEAF_SWIRL_TEX, global_position + Vector2(0, -60), 1.4, 1.0, 2.6, false, false, BEHIND_Z)
	FX.burst(GREEN_BURST_TEX, global_position + Vector2(0, -50), 1.0, 1.0, 2.0, true, false, BEHIND_Z)
	Game.vibrate(300)


func _st_dead(_delta: float) -> StringName:
	if fsm.time_in_state >= 1.5 and not _flags.get("reported", false):
		_flags["reported"] = true
		Events.enemy_killed.emit(self)
		Events.boss_defeated.emit(self)
	return &""
