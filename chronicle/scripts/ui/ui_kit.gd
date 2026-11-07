class_name UiKit
extends RefCounted
## Small helpers so every screen uses the same fonts, colours and spacing.

const FONT := preload("res://assets/ui/fonts/Galmuri11.ttf")
const FONT_BOLD := preload("res://assets/ui/fonts/Galmuri11-Bold.ttf")
const GOLD := Color(0.95, 0.8, 0.45)
const TEXT := Color(0.95, 0.93, 0.86)
const DIM := Color(0.7, 0.72, 0.78)
const OUTLINE := Color(0.03, 0.03, 0.08)


static func label(text: String, size: int = 11, color: Color = TEXT, bold: bool = false, outline: int = 3) -> Label:
	var l := Label.new()
	l.text = text
	var ls := LabelSettings.new()
	ls.font = FONT_BOLD if bold else FONT
	ls.font_size = size
	ls.font_color = color
	ls.outline_size = outline
	ls.outline_color = OUTLINE
	l.label_settings = ls
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


static func button(text: String, on_pressed: Callable, min_width: float = 140.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(min_width, 26)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(on_pressed)
	return b


static func format_time(seconds: float) -> String:
	var s := int(seconds)
	return "%02d:%02d" % [s / 60, s % 60]
