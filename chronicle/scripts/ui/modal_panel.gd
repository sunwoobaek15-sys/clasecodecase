class_name ModalPanel
extends Control
## Base for full-screen village windows (shop, blacksmith, restoration,
## world map). Pauses the game while open; Esc / 닫기 closes it.

signal closed

var title_text := ""
var panel_size := Vector2(580, 300)
var content: VBoxContainer
var header_info: Label
var _title: Label


func _init(t: String = "", size_px: Vector2 = Vector2(580, 300)) -> void:
	title_text = t
	panel_size = size_px


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	visible = false
	process_mode = Node.PROCESS_MODE_ALWAYS
	add_to_group(&"modal_ui")
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0.04, 0.7)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel := PanelContainer.new()
	panel.custom_minimum_size = panel_size
	center.add_child(panel)
	opaque_panel(panel)
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 6)
	panel.add_child(root)
	var header := HBoxContainer.new()
	_title = UiKit.label(title_text, 18, UiKit.GOLD, true, 4)
	header.add_child(_title)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(spacer)
	header_info = UiKit.label("", 11, Color(1.0, 0.92, 0.6))
	header.add_child(header_info)
	header.add_child(UiKit.button("닫기", close, 70))
	root.add_child(header)
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	root.add_child(scroll)
	content = VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 4)
	scroll.add_child(content)
	_build()


static func opaque_panel(panel: PanelContainer) -> void:
	var sb := panel.get_theme_stylebox(&"panel")
	if sb is StyleBoxFlat:
		var solid := (sb as StyleBoxFlat).duplicate() as StyleBoxFlat
		solid.bg_color.a = 0.98
		panel.add_theme_stylebox_override(&"panel", solid)


## Override: build static parts once.
func _build() -> void:
	pass


## Override: rebuild the rows from the current game state.
func refresh() -> void:
	pass


func open() -> void:
	if visible:
		return
	visible = true
	ModalPanel.pause_game(self)
	refresh()


func close() -> void:
	if not visible:
		return
	visible = false
	ModalPanel.resume_game(self)
	closed.emit()


func _unhandled_input(event: InputEvent) -> void:
	if visible and event.is_action_pressed(&"pause"):
		close()
		get_viewport().set_input_as_handled()


func clear_content() -> void:
	for c in content.get_children():
		c.queue_free()


## One row: icon, two text lines, and an optional button.
func add_row(icon: Texture2D, title: String, sub: String, button_text: String = "", on_press: Callable = Callable(),
		enabled: bool = true) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var ic := TextureRect.new()
	ic.custom_minimum_size = Vector2(40, 34)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.texture = icon
	row.add_child(ic)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 0)
	col.add_child(UiKit.label(title, 11, UiKit.TEXT, true))
	var s := UiKit.label(sub, 11, UiKit.DIM)
	s.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(s)
	row.add_child(col)
	if button_text != "":
		var b := UiKit.button(button_text, on_press, 84)
		b.disabled = not enabled
		row.add_child(b)
	content.add_child(row)
	var sep := HSeparator.new()
	content.add_child(sep)
	return row


# ------------------------------------------------------------- pausing ---
static func pause_game(node: Node) -> void:
	var tree := node.get_tree()
	for tc in tree.get_nodes_in_group(&"touch_controls"):
		tc.call(&"release_all")
	for p in tree.get_nodes_in_group(&"player"):
		if p.has_method(&"clear_input"):
			p.call(&"clear_input")
	tree.paused = true


static func resume_game(node: Node) -> void:
	var tree := node.get_tree()
	for n in tree.get_nodes_in_group(&"modal_ui"):
		if n != node and (n as CanvasItem).visible:
			return
	for pm in tree.get_nodes_in_group(&"pause_menu"):
		if bool(pm.get(&"is_open")):
			return
	tree.paused = false
