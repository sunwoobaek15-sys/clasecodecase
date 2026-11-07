class_name SettingsPanel
extends VBoxContainer
## Settings shared by the title screen and the pause menu.
## Values are stored by Game in user://settings.cfg.

var _scale_label: Label


func _ready() -> void:
	add_theme_constant_override("separation", 6)
	add_child(UiKit.label("설정", 11, UiKit.GOLD, true))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	row.add_child(UiKit.label("버튼 크기", 11))
	var slider := HSlider.new()
	slider.min_value = 0.8
	slider.max_value = 1.4
	slider.step = 0.05
	slider.value = float(Game.settings.get("ui_scale", 1.0))
	slider.custom_minimum_size = Vector2(120, 16)
	slider.focus_mode = Control.FOCUS_NONE
	slider.value_changed.connect(_on_scale)
	row.add_child(slider)
	_scale_label = UiKit.label("%d%%" % roundi(slider.value * 100.0), 11)
	row.add_child(_scale_label)
	add_child(row)
	_add_toggle("조이스틱 위치: 손가락 위치에 생성", "joystick_floating")
	_add_toggle("화면 흔들림", "screen_shake")
	_add_toggle("데미지 숫자 표시", "damage_numbers")
	_add_toggle("진동", "vibration")


func _add_toggle(text: String, key: String) -> void:
	var cb := CheckButton.new()
	cb.text = text
	cb.button_pressed = bool(Game.settings.get(key, true))
	cb.focus_mode = Control.FOCUS_NONE
	cb.toggled.connect(func(on: bool) -> void: Game.set_setting(key, on))
	add_child(cb)


func _on_scale(v: float) -> void:
	_scale_label.text = "%d%%" % roundi(v * 100.0)
	Game.set_setting("ui_scale", v)
