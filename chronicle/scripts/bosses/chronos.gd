class_name Chronos
extends Enemy
## 시간의 지배자 크로노스 — boss of the Fallen Clock City.
##
## Every attack is telegraphed:
##   staff_dash   staff wind-up + ground line, then a dash slash
##                (phase 2: a second dash after turning around)
##   gear_shot    points the staff, aim lines appear, then spinning clock
##                gears fly at the hero (3 / phase 2: 5 and a second volley)
##   time_stop    a clock ring closes over the hero; when it closes the hero
##                is frozen unless dodging at that moment (i-frames), and
##                Chronos fires gears at the frozen hero (a hit unfreezes)
##   time_rewind  leaves a frozen afterimage with an hourglass and blinks
##                away; break the afterimage with one hit, otherwise he
##                rewinds to it and heals part of the damage taken since
##   time_burst   blue warning circles (one under the hero) erupt into clock
##                explosions (phase 2: purple, two waves)
## Moves by walking or blinking (teleport with a star burst).
## Phase 2 at 50% HP: purple time, faster warnings, more projectiles.
##
## States: dormant, intro, idle, walk, blink, staff_dash, gear_shot,
##         time_stop, time_rewind, time_burst, stagger, phase_shift, dead

const FX_FRAMES := preload("res://assets/effects/chronos/chronos_fx_frames.tres")
const GEAR_TEX := preload("res://assets/effects/chronos/gear_watch.png")
const CLOCK_FACE_TEX := preload("res://assets/effects/chronos/clock_face.png")
const STAR_TEX := preload("res://assets/effects/chronos/star_burst.png")
const BURST_TEX := preload("res://assets/effects/chronos/clock_burst.png")
const BURST2_TEX := preload("res://assets/effects/chronos/clock_burst2.png")
const PURPLE_TEX := preload("res://assets/effects/chronos/purple_burst.png")
const CRESCENT_TEX := preload("res://assets/effects/chronos/crescent.png")
const PILLAR_TEX := preload("res://assets/effects/chronos/time_pillar.png")
const SHATTER_TEX := preload("res://assets/effects/chronos/shatter.png")
const HOURGLASS_TEX := preload("res://assets/effects/chronos/hourglass.png")
const BROKEN_CLOCK_TEX := preload("res://assets/bosses/chronos/art/broken_clock.png")
const WARN_COLOR := Color(0.45, 0.7, 1.0)
const PURPLE := Color(0.8, 0.55, 1.2)
const BEHIND_Z := 5
## Difficulty tuning (same philosophy as Verdan: readable, fair warnings).
const TELE_PHASE1 := 1.2
const TELE_PHASE2 := 1.0
const IDLE_MIN := 0.9
const IDLE_MAX := 1.4
const IDLE_PHASE2 := 0.75
const DASH_DIST := 150.0
const GEAR_SPEED := 190.0
const FREEZE_TIME := 1.1
const REWIND_TIME := 4.0
const REWIND_HEAL_CAP := 0.08
const STAGGER_HEAL_CHANCE := 0.5

var banner_art: Texture2D = preload("res://assets/bosses/chronos/art/full_art.png")
var banner_sub := "무너진 시계 도시의 지배자"
var banner_name := "크로노스"
var phase2_art: Texture2D = preload("res://assets/bosses/chronos/art/phase2_art.png")
var phase2_name := "크로노스 - 시간 폭주"
var phase: int = 1
var arena_left: float = -100000.0
var arena_right: float = 100000.0
var _history: Array[StringName] = []
var _pending: Array[Node] = []
var _flags: Dictionary = {}
var _idle_len: float = 1.0
var _poise_max: float = 100.0
var _intro_done := false
var _dash_dir := 1
var _dash_hitbox: Hitbox
var _afterimage: ChronosParts.Afterimage = null
var _hp_at_rewind := 0
var _blink_to := Vector2.ZERO
var _time_stops := 0


func _ready() -> void:
	show_hp_bar = false
	super._ready()
	body_height = 86.0
	_poise_max = stats.poise if stats != null else 100.0
	add_to_group(&"boss")
	health_changed.connect(func(h: int, m: int) -> void: Events.boss_health_changed.emit(h, m))
	_dash_hitbox = Hitbox.create(Rect2(-6, -70, 46, 66), Hitbox.LAYER_PLAYER_HURTBOX)
	visual.add_child(_dash_hitbox)
	for spec in [
			[&"dormant", _st_dormant, _enter_dormant], [&"intro", _st_intro, _enter_intro],
			[&"idle", _st_idle, _enter_idle], [&"walk", _st_walk, _enter_walk],
			[&"blink", _st_blink, _enter_blink, _exit_blink], [&"staff_dash", _st_staff_dash, _enter_staff_dash],
			[&"gear_shot", _st_gear_shot, _enter_gear_shot], [&"time_stop", _st_time_stop, _enter_time_stop],
			[&"time_rewind", _st_time_rewind, _enter_time_rewind], [&"time_burst", _st_time_burst, _enter_time_burst],
			[&"stagger", _st_stagger, _enter_stagger], [&"phase_shift", _st_phase_shift, _enter_phase_shift],
			[&"dead", _st_dead, _enter_dead]]:
		fsm.add_state(spec[0], spec[1], spec[2], spec[3] if spec.size() > 3 else Callable())
	fsm.change(&"dormant")


func _physics_process(delta: float) -> void:
	tick_invulnerability(delta)
	if not has_target():
		find_target()
	fsm.update(delta)
	apply_gravity(delta)
	move_and_slide()
	_prune_pending()
	global_position.x = clampf(global_position.x, arena_left + 40.0, arena_right - 40.0)


func _tele() -> float:
	return TELE_PHASE1 if phase == 1 else TELE_PHASE2


func ground_y() -> float:
	return global_position.y


func _arena_x(x: float, margin: float = 28.0) -> float:
	return clampf(x, arena_left + margin, arena_right - margin)


func _warn() -> void:
	flash(WARN_COLOR if phase == 1 else PURPLE, 0.35)


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
		if is_instance_valid(n) and n != _afterimage:
			n.queue_free()
	_pending.clear()
	_dash_hitbox.deactivate()


func _make_hit(dmg: int, push: Vector2, tag: StringName) -> HitData:
	var h := HitData.make(dmg, push, self, tag)
	h.shake = 2.0
	return h


func _burst_tex() -> Texture2D:
	return BURST_TEX if phase == 1 else PURPLE_TEX


# ------------------------------------------------------------------- intro ---
func _enter_dormant() -> void:
	play_anim(&"idle")
	set_contact_damage(false)
	set_hurtbox_enabled(false)


func _st_dormant(_delta: float) -> StringName:
	velocity.x = 0.0
	return &""


func start_intro() -> void:
	if fsm.current == &"dormant":
		fsm.change(&"intro")


func _enter_intro() -> void:
	face_target()
	play_anim(&"idle")
	Events.boss_intro_started.emit(self)


func _st_intro(_delta: float) -> StringName:
	var t := fsm.time_in_state
	if t >= 1.0 and not _flags.get("cast", false):
		_flags["cast"] = true
		play_anim(&"cast_clock", true)
		FX.shake(5.0, 0.6)
		FX.burst(CLOCK_FACE_TEX, global_position + Vector2(0, -70), 1.2, 0.6, 2.2, true, false, BEHIND_Z)
		Game.vibrate(150)
	if t >= 2.6:
		_flags.erase("cast")
		_intro_done = true
		set_contact_damage(true)
		set_hurtbox_enabled(true)
		Events.boss_started.emit(self)
		Events.boss_health_changed.emit(hp, max_hp)
		return &"idle"
	return &""


func is_active() -> bool:
	return _intro_done and not is_dead


# -------------------------------------------------------------- idle/move ---
func _enter_idle() -> void:
	sprite.speed_scale = 1.0
	play_anim(&"idle")
	_dash_hitbox.deactivate()
	_idle_len = randf_range(IDLE_MIN, IDLE_MAX) * (1.0 if phase == 1 else IDLE_PHASE2)


func _st_idle(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 600.0 * delta)
	face_target()
	if not has_target() or fsm.time_in_state < _idle_len:
		return &""
	return _choose_attack()


func _choose_attack() -> StringName:
	var d := absf(to_target().x)
	var w: Dictionary
	if d < 150.0:
		w = {&"staff_dash": 5.0, &"time_burst": 3.0, &"time_stop": 2.0, &"blink": 2.0, &"time_rewind": 1.0}
	elif d < 280.0:
		w = {&"gear_shot": 4.0, &"time_burst": 3.0, &"time_stop": 2.5, &"staff_dash": 2.0, &"time_rewind": 1.5, &"walk": 1.0}
	else:
		w = {&"gear_shot": 5.0, &"blink": 3.0, &"time_burst": 2.0, &"walk": 2.0}
	if is_instance_valid(_afterimage):
		w.erase(&"time_rewind")
	if phase == 2:
		w[&"time_rewind"] = float(w.get(&"time_rewind", 0.0)) + (1.0 if not is_instance_valid(_afterimage) else 0.0)
		w[&"time_stop"] = float(w.get(&"time_stop", 0.0)) + 1.0
	if _history.size() >= 2 and _history[-1] == _history[-2]:
		w.erase(_history[-1])
	var total := 0.0
	for k in w:
		total += float(w[k])
	var r := randf() * total
	var pick: StringName = w.keys()[0]
	for k in w:
		r -= float(w[k])
		if r <= 0.0:
			pick = k
			break
	_history.append(pick)
	if _history.size() > 4:
		_history.pop_front()
	return pick


func _enter_walk() -> void:
	play_anim(&"walk")


func _st_walk(_delta: float) -> StringName:
	if not has_target():
		return &"idle"
	face_target()
	velocity.x = facing * stats.move_speed * (1.0 if phase == 1 else 1.3)
	if absf(to_target().x) < 140.0 or fsm.time_in_state > 1.4:
		velocity.x = 0.0
		return _choose_attack() if absf(to_target().x) < 140.0 else &"idle"
	return &""


func _enter_blink() -> void:
	velocity.x = 0.0
	_flags.clear()
	play_anim(&"cast", true)
	FX.burst(STAR_TEX, global_position + Vector2(0, -44), 0.45, 0.4, 1.0, true, false, BEHIND_Z)
	var side := -1.0 if randf() < 0.5 else 1.0
	var tx := global_position.x
	if has_target():
		tx = target.global_position.x + side * randf_range(120.0, 170.0)
		if tx < arena_left + 60.0 or tx > arena_right - 60.0:
			tx = target.global_position.x - side * 140.0
	_blink_to = Vector2(_arena_x(tx, 60.0), global_position.y)


func _exit_blink() -> void:
	if not is_dead:
		visible = true
		set_hurtbox_enabled(true)
		set_contact_damage(true)


func _st_blink(_delta: float) -> StringName:
	var t := fsm.time_in_state
	if t >= 0.25 and not _flags.get("gone", false):
		_flags["gone"] = true
		visible = false
		set_hurtbox_enabled(false)
		set_contact_damage(false)
	if t >= 0.55 and not _flags.get("back", false):
		_flags["back"] = true
		global_position = _blink_to
		visible = true
		set_hurtbox_enabled(true)
		set_contact_damage(true)
		face_target()
		FX.burst(STAR_TEX, global_position + Vector2(0, -44), 0.4, 1.0, 0.4, true, false, BEHIND_Z)
	if t >= 0.85:
		return &"gear_shot" if randf() < 0.5 else &"idle"
	return &""


# --------------------------------------------------------------- staff dash ---
func _enter_staff_dash() -> void:
	velocity.x = 0.0
	face_target()
	_flags.clear()
	_dash_dir = facing
	_start_dash_windup()


func _start_dash_windup() -> void:
	play_anim(&"staff_windup", true)
	_warn()
	var tele := Telegraph.new()
	tele.shape = Telegraph.Shape.LINE
	tele.direction = _dash_dir
	tele.length = DASH_DIST + 30.0
	tele.duration = 0.6 * _tele()
	tele.color = WARN_COLOR if phase == 1 else PURPLE
	FX._parent().add_child(tele)
	tele.global_position = Vector2(global_position.x + _dash_dir * 20.0, ground_y() - 2.0)
	_track(tele)


func _st_staff_dash(delta: float) -> StringName:
	var t := fsm.time_in_state
	var wind := 0.6 * _tele()
	var dash_len := 0.26
	var second: bool = phase == 2 and bool(_flags.get("second", false))
	var t0 := wind if not second else float(_flags.get("t2", 0.0))
	if t >= t0 and t < t0 + dash_len:
		if not _flags.get("dashing", false):
			_flags["dashing"] = true
			play_anim(&"staff_attack", true)
			_dash_hitbox.activate(_make_hit(stats.attack_damage + 3, Vector2(_dash_dir * 200.0, -160.0), &"staff_dash"))
			FX.shake(2.0, 0.15)
		velocity.x = _dash_dir * DASH_DIST / dash_len
	elif t >= t0 + dash_len and _flags.get("dashing", false):
		_flags["dashing"] = false
		velocity.x = 0.0
		_dash_hitbox.deactivate()
		FX.burst(CRESCENT_TEX, global_position + Vector2(_dash_dir * 30.0, -40), 0.35, 0.7, 1.1, true, _dash_dir < 0, 20)
		if phase == 2 and not _flags.get("second", false):
			_flags["second"] = true
			face_target()
			_dash_dir = facing
			_flags["t2"] = t + 0.45 * _tele()
			_start_dash_windup()
			return &""
		_flags["end"] = t
	else:
		velocity.x = move_toward(velocity.x, 0.0, 900.0 * delta)
	if _flags.has("end") and t >= float(_flags["end"]) + 0.5:
		return &"idle"
	return &""


# ---------------------------------------------------------------- gear shot ---
func _enter_gear_shot() -> void:
	velocity.x = 0.0
	face_target()
	_flags.clear()
	play_anim(&"point", true)
	_warn()
	_show_aim_lines()


func _gear_angles() -> Array:
	return [-0.32, -0.16, 0.0, 0.16, 0.32] if phase == 2 else [-0.2, 0.0, 0.2]


func _aim_vector() -> Vector2:
	var from := global_position + Vector2(facing * 30.0, -56.0)
	if not has_target():
		return Vector2(facing, 0)
	return (target.global_position + Vector2(0, -20) - from).normalized()


func _show_aim_lines() -> void:
	var holder := Node2D.new()
	holder.z_index = 6
	FX._parent().add_child(holder)
	holder.global_position = global_position + Vector2(facing * 30.0, -56.0)
	var base := _aim_vector()
	for a in _gear_angles():
		var line := Line2D.new()
		line.width = 1.5
		line.default_color = Color(WARN_COLOR if phase == 1 else PURPLE, 0.55)
		line.points = PackedVector2Array([Vector2.ZERO, base.rotated(a) * 240.0])
		holder.add_child(line)
	var t := holder.create_tween()
	t.tween_property(holder, "modulate:a", 0.2, 0.6 * _tele())
	t.tween_callback(holder.queue_free)
	_track(holder)
	_flags["aim"] = base


func _fire_gears(dir: Vector2, angles: Array) -> void:
	var from := global_position + Vector2(facing * 30.0, -56.0)
	for a in angles:
		var p := Projectile.new()
		p.texture = GEAR_TEX
		p.lifetime = 2.6
		p.spin = 12.0
		p.hit_rect = Rect2(-9, -9, 18, 18)
		p.z_index = 20
		p.scale = Vector2(0.6, 0.6)
		if phase == 2:
			p.modulate = PURPLE
		var h := _make_hit(stats.attack_damage, Vector2(signf(dir.x) * 140.0, -110.0), &"gear_shot")
		p.setup(from, dir.rotated(a) * GEAR_SPEED * (1.0 if phase == 1 else 1.15), h, Hitbox.LAYER_PLAYER_HURTBOX, self)
		FX._parent().add_child(p)
		_track(p)


func _st_gear_shot(_delta: float) -> StringName:
	var t := fsm.time_in_state
	var fire := 0.6 * _tele()
	if t >= fire and not _flags.get("fired", false):
		_flags["fired"] = true
		_fire_gears(_flags.get("aim", Vector2(facing, 0)), _gear_angles())
	if phase == 2 and t >= fire + 0.55 and not _flags.get("fired2", false):
		_flags["fired2"] = true
		face_target()
		_fire_gears(_aim_vector(), [-0.1, 0.1])
	if t >= fire + (1.2 if phase == 2 else 0.8):
		return &"idle"
	return &""


# ---------------------------------------------------------------- time stop ---
func _enter_time_stop() -> void:
	velocity.x = 0.0
	face_target()
	_flags.clear()
	play_anim(&"cast_clock", true)
	_warn()
	_time_stops += 1
	if _time_stops == 1:
		Events.toast.emit("시계가 멈추는 순간 회피하세요!")
	var clock := FX.burst(CLOCK_FACE_TEX, global_position + Vector2(0, -120), 1.6 * _tele() + 0.3, 0.6, 1.1, true, false, BEHIND_Z)
	if clock:
		var spin := clock.create_tween()
		spin.tween_property(clock, "rotation", -TAU, 1.6 * _tele())
	if has_target():
		var ring := ChronosParts.TimeStopRing.new()
		ring.target = target
		ring.duration = 1.6 * _tele()
		ring.struck.connect(_on_time_stop_struck)
		FX._parent().add_child(ring)
		_track(ring)


func _on_time_stop_struck() -> void:
	if is_dead or fsm.current != &"time_stop":
		return
	_flags["struck"] = fsm.time_in_state
	FX.burst(PILLAR_TEX if phase == 1 else PURPLE_TEX, global_position + Vector2(0, -56), 0.6, 0.6, 1.3, true, false, BEHIND_Z)
	if has_target():
		if target.call(&"freeze", FREEZE_TIME + (0.2 if phase == 2 else 0.0)):
			_flags["frozen"] = true
			FX.floating_text("시간 정지!", target.global_position + Vector2(0, -80), Color(0.6, 0.8, 1.0), 14)
		else:
			FX.floating_text("회피 성공!", target.global_position + Vector2(0, -80), Color(0.8, 1.0, 0.8), 14)


func _st_time_stop(_delta: float) -> StringName:
	var t := fsm.time_in_state
	if _flags.has("struck"):
		var s := float(_flags["struck"])
		if t >= s + 0.25 and not _flags.get("fired", false):
			_flags["fired"] = true
			play_anim(&"point", true)
			face_target()
			_fire_gears(_aim_vector(), [-0.08, 0.0, 0.08] if _flags.get("frozen", false) else [0.0])
		if t >= s + 1.2:
			return &"idle"
	elif t > 1.6 * _tele() + 0.5:
		return &"idle"
	return &""


# -------------------------------------------------------------- time rewind ---
func _enter_time_rewind() -> void:
	velocity.x = 0.0
	_flags.clear()
	play_anim(&"summon", true)
	_warn()
	_hp_at_rewind = hp
	var img := ChronosParts.Afterimage.new()
	img.frames = sprite.sprite_frames
	img.facing = facing
	img.hourglass = HOURGLASS_TEX
	img.duration = REWIND_TIME if phase == 1 else REWIND_TIME - 0.5
	img.shattered.connect(_on_afterimage_shattered)
	img.expired.connect(_on_afterimage_expired)
	FX._parent().add_child(img)
	img.global_position = global_position
	_afterimage = img
	FX.floating_text("시간 역행 준비", global_position + Vector2(0, -110), Color(0.6, 0.85, 1.0), 12)


func _st_time_rewind(_delta: float) -> StringName:
	if fsm.time_in_state >= 0.6:
		return &"blink"
	return &""


func _on_afterimage_shattered() -> void:
	_afterimage = null
	FX.burst(SHATTER_TEX, global_position + Vector2(0, -40), 0.4, 0.6, 1.0, true, false, BEHIND_Z)


func _on_afterimage_expired(at: Vector2) -> void:
	_afterimage = null
	if is_dead:
		return
	var lost := maxi(0, _hp_at_rewind - hp)
	var amount := mini(lost, roundi(max_hp * REWIND_HEAL_CAP))
	FX.burst(BURST2_TEX, global_position + Vector2(0, -40), 0.4, 0.8, 0.3, true, false, BEHIND_Z)
	global_position = Vector2(_arena_x(at.x, 40.0), global_position.y)
	FX.burst(BURST2_TEX, global_position + Vector2(0, -40), 0.5, 0.3, 1.2, true, false, BEHIND_Z)
	if amount > 0:
		heal(amount)
	FX.floating_text("시간 역행!", global_position + Vector2(0, -110), Color(0.6, 0.85, 1.0), 14)


func afterimage() -> Node2D:
	return _afterimage if is_instance_valid(_afterimage) else null


# --------------------------------------------------------------- time burst ---
func _enter_time_burst() -> void:
	velocity.x = 0.0
	face_target()
	_flags.clear()
	play_anim(&"summon", true)
	_warn()
	_spawn_bursts(3, 1.05 * _tele())


func _spawn_bursts(count: int, delay: float) -> void:
	var xs: Array[float] = []
	if has_target():
		xs.append(_arena_x(target.global_position.x))
	var tries := 0
	while xs.size() < count and tries < 60:
		tries += 1
		var x := randf_range(arena_left + 30.0, arena_right - 30.0)
		var ok := true
		for other in xs:
			if absf(other - x) < 60.0:
				ok = false
				break
		if ok:
			xs.append(x)
	for i in xs.size():
		var b := ChronosParts.TimeBurst.new()
		b.delay = delay + i * 0.08
		b.source = self
		b.tex = _burst_tex()
		b.tint = WARN_COLOR if phase == 1 else PURPLE
		b.hit = _make_hit(stats.attack_damage + 2, Vector2(120.0, -260.0), &"time_burst")
		FX._parent().add_child(b)
		b.global_position = Vector2(xs[i], ground_y())
		_track(b)


func _st_time_burst(_delta: float) -> StringName:
	var t := fsm.time_in_state
	if phase == 2 and t >= 0.6 * _tele() and not _flags.get("wave2", false):
		_flags["wave2"] = true
		_spawn_bursts(2, 1.0 * _tele())
	if t >= 1.05 * _tele() + (1.5 if phase == 2 else 1.0):
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
	if fsm.current in [&"dormant", &"intro", &"phase_shift", &"stagger", &"dead", &"blink"]:
		return
	if breaks_poise(hit):
		fsm.change(&"stagger")


func _enter_stagger() -> void:
	_cancel_pending()
	visible = true
	sprite.speed_scale = 1.0
	velocity.x = 0.0
	play_anim(&"hit", true)
	flash(Color(1, 1, 1), 0.2)
	_poise_max *= 1.15
	FX.floating_text("그로기!", global_position + Vector2(0, -body_height - 16), Color(1.0, 0.85, 0.3), 16)
	if randf() < STAGGER_HEAL_CHANCE:
		call_deferred("_spawn_heal_orb")


func _st_stagger(delta: float) -> StringName:
	velocity.x = move_toward(velocity.x, 0.0, 600.0 * delta)
	if fsm.time_in_state >= 1.2:
		return &"idle"
	return &""


func _enter_phase_shift() -> void:
	_cancel_pending()
	visible = true
	set_hurtbox_enabled(true)
	sprite.speed_scale = 1.0
	velocity.x = 0.0
	invuln_time = 2.3
	play_anim(&"time_stop", true)
	FX.shake(7.0, 1.0)
	FX.burst(PILLAR_TEX, global_position + Vector2(0, -60), 1.0, 0.6, 1.6, true, false, BEHIND_Z)
	FX.burst(PURPLE_TEX, global_position + Vector2(0, -50), 1.2, 0.6, 2.0, true, false, BEHIND_Z)
	Game.vibrate(200)
	if has_target() and absf(to_target().x) < 150.0:
		target.velocity.x = signf(to_target().x) * 320.0
		target.velocity.y = -160.0


func _st_phase_shift(_delta: float) -> StringName:
	if fsm.time_in_state >= 1.9:
		phase = 2
		poise_damage = 0.0
		modulate = Color(0.95, 0.82, 1.15)
		Events.boss_phase_changed.emit(2)
		Events.toast.emit("크로노스의 시간이 폭주한다!")
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
	if is_instance_valid(_afterimage):
		_afterimage.queue_free()
	visible = true
	sprite.speed_scale = 1.0
	velocity = Vector2.ZERO
	play_anim(&"die", true)
	FX.time_scale(0.3, 1.3)
	FX.shake(8.0, 1.2)
	FX.burst(SHATTER_TEX, global_position + Vector2(0, -50), 1.2, 0.8, 2.2, true, false, BEHIND_Z)
	FX.burst(BROKEN_CLOCK_TEX, global_position + Vector2(0, -60), 1.4, 0.6, 1.0, false, false, BEHIND_Z)
	Game.vibrate(300)


func _st_dead(_delta: float) -> StringName:
	modulate.a = maxf(0.0, 1.0 - fsm.time_in_state / 1.8)
	if fsm.time_in_state >= 1.5 and not _flags.get("reported", false):
		_flags["reported"] = true
		Events.enemy_killed.emit(self)
		spawn_drops()
		Events.boss_defeated.emit(self)
	return &""
