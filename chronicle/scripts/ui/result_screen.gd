extends Control
## Stage clear / game over panels.

var shown: StringName = &""
var _panel: PanelContainer
var _box: VBoxContainer


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false
	add_to_group(&"modal_ui")
	add_to_group(&"result_screen")
	var dim := ColorRect.new()
	dim.name = "Dim"
	dim.color = Color(0, 0, 0.04, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center := CenterContainer.new()
	center.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	_panel = PanelContainer.new()
	center.add_child(_panel)
	_box = VBoxContainer.new()
	_box.add_theme_constant_override("separation", 6)
	_box.alignment = BoxContainer.ALIGNMENT_CENTER
	_panel.add_child(_box)
	Events.stage_cleared.connect(_on_cleared)
	Events.player_died.connect(_on_died)


func _clear() -> void:
	for c in _box.get_children():
		c.queue_free()


func _center(c: Control) -> Control:
	c.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	if c is Label:
		(c as Label).horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_box.add_child(c)
	return c


func _on_cleared(stats: Dictionary) -> void:
	shown = &"clear"
	_clear()
	_center(UiKit.label("STAGE CLEAR", 33, UiKit.GOLD, true, 5))
	_center(UiKit.label("숲의 수호자 베르단을 쓰러뜨리고\n시간의 핵 조각을 되찾았다!", 11, Color(0.85, 1.0, 0.85)))
	var lines := "플레이 시간  %s\n가한 피해  %d\n최대 콤보  %d HIT\n처치한 적  %d\n쓰러진 횟수  %d" % [
		UiKit.format_time(float(stats.get("time", 0.0))), int(stats.get("damage_dealt", 0)),
		int(stats.get("max_combo", 0)), int(stats.get("kills", 0)), int(stats.get("deaths", 0))]
	_center(UiKit.label(lines, 11, UiKit.TEXT))
	_center(UiKit.label("Phase 1 전투 프로토타입 완료 - 다음: 성장 시스템", 11, UiKit.DIM))
	_center(UiKit.button("처음부터 다시", _on_restart))
	_center(UiKit.button("타이틀로", _on_title))
	_show()


func _on_died() -> void:
	shown = &"dead"
	_clear()
	_center(UiKit.label("쓰러졌다...", 33, Color(1.0, 0.45, 0.4), true, 5))
	_center(UiKit.label("시간의 흐름이 다시 너를 일으킨다.", 11, UiKit.DIM))
	_center(UiKit.button("체크포인트에서 재도전", _on_retry))
	_center(UiKit.button("타이틀로", _on_title))
	_show()


func _show() -> void:
	visible = true
	modulate.a = 0.0
	var t := create_tween().set_pause_mode(Tween.TWEEN_PAUSE_PROCESS)
	t.tween_property(self, "modulate:a", 1.0, 0.35)
	get_tree().paused = true


func _on_restart() -> void:
	_leave()
	Game.new_game()


func _on_title() -> void:
	_leave()
	Game.go_to_title()


func _on_retry() -> void:
	_leave()
	Game.retry_from_checkpoint()


func _leave() -> void:
	visible = false
	get_tree().paused = false


## Used by tests and the autoplay bot.
func press_first_button() -> void:
	for c in _box.get_children():
		if c is Button and not c.is_queued_for_deletion():
			(c as Button).pressed.emit()
			return
