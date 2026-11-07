extends Control
## Pause menu (pause button / Esc / Start). Pauses the scene tree; this node
## keeps processing because its CanvasLayer runs with PROCESS_MODE_ALWAYS.

var is_open: bool = false
var _panel: PanelContainer


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	add_to_group(&"pause_menu")
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0.04, 0.6)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	_panel = PanelContainer.new()
	center.add_child(_panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 18)
	_panel.add_child(row)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	col.add_child(UiKit.label("일시정지", 22, UiKit.GOLD, true, 4))
	col.add_child(UiKit.button("계속하기", close))
	col.add_child(UiKit.button("캐릭터 · 장비 · 스킬", _on_character))
	col.add_child(UiKit.button("저장하기", _on_save))
	col.add_child(UiKit.button("체크포인트에서 다시", _on_retry))
	col.add_child(UiKit.button("타이틀로", _on_title))
	var help := UiKit.label("키보드: A/D 이동  K 점프  J 공격\nL 회피  U 스킬  I 궁극기", 11, UiKit.DIM)
	col.add_child(help)
	row.add_child(col)
	row.add_child(SettingsPanel.new())
	Events.pause_requested.connect(toggle)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"pause"):
		var cm := _character_menu()
		if cm != null and cm.visible:
			cm.call("close")
		else:
			toggle()
		get_viewport().set_input_as_handled()


func _character_menu() -> Control:
	return get_tree().get_first_node_in_group(&"character_menu") as Control


func _on_character() -> void:
	var cm := _character_menu()
	if cm == null:
		return
	visible = false
	if not cm.is_connected("closed", _on_character_closed):
		cm.connect("closed", _on_character_closed)
	cm.call("open")


func _on_character_closed() -> void:
	if is_open:
		visible = true


func _on_save() -> void:
	if SaveSystem.save_game():
		Events.toast.emit("저장했어요.")
	else:
		Events.toast.emit("저장하지 못했어요: " + SaveSystem.last_error)


func toggle() -> void:
	if is_open:
		close()
	else:
		open()


func open() -> void:
	if is_open or Game.is_changing_scene() or _blocked():
		return
	is_open = true
	visible = true
	get_tree().paused = true
	for tc in get_tree().get_nodes_in_group(&"touch_controls"):
		tc.release_all()


func close() -> void:
	if not is_open:
		return
	is_open = false
	visible = false
	get_tree().paused = false


func _blocked() -> bool:
	for n in get_tree().get_nodes_in_group(&"modal_ui"):
		if n == _character_menu():
			continue
		if n.visible:
			return true
	return false


func _on_retry() -> void:
	close()
	Game.retry_from_checkpoint()


func _on_title() -> void:
	close()
	Game.go_to_title()
