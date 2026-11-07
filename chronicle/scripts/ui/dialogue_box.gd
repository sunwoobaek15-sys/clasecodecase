class_name DialogueBox
extends Control
## NPC conversation window: portrait, name, typewriter text and choices.
##
##   say("미아", portrait, ["line 1", "line 2"], [{"text": "상점", "call": f}, ...])
## Tap / attack / interact advances; after the last line the choices are
## shown. A choice's callable runs after the box closes (it may open the
## next dialogue or a panel). Pauses the game while open.

signal closed

const CHARS_PER_SEC := 45.0

var _portrait: TextureRect
var _name: Label
var _text: Label
var _hint: Label
var _choices: VBoxContainer
var _lines: PackedStringArray = []
var _line := 0
var _shown := 0.0
var _pending_choices: Array = []


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_to_group(&"modal_ui")
	add_to_group(&"dialogue_box")
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0.04, 0.35)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	dim.mouse_filter = Control.MOUSE_FILTER_STOP
	dim.gui_input.connect(_on_gui_input)
	add_child(dim)
	var panel := PanelContainer.new()
	panel.anchor_left = 0.0
	panel.anchor_right = 1.0
	panel.anchor_top = 1.0
	panel.anchor_bottom = 1.0
	panel.offset_left = 16
	panel.offset_right = -16
	panel.offset_top = -104
	panel.offset_bottom = -8
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.gui_input.connect(_on_gui_input)
	add_child(panel)
	ModalPanel.opaque_panel(panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	panel.add_child(row)
	_portrait = TextureRect.new()
	_portrait.custom_minimum_size = Vector2(64, 84)
	_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	row.add_child(_portrait)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(col)
	_name = UiKit.label("", 13, UiKit.GOLD, true, 4)
	col.add_child(_name)
	_text = UiKit.label("", 11, UiKit.TEXT)
	_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(_text)
	_hint = UiKit.label("▼", 11, UiKit.DIM)
	_hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	col.add_child(_hint)
	_choices = VBoxContainer.new()
	_choices.anchor_left = 1.0
	_choices.anchor_right = 1.0
	_choices.anchor_top = 1.0
	_choices.anchor_bottom = 1.0
	_choices.offset_left = -236
	_choices.offset_right = -20
	_choices.offset_bottom = -110
	_choices.grow_vertical = Control.GROW_DIRECTION_BEGIN
	_choices.add_theme_constant_override("separation", 3)
	add_child(_choices)


func is_open() -> bool:
	return visible


func say(speaker: String, portrait: Texture2D, lines: PackedStringArray, choices: Array = []) -> void:
	_name.text = speaker
	_portrait.texture = portrait
	_portrait.visible = portrait != null
	_lines = lines if not lines.is_empty() else PackedStringArray([""])
	_line = 0
	_shown = 0.0
	_pending_choices = choices
	_clear_choices()
	_text.text = _lines[0]
	_text.visible_characters = 0
	if not visible:
		visible = true
		ModalPanel.pause_game(self)


func close() -> void:
	if not visible:
		return
	visible = false
	_clear_choices()
	ModalPanel.resume_game(self)
	closed.emit()


func _process(delta: float) -> void:
	if not visible:
		return
	var total := _text.text.length()
	if _shown < total:
		_shown = minf(total, _shown + CHARS_PER_SEC * delta)
		_text.visible_characters = int(_shown)
	_hint.visible = _shown >= total and _choices.get_child_count() == 0
	if _shown >= total and _line == _lines.size() - 1 and _choices.get_child_count() == 0 and not _pending_choices.is_empty():
		_show_choices()


func advance() -> void:
	if not visible:
		return
	if _shown < _text.text.length():
		_shown = _text.text.length()
		_text.visible_characters = -1
		return
	if _line < _lines.size() - 1:
		_line += 1
		_text.text = _lines[_line]
		_shown = 0.0
		_text.visible_characters = 0
		return
	if _pending_choices.is_empty():
		close()


func _show_choices() -> void:
	_clear_choices()
	for c in _pending_choices:
		var d: Dictionary = c
		var cb: Callable = d.get("call", Callable())
		var b := UiKit.button(str(d.get("text", "")), _choose.bind(cb), 216)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		_choices.add_child(b)


func _choose(cb: Callable) -> void:
	_pending_choices = []
	close()
	if cb.is_valid():
		cb.call()


## Used by tests and the autoplay bot: presses the choice whose text
## contains `part`. Returns false if there is none.
func choose_containing(part: String) -> bool:
	if _choices.get_child_count() == 0 and not _pending_choices.is_empty():
		_line = _lines.size() - 1
		_shown = _text.text.length()
		_show_choices()
	for b in _choices.get_children():
		if b is Button and (b as Button).text.contains(part):
			(b as Button).pressed.emit()
			return true
	return false


func choice_texts() -> PackedStringArray:
	var out: PackedStringArray = []
	for c in _pending_choices:
		out.append(str((c as Dictionary).get("text", "")))
	return out


func _clear_choices() -> void:
	for c in _choices.get_children():
		c.queue_free()


func _on_gui_input(event: InputEvent) -> void:
	if (event is InputEventMouseButton and (event as InputEventMouseButton).pressed) or \
			(event is InputEventScreenTouch and (event as InputEventScreenTouch).pressed):
		advance()


func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event.is_action_pressed(&"attack") or event.is_action_pressed(&"interact") or event.is_action_pressed(&"jump"):
		advance()
		get_viewport().set_input_as_handled()
	elif event.is_action_pressed(&"pause"):
		close()
		get_viewport().set_input_as_handled()
