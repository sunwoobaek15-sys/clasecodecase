class_name Telegraph
extends Node2D
## Pixel-style ground warning shown before every boss attack.
##   CIRCLE  impact area (falling log, ground burst)
##   LINE    path of a ground attack (root wave), with moving chevrons
## The fill grows and the blinking speeds up until `duration`, then
## `triggered` is emitted and the marker frees itself.

signal triggered(at: Vector2)

enum Shape { CIRCLE, LINE }

var shape: Shape = Shape.CIRCLE
var radius: float = 26.0
var length: float = 200.0
var direction: int = 1
var duration: float = 0.8
var color: Color = Color(1.0, 0.32, 0.22)
var _t: float = 0.0
var _done: bool = false


func _ready() -> void:
	z_index = 6


func progress() -> float:
	return clampf(_t / maxf(duration, 0.001), 0.0, 1.0)


func _physics_process(delta: float) -> void:
	if _done:
		return
	_t += delta
	queue_redraw()
	if _t >= duration:
		_done = true
		triggered.emit(global_position)
		queue_free()


func _draw() -> void:
	var p := progress()
	var blink := 0.55 + 0.45 * sin(_t * (10.0 + 22.0 * p))
	match shape:
		Shape.CIRCLE:
			_draw_circle(p, blink)
		Shape.LINE:
			_draw_line(p, blink)


func _draw_circle(p: float, blink: float) -> void:
	var rx := radius
	var ry := maxf(3.0, roundf(radius * 0.32))
	for yi in range(-int(ry), int(ry) + 1):
		var k := 1.0 - float(yi * yi) / (ry * ry)
		if k < 0.0:
			continue
		var w := roundf(rx * sqrt(k))
		draw_rect(Rect2(-w, yi, w * 2.0, 1.0), Color(color, 0.2 + 0.14 * blink))
		var fw := roundf(rx * p * sqrt(k))
		if fw > 0.0:
			draw_rect(Rect2(-fw, yi, fw * 2.0, 1.0), Color(color, 0.45))
	var steps := int(maxf(32.0, radius * 2.4))
	for i in steps:
		var a := TAU * float(i) / float(steps)
		var pt := Vector2(roundf(cos(a) * rx), roundf(sin(a) * ry))
		draw_rect(Rect2(pt, Vector2(2.0, 1.0)), Color(color, blink))
		draw_rect(Rect2(pt + Vector2(0, 1), Vector2(2.0, 1.0)), Color(color.darkened(0.4), 0.8 * blink))
	# "!" above the marker
	var top := -ry - 14.0
	draw_rect(Rect2(-1.0, top, 2.0, 7.0), Color(1, 0.95, 0.8, blink))
	draw_rect(Rect2(-1.0, top + 9.0, 2.0, 2.0), Color(1, 0.95, 0.8, blink))


func _draw_line(p: float, blink: float) -> void:
	var x0 := 0.0 if direction > 0 else -length
	draw_rect(Rect2(x0, -4.0, length, 8.0), Color(color, 0.2 + 0.12 * blink))
	var filled := length * p
	var fx := 0.0 if direction > 0 else -filled
	draw_rect(Rect2(fx, -3.0, filled, 6.0), Color(color, 0.45))
	draw_rect(Rect2(x0, -5.0, length, 1.0), Color(color, blink))
	draw_rect(Rect2(x0, 4.0, length, 1.0), Color(color, blink))
	var spacing := 26.0
	var shift := fmod(_t * 90.0, spacing)
	var x := shift
	while x < length:
		var cx := x * direction
		for i in 4:
			var col := Color(1, 0.9, 0.7, blink)
			draw_rect(Rect2(cx - direction * i, -i - 1.0, 1.0, 1.0), col)
			draw_rect(Rect2(cx - direction * i, i, 1.0, 1.0), col)
		x += spacing
