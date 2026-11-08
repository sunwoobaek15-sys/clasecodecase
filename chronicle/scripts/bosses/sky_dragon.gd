class_name SkyDragon
extends Enemy
## 폭풍의 수호룡 템페스타 — boss of the Sky Ruins.
##
## (No reference design exists for this boss: it uses the dragon design of
## the pet sheet at boss size, recoloured to storm colours.)
## Hovers low over the arena; every attack is telegraphed:
##   storm_breath  rears up, aim lines, then a fan of storm orbs
##                 (phase 2: 5 orbs + a follow-up pair)
##   dive_bomb     flies up out of sight; a shadow circle follows the hero,
##                 locks, and the dragon crashes down there. It then sits on
##                 the ground for a moment - the best time to strike
##   lightning     charges with crackling wings; narrow circles mark the
##                 strike points (one on the hero), bolts fall from the sky
##                 (phase 2: a second wave)
##   gale          roars a wind blast that pushes the hero towards the wall
##                 while orbs ride the wind (phase 2 only)
## Phase 2 at 50%: darker storm, faster warnings, more bolts and orbs.
##
## States: dormant, intro, hover, reposition, storm_breath, dive_bomb,
##         grounded, lightning, gale, stagger, phase_shift, dead

const ORB_TEX := preload("res://assets/effects/sky/storm_orb.png")
const WARN := Color(0.55, 0.9, 1.0)
const STORM := Color(0.75, 0.6, 1.2)
const HOVER := 22.0
const TELE_PHASE1 := 1.2
const TELE_PHASE2 := 1.0
const ORB_SPEED := 175.0
const DIVE_TRACK := 1.1
const GROUNDED_TIME := 1.6

var banner_art: Texture2D = preload("res://assets/bosses/sky_dragon/art/full_art.png")
var banner_sub := "하늘의 폐허를 지키는 용"
var banner_name := "템페스타"
var phase: int = 1
var arena_left: float = -100000.0
var arena_right: float = 100000.0
var _ground_y := 0.0
var _flags: Dictionary = {}
var _pending: Array[Node] = []
var _history: Array[StringName] = []
var _idle_len := 1.0
var _poise_max := 170.0
var _intro_done := false
var _shadow: Telegraph = null
var _hover_x := 0.0
var _t := 0.0


func _ready() -> void:
	show_hp_bar = false
	super._ready()
	body_height = 96.0
	_poise_max = stats.poise if stats != null else 170.0
	add_to_group(&"boss")
	health_changed.connect(func(h: int, m: int) -> void: Events.boss_health_changed.emit(h, m))
	for spec in [
			[&"dormant", _st_dormant, _enter_dormant], [&"intro", _st_intro, _enter_intro],
			[&"hover", _st_hover, _enter_hover], [&"reposition", _st_reposition, _enter_reposition],
			[&"storm_breath", _st_breath, _enter_breath], [&"dive_bomb", _st_dive, _enter_dive, _exit_hidden],
			[&"grounded", _st_grounded, _enter_grounded], [&"lightning", _st_lightning, _enter_lightning],
			[&"gale", _st_gale, _enter_gale], [&"stagger", _st_stagger, _enter_stagger],
			[&"phase_shift", _st_phase_shift, _enter_phase_shift], [&"dead", _st_dead, _enter_dead]]:
		fsm.add_state(spec[0], spec[1], spec[2], spec[3] if spec.size() > 3 else Callable())
	fsm.change(&"dormant")


func _physics_process(delta: float) -> void:
	_t += delta
	tick_invulnerability(delta)
	if not has_target():
		find_target()
	fsm.update(delta)
	move_and_slide()
	_prune()
	global_position.x = clampf(global_position.x, arena_left + 50.0, arena_right - 50.0)


func _tele() -> float:
	return TELE_PHASE1 if phase == 1 else TELE_PHASE2


func _arena_x(x: float, m: float = 40.0) -> float:
	return clampf(x, arena_left + m, arena_right - m)


func _warn() -> void:
	flash(WARN if phase == 1 else STORM, 0.35)


func _prune() -> void:
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
	_shadow = null


func _hit(dmg: int, push: Vector2, tag: StringName) -> HitData:
	var h := HitData.make(dmg, push, self, tag)
	h.shake = 2.0
	return h


func _fly_to(p: Vector2, speed: float, delta: float) -> void:
	var to := p - global_position
	velocity = velocity.lerp(to.limit_length(speed), minf(1.0, 4.0 * delta))


func hover_point() -> Vector2:
	return Vector2(_hover_x, _ground_y - HOVER + sin(_t * 2.0) * 4.0)


# ------------------------------------------------------------------- intro ---
func _enter_dormant() -> void:
	_ground_y = global_position.y
	_hover_x = global_position.x
	play_anim(&"sit")
	set_contact_damage(false)
	set_hurtbox_enabled(false)


func _st_dormant(_delta: float) -> StringName:
	velocity = Vector2.ZERO
	return &""


func start_intro() -> void:
	if fsm.current == &"dormant":
		fsm.change(&"intro")


func _enter_intro() -> void:
	face_target()
	play_anim(&"sit")
	Events.boss_intro_started.emit(self)


func _st_intro(delta: float) -> StringName:
	var t := fsm.time_in_state
	if t >= 0.9 and not _flags.get("roar", false):
		_flags["roar"] = true
		play_anim(&"roar", true)
		FX.shake(6.0, 0.8)
		Game.vibrate(150)
	if t >= 1.3:
		_fly_to(hover_point(), 80.0, delta)
	if t >= 2.6:
		_flags.erase("roar")
		_intro_done = true
		set_contact_damage(true)
		set_hurtbox_enabled(true)
		Events.boss_started.emit(self)
		Events.boss_health_changed.emit(hp, max_hp)
		return &"hover"
	return &""


func is_active() -> bool:
	return _intro_done and not is_dead


# ------------------------------------------------------------------- hover ---
func _enter_hover() -> void:
	play_anim(&"idle")
	_idle_len = randf_range(0.9, 1.4) * (1.0 if phase == 1 else 0.75)


func _st_hover(delta: float) -> StringName:
	face_target()
	_fly_to(hover_point(), 90.0, delta)
	if not has_target() or fsm.time_in_state < _idle_len:
		return &""
	return _choose()


func _choose() -> StringName:
	var d := absf(to_target().x)
	var w := {&"storm_breath": 4.0, &"dive_bomb": 3.0, &"lightning": 3.0, &"reposition": 1.5}
	if d < 90.0:
		w[&"dive_bomb"] = 1.0
		w[&"reposition"] = 3.0
	if phase == 2:
		w[&"gale"] = 2.5
		w[&"lightning"] = 4.0
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


func _enter_reposition() -> void:
	play_anim(&"fly")
	var side := 1.0 if randf() < 0.5 else -1.0
	var tx := global_position.x + side * 160.0
	if has_target():
		tx = target.global_position.x + side * randf_range(120.0, 180.0)
	_hover_x = _arena_x(tx, 70.0)


func _st_reposition(delta: float) -> StringName:
	_fly_to(hover_point(), 200.0, delta)
	set_facing(signf(velocity.x) if absf(velocity.x) > 5.0 else float(facing))
	if absf(global_position.x - _hover_x) < 8.0 or fsm.time_in_state > 1.6:
		return &"hover"
	return &""


# ------------------------------------------------------------ storm breath ---
func _orb_angles() -> Array:
	return [-0.32, -0.16, 0.0, 0.16, 0.32] if phase == 2 else [-0.22, 0.0, 0.22]


func _mouth() -> Vector2:
	return global_position + Vector2(facing * 46.0, -56.0)


func _aim() -> Vector2:
	if not has_target():
		return Vector2(facing, 0.3).normalized()
	return (target.global_position + Vector2(0, -18) - _mouth()).normalized()


func _enter_breath() -> void:
	velocity = Vector2.ZERO
	face_target()
	_flags.clear()
	play_anim(&"breath", true)
	_warn()
	var base := _aim()
	_flags["aim"] = base
	var holder := Node2D.new()
	holder.z_index = 6
	FX._parent().add_child(holder)
	holder.global_position = _mouth()
	for a in _orb_angles():
		var l := Line2D.new()
		l.width = 1.5
		l.default_color = Color(WARN if phase == 1 else STORM, 0.55)
		l.points = PackedVector2Array([Vector2.ZERO, base.rotated(a) * 230.0])
		holder.add_child(l)
	var tw := holder.create_tween()
	tw.tween_property(holder, "modulate:a", 0.2, 0.65 * _tele())
	tw.tween_callback(holder.queue_free)
	_track(holder)


func _fire(dir: Vector2, angles: Array) -> void:
	for a in angles:
		var p := Projectile.new()
		p.texture = ORB_TEX
		p.lifetime = 2.6
		p.additive = true
		p.face_velocity = true
		p.hit_rect = Rect2(-8, -7, 16, 14)
		p.z_index = 20
		if phase == 2:
			p.modulate = Color(1.0, 0.85, 1.3)
		var h := _hit(stats.attack_damage, Vector2(signf(dir.x) * 150.0, -120.0), &"storm_orb")
		p.setup(_mouth(), dir.rotated(a) * ORB_SPEED * (1.0 if phase == 1 else 1.15), h, Hitbox.LAYER_PLAYER_HURTBOX, self)
		FX._parent().add_child(p)
		_track(p)


func _st_breath(delta: float) -> StringName:
	_fly_to(hover_point(), 60.0, delta)
	var t := fsm.time_in_state
	var fire := 0.65 * _tele()
	if t >= fire and not _flags.get("fired", false):
		_flags["fired"] = true
		_fire(_flags.get("aim", Vector2(facing, 0)), _orb_angles())
	if phase == 2 and t >= fire + 0.5 and not _flags.get("fired2", false):
		_flags["fired2"] = true
		face_target()
		_fire(_aim(), [-0.1, 0.1])
	if t >= fire + (1.1 if phase == 2 else 0.8):
		return &"hover"
	return &""


# --------------------------------------------------------------- dive bomb ---
func _enter_dive() -> void:
	_flags.clear()
	play_anim(&"fly", true)
	_warn()
	velocity = Vector2(0, -260)


func _st_dive(delta: float) -> StringName:
	var t := fsm.time_in_state
	if t < 0.5:
		velocity = Vector2(0, -260)
		return &""
	if not _flags.get("up", false):
		_flags["up"] = true
		visible = false
		set_hurtbox_enabled(false)
		set_contact_damage(false)
		_shadow = Telegraph.new()
		_shadow.shape = Telegraph.Shape.CIRCLE
		_shadow.radius = 44.0
		_shadow.duration = DIVE_TRACK * _tele() + 0.35
		_shadow.color = WARN if phase == 1 else STORM
		FX._parent().add_child(_shadow)
		_shadow.global_position = Vector2(global_position.x, _ground_y)
		_track(_shadow)
	velocity = Vector2.ZERO
	var track_end := 0.5 + DIVE_TRACK * _tele()
	if t < track_end and is_instance_valid(_shadow) and has_target():
		var sx := move_toward(_shadow.global_position.x, _arena_x(target.global_position.x), 260.0 * delta)
		_shadow.global_position.x = sx
	if t >= track_end + 0.35 and not _flags.get("crash", false):
		_flags["crash"] = true
		var x := _shadow.global_position.x if is_instance_valid(_shadow) else global_position.x
		global_position = Vector2(x, _ground_y)
		visible = true
		set_hurtbox_enabled(true)
		set_contact_damage(true)
		var h := _hit(stats.attack_damage + 6, Vector2(220.0, -260.0), &"dive_bomb")
		Hitbox.blast(FX._parent(), global_position, Rect2(-50, -60, 100, 60), h, Hitbox.LAYER_PLAYER_HURTBOX, 0.15, self)
		FX.shake(7.0, 0.5)
		FX.spark(global_position + Vector2(0, -8), Color(0.7, 0.95, 1.0), true)
		Game.vibrate(120)
		return &"grounded"
	return &""


## Leaving the dive in any way makes the dragon visible and hittable again.
func _exit_hidden() -> void:
	if not is_dead:
		visible = true
		set_hurtbox_enabled(true)
		set_contact_damage(true)


func _enter_grounded() -> void:
	velocity = Vector2.ZERO
	play_anim(&"sit", true)
	_hover_x = global_position.x


func _st_grounded(_delta: float) -> StringName:
	velocity = Vector2.ZERO
	if fsm.time_in_state >= GROUNDED_TIME * (1.0 if phase == 1 else 0.8):
		return &"hover"
	return &""


# --------------------------------------------------------------- lightning ---
func _enter_lightning() -> void:
	velocity = Vector2.ZERO
	_flags.clear()
	play_anim(&"charge", true)
	_warn()
	_bolts(4 if phase == 1 else 5, 1.05 * _tele())


func _bolts(count: int, delay: float) -> void:
	var xs: Array[float] = []
	if has_target():
		xs.append(_arena_x(target.global_position.x, 20.0))
	var tries := 0
	while xs.size() < count and tries < 60:
		tries += 1
		var x := randf_range(arena_left + 24.0, arena_right - 24.0)
		var ok := true
		for o in xs:
			if absf(o - x) < 46.0:
				ok = false
				break
		if ok:
			xs.append(x)
	for i in xs.size():
		var b := LightningStrike.new()
		b.delay = delay + i * 0.06
		b.source = self
		b.color = WARN if phase == 1 else STORM
		b.hit = _hit(stats.attack_damage + 2, Vector2(110.0, -240.0), &"lightning")
		FX._parent().add_child(b)
		b.global_position = Vector2(xs[i], _ground_y)
		_track(b)


func _st_lightning(delta: float) -> StringName:
	_fly_to(hover_point(), 40.0, delta)
	var t := fsm.time_in_state
	if phase == 2 and t >= 0.6 * _tele() and not _flags.get("wave2", false):
		_flags["wave2"] = true
		_bolts(3, 1.0 * _tele())
	if t >= 1.05 * _tele() + (1.4 if phase == 2 else 0.9):
		return &"hover"
	return &""


# -------------------------------------------------------------------- gale ---
func _enter_gale() -> void:
	velocity = Vector2.ZERO
	face_target()
	_flags.clear()
	play_anim(&"roar", true)
	_warn()
	FX.floating_text("강풍!", global_position + Vector2(0, -110), Color(0.8, 0.95, 1.0), 14)


func _st_gale(delta: float) -> StringName:
	var t := fsm.time_in_state
	var start := 0.5 * _tele()
	if t >= start and t < start + 1.6 and has_target() and not target.is_dead:
		target.velocity.x += facing * 520.0 * delta
		if int(t * 10.0) != int((t - delta) * 10.0) and randf() < 0.5:
			FX.spark(target.global_position + Vector2(-facing * 30.0, -randf_range(10, 50)), Color(0.9, 0.97, 1.0))
	if t >= start + 0.4 and not _flags.get("orbs", false):
		_flags["orbs"] = true
		_fire(Vector2(facing, 0), [-0.12, 0.12])
	if t >= start + 1.9:
		return &"hover"
	return &""


# ---------------------------------------------------------- stagger/phase ---
func apply_damage(hit: HitData) -> void:
	if fsm.current in [&"stagger", &"grounded"]:
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
	if fsm.current in [&"dormant", &"intro", &"phase_shift", &"stagger", &"dead", &"dive_bomb"]:
		return
	if breaks_poise(hit):
		fsm.change(&"stagger")


func _enter_stagger() -> void:
	_cancel_pending()
	visible = true
	set_hurtbox_enabled(true)
	velocity = Vector2(0, 80)
	play_anim(&"sit", true)
	flash(Color(1, 1, 1), 0.2)
	_poise_max *= 1.15
	FX.floating_text("그로기!", global_position + Vector2(0, -body_height - 16), Color(1.0, 0.85, 0.3), 16)
	if randf() < 0.5:
		call_deferred("_spawn_heal_orb")


func _st_stagger(delta: float) -> StringName:
	velocity = velocity.lerp(Vector2(0, maxf(0.0, _ground_y - global_position.y) * 3.0), minf(1.0, 5.0 * delta))
	if fsm.time_in_state >= 1.3:
		return &"hover"
	return &""


func _enter_phase_shift() -> void:
	_cancel_pending()
	visible = true
	set_hurtbox_enabled(true)
	velocity = Vector2.ZERO
	invuln_time = 2.3
	play_anim(&"roar", true)
	FX.shake(7.0, 1.0)
	Game.vibrate(200)
	for i in 3:
		var b := LightningStrike.new()
		b.delay = 0.4 + i * 0.25
		b.source = self
		b.color = STORM
		b.harmless = true
		FX._parent().add_child(b)
		b.global_position = Vector2(_arena_x(global_position.x + (i - 1) * 70.0), _ground_y)
		_track(b)


func _st_phase_shift(delta: float) -> StringName:
	_fly_to(hover_point(), 60.0, delta)
	if fsm.time_in_state >= 1.9:
		phase = 2
		poise_damage = 0.0
		modulate = Color(0.85, 0.85, 1.2)
		Events.boss_phase_changed.emit(2)
		Events.toast.emit("템페스타가 폭풍을 부른다!")
		return &"hover"
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
	visible = true
	velocity = Vector2.ZERO
	play_anim(&"die", true)
	FX.time_scale(0.3, 1.3)
	FX.shake(8.0, 1.2)
	FX.spark(global_position + Vector2(0, -40), Color(0.7, 0.95, 1.0), true)
	Game.vibrate(300)


func _st_dead(delta: float) -> StringName:
	_fly_to(Vector2(global_position.x, _ground_y), 120.0, delta)
	if fsm.time_in_state >= 1.5 and not _flags.get("reported", false):
		_flags["reported"] = true
		global_position.y = _ground_y
		Events.enemy_killed.emit(self)
		spawn_drops()
		Events.boss_defeated.emit(self)
	return &""


## A lightning bolt: narrow warning circle and a faint column, then a jagged
## bolt from the sky with a damaging column at the bottom.
class LightningStrike extends Node2D:
	var delay := 1.0
	var hit: HitData
	var source: Node = null
	var color := Color(0.55, 0.9, 1.0)
	var harmless := false
	var _t := 0.0
	var _fired := false
	var _bolt: Line2D
	var _glow: Line2D

	func _ready() -> void:
		var tele := Telegraph.new()
		tele.shape = Telegraph.Shape.CIRCLE
		tele.radius = 16.0
		tele.duration = delay
		tele.color = color
		add_child(tele)
		z_index = 30

	func progress() -> float:
		return clampf(_t / maxf(delay, 0.001), 0.0, 1.0)

	func _physics_process(delta: float) -> void:
		_t += delta
		queue_redraw()
		if not _fired and _t >= delay:
			_fired = true
			_strike()

	func _draw() -> void:
		if not _fired:
			draw_line(Vector2(0, -320), Vector2.ZERO, Color(color, 0.15 + 0.25 * progress()), 1.0)

	func _strike() -> void:
		var pts := PackedVector2Array()
		var y := -340.0
		var x := 0.0
		while y < 0.0:
			pts.append(Vector2(x, y))
			y += randf_range(18.0, 34.0)
			x = clampf(x + randf_range(-10.0, 10.0), -14.0, 14.0)
		pts.append(Vector2.ZERO)
		_glow = Line2D.new()
		_glow.points = pts
		_glow.width = 7.0
		_glow.default_color = Color(color, 0.45)
		add_child(_glow)
		_bolt = Line2D.new()
		_bolt.points = pts
		_bolt.width = 2.0
		_bolt.default_color = Color(1, 1, 1)
		add_child(_bolt)
		if not harmless and hit != null:
			Hitbox.blast(FX._parent(), global_position, Rect2(-15, -120, 30, 120), hit, Hitbox.LAYER_PLAYER_HURTBOX, 0.12, source)
		FX.spark(global_position + Vector2(0, -6), Color(0.9, 0.97, 1.0), true)
		FX.shake(2.0, 0.12)
		var tw := create_tween()
		tw.tween_property(self, "modulate:a", 0.0, 0.3).set_delay(0.12)
		tw.tween_callback(queue_free)
