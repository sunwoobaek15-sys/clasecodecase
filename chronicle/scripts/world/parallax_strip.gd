class_name ParallaxStrip
extends Node2D
## A horizontally repeating background layer drawn relative to the camera.
## factor.x: 0 = fixed on screen, 1 = moves with the world (horizontal).
## factor.y: 0 = fixed to the top of the screen, 1 = anchored at world_y.
## Works for any screen width (wide phones show more of the strip).

@export var texture: Texture2D
@export var factor: Vector2 = Vector2(0.3, 0.0)
@export var world_y: float = 0.0     ## world y of the texture top when factor.y = 1
@export var screen_y: float = 0.0    ## screen y of the texture top when factor.y = 0
@export var autoscroll: float = 0.0  ## px/s drift (clouds, mist)

var _drift: float = 0.0


func _ready() -> void:
	texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED


func _process(delta: float) -> void:
	_drift += autoscroll * delta
	queue_redraw()


func _draw() -> void:
	if texture == null:
		return
	var cam := get_viewport().get_camera_2d()
	var view := get_viewport_rect().size
	var center := cam.get_screen_center_position() if cam else view / 2.0
	var top_left := center - view / 2.0
	var tw := float(texture.get_width())
	var scroll := top_left.x * factor.x + _drift
	var start := top_left.x - fposmod(scroll, tw)
	var y := lerpf(top_left.y + screen_y, world_y, factor.y)
	var count := int(ceil(view.x / tw)) + 2
	draw_texture_rect(texture, Rect2(Vector2(roundf(start), roundf(y)), Vector2(tw * count, texture.get_height())), true)
