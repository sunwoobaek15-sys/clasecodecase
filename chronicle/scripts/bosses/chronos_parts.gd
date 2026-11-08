class_name ChronosParts
extends RefCounted
## Helper nodes for Chronos' attacks.


## 푸른 시간 폭발: a blue warning circle, then a clock-face explosion.
class TimeBurst extends Node2D:
	var delay := 1.1
	var radius := 30.0
	var hit: HitData
	var source: Node = null
	var tex: Texture2D
	var tint := Color(0.45, 0.65, 1.0)
	var _t := 0.0
	var _fired := false

	func _ready() -> void:
		var tele := Telegraph.new()
		tele.shape = Telegraph.Shape.CIRCLE
		tele.radius = radius
		tele.duration = delay
		tele.color = tint
		add_child(tele)

	func _physics_process(delta: float) -> void:
		_t += delta
		if not _fired and _t >= delay:
			_fired = true
			var parent := FX._parent()
			Hitbox.blast(parent, global_position, Rect2(-radius, -70, radius * 2.0, 70), hit,
					Hitbox.LAYER_PLAYER_HURTBOX, 0.15, source)
			FX.burst(tex, global_position + Vector2(0, -34), 0.55, 0.5, 1.0, true, false, 5)
			FX.shake(2.5, 0.15)
			var t := create_tween()
			t.tween_interval(0.6)
			t.tween_callback(queue_free)


## 시간 역행: a frozen copy of Chronos with an hourglass. Hitting it once
## shatters it; if it survives `duration`, Chronos rewinds to it and heals.
class Afterimage extends Node2D:
	signal shattered
	signal expired(at: Vector2)

	var frames: SpriteFrames
	var facing := 1
	var duration := 4.0
	var hourglass: Texture2D
	var _t := 0.0
	var _done := false
	var _hurt: Hurtbox
	var _sprite: AnimatedSprite2D
	var _glass: Sprite2D

	func _ready() -> void:
		add_to_group(&"afterimage")
		z_index = 9
		_sprite = AnimatedSprite2D.new()
		_sprite.sprite_frames = frames
		if frames.has_meta("anchor"):
			_sprite.centered = false
			_sprite.offset = -Vector2(frames.get_meta("anchor"))
		_sprite.play(&"time_stop")
		_sprite.scale.x = facing
		_sprite.modulate = Color(0.55, 0.75, 1.4, 0.65)
		add_child(_sprite)
		_glass = Sprite2D.new()
		_glass.texture = hourglass
		_glass.position = Vector2(0, -110)
		add_child(_glass)
		_hurt = Hurtbox.new()
		_hurt.collision_layer = Hitbox.LAYER_ENEMY_HURTBOX
		_hurt.entity = self
		var cs := CollisionShape2D.new()
		var r := RectangleShape2D.new()
		r.size = Vector2(36, 76)
		cs.shape = r
		cs.position = Vector2(0, -38)
		_hurt.add_child(cs)
		add_child(_hurt)

	func remaining() -> float:
		return maxf(0.0, duration - _t)

	func _physics_process(delta: float) -> void:
		if _done:
			return
		_t += delta
		_glass.rotation = PI * clampf(_t / duration, 0.0, 1.0)
		_sprite.modulate.a = 0.45 + 0.2 * sin(_t * 8.0)
		queue_redraw()
		if _t >= duration:
			_done = true
			expired.emit(global_position)
			queue_free()

	func _draw() -> void:
		if _done:
			return
		var ratio := clampf(1.0 - _t / duration, 0.0, 1.0)
		draw_arc(Vector2(0, -110), 16.0, -PI / 2.0, -PI / 2.0 + TAU * ratio, 28, Color(0.6, 0.85, 1.0, 0.9), 2.0)

	func take_hit(_hit: HitData) -> bool:
		if _done:
			return false
		_done = true
		FX.spark(global_position + Vector2(0, -40), Color(0.7, 0.85, 1.0), true)
		FX.floating_text("역행 저지!", global_position + Vector2(0, -130), Color(0.7, 0.9, 1.0), 14)
		shattered.emit()
		queue_free()
		return true


## 시간 정지 countdown: a clock ring above the hero that closes; when it
## closes, everyone who is not dodging is frozen.
class TimeStopRing extends Node2D:
	signal struck

	var target: Node2D
	var duration := 1.6
	var _t := 0.0
	var _done := false

	func _ready() -> void:
		z_index = 70

	func progress() -> float:
		return clampf(_t / maxf(duration, 0.001), 0.0, 1.0)

	func _physics_process(delta: float) -> void:
		if _done:
			return
		_t += delta
		if is_instance_valid(target):
			global_position = target.global_position + Vector2(0, -36)
		queue_redraw()
		if _t >= duration:
			_done = true
			struck.emit()
			queue_free()

	func _draw() -> void:
		var p := progress()
		var r := lerpf(46.0, 14.0, p)
		var blink := 0.6 + 0.4 * sin(_t * (10.0 + 30.0 * p))
		draw_arc(Vector2.ZERO, r, 0.0, TAU, 40, Color(0.5, 0.75, 1.0, 0.85 * blink), 2.0)
		for i in 12:
			var a := i * TAU / 12.0
			draw_line(Vector2(cos(a), sin(a)) * (r - 3.0), Vector2(cos(a), sin(a)) * (r + 2.0),
					Color(0.8, 0.9, 1.0, 0.8), 1.0)
		var hand := -PI / 2.0 + TAU * p
		draw_line(Vector2.ZERO, Vector2(cos(hand), sin(hand)) * (r - 4.0), Color(1, 1, 1, 0.95), 2.0)
