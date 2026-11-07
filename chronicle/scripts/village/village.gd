extends Node2D
## The village of Lumen (hub between stages).
##
## Six facilities that start in ruins (Village autoload), NPCs who appear when
## their facility is rebuilt, the notice board (restoration), the gate (world
## map) and the farm plot. The hero walks around; the closest interactable in
## range gets the 대화/이용 button (touch) or E key. Conversations and windows
## pause the game.

const PLAYER_SCENE := preload("res://scenes/player/player.tscn")
const HUD_SCENE := preload("res://scenes/ui/hud.tscn")
const CONTROLS_SCENE := preload("res://scenes/ui/touch_controls.tscn")
const PAUSE_SCENE := preload("res://scenes/ui/pause_menu.tscn")
const CHARACTER_MENU_SCENE := preload("res://scenes/ui/character_menu.tscn")
const BG_SKY := preload("res://assets/environments/village/bg_sky.png")
const BG_FAR := preload("res://assets/environments/village/bg_far.png")
const BG_MID := preload("res://assets/environments/village/bg_mid.png")
const GROUND_TEX := preload("res://assets/environments/village/ground.png")
const GATE_TEX := preload("res://assets/environments/village/gate.png")
const PLOT_TEX := {
	0: preload("res://assets/environments/village/farm_plot_empty.png"),
	1: preload("res://assets/environments/village/farm_plot_growing.png"),
	2: preload("res://assets/environments/village/farm_plot_ripe.png"),
}
const PROPS := {
	"stall": preload("res://assets/environments/village/props/stall.png"),
	"board": preload("res://assets/environments/village/props/notice_board.png"),
	"banner": preload("res://assets/environments/village/props/banner.png"),
	"lamp": preload("res://assets/environments/village/props/lamp.png"),
	"barrel": preload("res://assets/environments/village/props/barrel.png"),
	"bush": preload("res://assets/environments/village/props/bush.png"),
	"potion_sign": preload("res://assets/environments/village/props/potion_sign.png"),
}

const WIDTH := 1720.0
const GROUND_Y := 312.0
const SPAWN_X := 170.0
const GATE_X := 60.0
const BUILDING_X := {&"shop": 400.0, &"smithy": 560.0, &"library": 950.0, &"lab": 1110.0,
		&"farm": 1270.0, &"training": 1500.0}
const NPC_X := {&"guard_gareth": 140.0, &"merchant_kairo": 448.0, &"smith_bron": 610.0,
		&"keeper_mia": 760.0, &"scholar_edel": 998.0, &"witch_lyra": 1158.0, &"priest_serena": 1548.0,
		&"traveler_shade": 1640.0}
const BOARD_X := 700.0
const PLOT_X := 1376.0

var player: Player
var camera: CameraRig
var dialogue: DialogueBox
var panels: Dictionary = {}       ## name -> ModalPanel
var npcs: Dictionary = {}         ## id -> Npc
var character_menu: Control
var target: Interactable = null
var _buildings: Dictionary = {}   ## facility id -> Sprite2D
var _plot: Sprite2D
var _plot_spot: Interactable
var _stall: Sprite2D

@onready var world: Node2D = $World
@onready var actors: Node2D = $World/Actors


func _ready() -> void:
	add_to_group(&"village")
	FX.effects_parent = world
	FX.reset_time()
	_build_background()
	_build_ground()
	_build_village()
	_spawn_player()
	_build_ui()
	player.emit_all_stats()
	Village.changed.connect(_refresh_village)
	Village.restored.connect(_on_restored)
	Pets.changed.connect(_ensure_pet)
	_refresh_village()
	if not Village.met.has(&"keeper_mia"):
		_hint_later("마을 관리인 미아에게 말을 걸어 보세요.  (대화 버튼 / E)")
	SaveSystem.save_game()


func _hint_later(text: String) -> void:
	await get_tree().create_timer(1.2).timeout
	Events.toast.emit(text)


# --------------------------------------------------------------- building ---
func _build_background() -> void:
	var bg := Node2D.new()
	bg.z_index = -100
	add_child(bg)
	for spec in [[BG_SKY, Vector2(0.03, 0.0), 0.0], [BG_FAR, Vector2(0.12, 0.0), -20.0], [BG_MID, Vector2(0.4, 0.0), 0.0]]:
		var s := ParallaxStrip.new()
		s.texture = spec[0]
		s.factor = spec[1]
		s.world_y = spec[2]
		bg.add_child(s)


func _build_ground() -> void:
	var g := Sprite2D.new()
	g.texture = GROUND_TEX
	g.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	g.region_enabled = true
	g.region_rect = Rect2(0, 0, WIDTH + 640.0, 96.0)
	g.centered = false
	g.position = Vector2(-320, GROUND_Y)
	g.z_index = -10
	world.add_child(g)
	var body := StaticBody2D.new()
	body.collision_layer = 1
	body.collision_mask = 0
	world.add_child(body)
	var floor_shape := CollisionShape2D.new()
	var rect := RectangleShape2D.new()
	rect.size = Vector2(WIDTH + 400.0, 80.0)
	floor_shape.shape = rect
	floor_shape.position = Vector2(WIDTH / 2.0, GROUND_Y + 40.0)
	body.add_child(floor_shape)
	for x in [16.0, WIDTH - 16.0]:
		var wall := CollisionShape2D.new()
		var wr := RectangleShape2D.new()
		wr.size = Vector2(32, 400)
		wall.shape = wr
		wall.position = Vector2(x - 16.0 * signf(WIDTH / 2.0 - x), GROUND_Y - 200.0)
		body.add_child(wall)


func _prop(tex: Texture2D, x: float, z: int = -6, y_off: float = 0.0) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = tex
	s.centered = false
	s.offset = Vector2(-tex.get_width() / 2.0, -tex.get_height())
	s.position = Vector2(x, GROUND_Y + 2.0 + y_off)
	s.z_index = z
	world.add_child(s)
	return s


func _spot(x: float, label: String, action: Callable, radius: float = 34.0) -> Interactable:
	var it := Interactable.new()
	it.position = Vector2(x, GROUND_Y)
	it.label = label
	it.radius = radius
	it.action = action
	world.add_child(it)
	return it


func _build_village() -> void:
	_prop(GATE_TEX, GATE_X, -6)
	_spot(GATE_X + 10.0, "월드맵", open_panel.bind("map"), 40.0)
	_stall = _prop(PROPS["stall"], 250.0, -7)
	for f in Village.facilities:
		var b := _prop(f.ruined_texture, float(BUILDING_X.get(f.id, 0.0)), -8)
		_buildings[f.id] = b
		var spot := _spot(float(BUILDING_X.get(f.id, 0.0)), "살펴보기", _inspect_building.bind(f.id), 40.0)
		spot.set_meta(&"facility", f.id)
	_prop(PROPS["potion_sign"], 330.0, -7, -40.0).scale = Vector2(0.7, 0.7)
	_prop(PROPS["board"], BOARD_X, -5)
	_spot(BOARD_X, "재건 게시판", open_panel.bind("restore"))
	_prop(PROPS["banner"], 830.0, -6)
	for x in [520.0, 880.0, 1215.0, 1600.0]:
		_prop(PROPS["lamp"], x, -6)
	for x in [480.0, 1060.0, 1440.0]:
		_prop(PROPS["barrel"], x, -5)
	for x in [300.0, 905.0, 1330.0, 1690.0]:
		_prop(PROPS["bush"], x, -5)
	_plot = _prop(PLOT_TEX[0], PLOT_X, -5)
	_plot_spot = _spot(PLOT_X, "수확", _harvest)
	for r in DataDir.load_all("res://data/npcs"):
		var nd := r as NpcData
		if nd == null or not NPC_X.has(nd.id):
			continue
		var n := Npc.new()
		n.data = nd
		n.position = Vector2(float(NPC_X[nd.id]), GROUND_Y)
		n.z_index = 6
		n.action = talk_to.bind(nd.id)
		world.add_child(n)
		npcs[nd.id] = n


func _spawn_player() -> void:
	player = PLAYER_SCENE.instantiate() as Player
	player.position = Vector2(SPAWN_X, GROUND_Y)
	actors.add_child(player)
	player.kill_y = GROUND_Y + 400.0
	Pet.spawn(actors, player)
	camera = CameraRig.new()
	add_child(camera)
	camera.set_limits(Rect2(0, 0, WIDTH, 360))
	camera.target = player
	camera.snap_to_target()


func _build_ui() -> void:
	var hud_layer := CanvasLayer.new()
	hud_layer.layer = 10
	add_child(hud_layer)
	hud_layer.add_child(HUD_SCENE.instantiate())
	var ctl_layer := CanvasLayer.new()
	ctl_layer.layer = 11
	add_child(ctl_layer)
	var tc := CONTROLS_SCENE.instantiate()
	tc.set(&"hidden_actions", [&"skill", &"ultimate"])
	ctl_layer.add_child(tc)
	var overlay := CanvasLayer.new()
	overlay.layer = 20
	overlay.process_mode = Node.PROCESS_MODE_ALWAYS
	add_child(overlay)
	overlay.add_child(PAUSE_SCENE.instantiate())
	character_menu = CHARACTER_MENU_SCENE.instantiate()
	overlay.add_child(character_menu)
	dialogue = DialogueBox.new()
	overlay.add_child(dialogue)
	dialogue.closed.connect(_on_modal_closed)
	for spec in [["restore", VillagePanels.RestorePanel], ["shop", VillagePanels.ShopPanel],
			["smith", VillagePanels.SmithPanel], ["map", VillagePanels.WorldMapPanel]]:
		var p: ModalPanel = (spec[1] as GDScript).new()
		overlay.add_child(p)
		p.closed.connect(_on_modal_closed)
		panels[spec[0]] = p


# ---------------------------------------------------------------- state ---
func _refresh_village() -> void:
	for f in Village.facilities:
		var b: Sprite2D = _buildings.get(f.id)
		if b != null:
			b.texture = f.restored_texture if Village.is_restored(f.id) else f.ruined_texture
	for it in get_tree().get_nodes_in_group(&"interactables"):
		if it.has_meta(&"facility"):
			(it as Interactable).visible = not Village.is_restored(StringName(it.get_meta(&"facility")))
	for id in npcs:
		var n: Npc = npcs[id]
		n.visible = Village.is_restored(n.data.requires_facility)
	_stall.visible = Village.is_restored(&"shop")
	var farm_ok := Village.is_restored(&"farm")
	_plot.visible = farm_ok
	_plot_spot.visible = farm_ok
	_plot.texture = PLOT_TEX[0 if Village.crops <= 0 else (2 if Village.crops >= 2 else 1)]


## The first pet can be obtained here (quest reward); show it right away.
func _ensure_pet() -> void:
	if Pets.active != &"" and get_tree().get_nodes_in_group(&"pet").is_empty() and player != null:
		var p := Pet.spawn(actors, player)
		if p != null:
			p.emote(&"love")


func _on_restored(id: StringName) -> void:
	var b: Sprite2D = _buildings.get(id)
	if b != null:
		FX.spark(b.global_position + Vector2(0, -50), Color(1.0, 0.9, 0.6), true)
		FX.shake(3.0, 0.3)


func _on_modal_closed() -> void:
	SaveSystem.save_game()


func any_modal_open() -> bool:
	for n in get_tree().get_nodes_in_group(&"modal_ui"):
		if (n as CanvasItem).visible:
			return true
	return false


# --------------------------------------------------------- interaction ---
func _physics_process(_delta: float) -> void:
	if player == null:
		return
	var best: Interactable = null
	var best_d := INF
	for n in get_tree().get_nodes_in_group(&"interactables"):
		var it := n as Interactable
		if it == null or not it.can_interact():
			continue
		var d := absf(it.global_position.x - player.global_position.x)
		if d <= it.radius and d < best_d and absf(it.global_position.y - player.global_position.y) < 60.0:
			best = it
			best_d = d
	if best != target:
		if target != null and is_instance_valid(target):
			target.set_highlight(false)
		target = best
		if target != null:
			target.set_highlight(true)
		Events.interact_target_changed.emit(target)


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed(&"interact") and target != null and not any_modal_open():
		get_viewport().set_input_as_handled()
		target.interact()


func open_panel(panel_name: String) -> void:
	var p: ModalPanel = panels.get(panel_name)
	if p != null:
		p.open()


func open_menu_tab(tab: String) -> void:
	if character_menu != null:
		character_menu.call(&"open")
		character_menu.call(&"show_tab", tab)


func _inspect_building(id: StringName) -> void:
	var f := Village.facility(id)
	if f == null:
		return
	dialogue.say(f.display_name, null, PackedStringArray([
		"%s  %s" % [f.description, "복구하면: " + f.unlock_text],
		"복구 비용: %s" % Village.cost_text(f)]),
		[{"text": "재건 게시판 열기", "call": open_panel.bind("restore")}, {"text": "닫기", "call": Callable()}])


func _harvest() -> void:
	if Village.crops <= 0:
		Events.toast.emit("아직 작물이 자라지 않았어요. 스테이지를 깨고 오면 자라 있을 거예요.")
		return
	Village.harvest()
	SaveSystem.save_game()


# -------------------------------------------------------------- dialogue ---
func talk_to(npc_id: StringName) -> void:
	var n: Npc = npcs.get(npc_id)
	if n == null:
		return
	var nd := n.data
	Events.npc_talked.emit(npc_id)
	var lines: PackedStringArray = []
	if Village.meet(npc_id) and not nd.intro.is_empty():
		lines = nd.intro
	elif not nd.lines.is_empty():
		lines.append(nd.lines[randi() % nd.lines.size()])
	dialogue.say("%s  (%s)" % [nd.display_name, nd.role], nd.portrait, lines, _choices_for(nd))


func _choices_for(nd: NpcData) -> Array:
	var c: Array = []
	for q in Quests.ready_for(nd.id):
		c.append({"text": "★ 완료 보고: %s" % q.title, "call": _turn_in.bind(nd.id, q.id)})
	for q in Quests.offered_by(nd.id):
		c.append({"text": "! 퀘스트: %s" % q.title, "call": _offer.bind(nd.id, q.id)})
	match nd.id:
		&"keeper_mia":
			c.append({"text": "마을 재건 (게시판)", "call": open_panel.bind("restore")})
			if Village.is_restored(&"farm") and Village.crops > 0:
				c.append({"text": "작물 수확 (%d)" % Village.crops, "call": _harvest})
		&"guard_gareth":
			c.append({"text": "마을 밖으로 (월드맵)", "call": open_panel.bind("map")})
		&"merchant_kairo":
			c.append({"text": "상점", "call": open_panel.bind("shop")})
		&"smith_bron":
			c.append({"text": "장비 강화", "call": open_panel.bind("smith")})
		&"scholar_edel":
			var n := Codex.unclaimed_count()
			if n > 0:
				c.append({"text": "도감 보상 받기 (%d건, %dG)" % [n, n * Codex.REWARD_PER_ENTRY], "call": _claim_codex})
			c.append({"text": "도감 보기", "call": open_menu_tab.bind("도감")})
		&"witch_lyra":
			c.append({"text": "펫 돌보기", "call": open_menu_tab.bind("펫")})
		&"priest_serena":
			if not Village.blessing:
				c.append({"text": "축복 받기 (%dG)" % Village.BLESSING_COST, "call": _blessing})
			c.append({"text": "스킬 초기화 (무료)", "call": _reset_skills})
	c.append({"text": "대화 끝내기", "call": Callable()})
	return c


func _speak(npc_id: StringName, text: String, choices: Array = []) -> void:
	var n: Npc = npcs.get(npc_id)
	if n != null:
		dialogue.say("%s  (%s)" % [n.data.display_name, n.data.role], n.data.portrait, PackedStringArray([text]), choices)


func _offer(npc_id: StringName, quest_id: StringName) -> void:
	var q := Quests.quest(quest_id)
	_speak(npc_id, "%s\n보상: %s" % [q.description, q.reward_text()], [
		{"text": "수락한다", "call": _accept.bind(npc_id, quest_id)},
		{"text": "나중에", "call": Callable()}])


func _accept(npc_id: StringName, quest_id: StringName) -> void:
	Quests.accept(quest_id)
	SaveSystem.save_game()
	var q := Quests.quest(quest_id)
	_speak(npc_id, "부탁할게요. (%s)" % q.title if Quests.status(quest_id) == "active" else "벌써 다 했네요! 다시 말을 걸어 주세요.")


func _turn_in(npc_id: StringName, quest_id: StringName) -> void:
	var q := Quests.quest(quest_id)
	if Quests.turn_in(quest_id):
		SaveSystem.save_game()
		_speak(npc_id, "고마워요! 약속한 보상이에요.\n(%s)" % q.reward_text())
	else:
		_speak(npc_id, "아직 다 끝나지 않은 것 같아요.")


func _claim_codex() -> void:
	var g := Codex.claim_rewards()
	if g > 0:
		Events.toast.emit("연구 지원금 %dG" % g)
		SaveSystem.save_game()


func _blessing() -> void:
	if not Village.buy_blessing():
		Events.toast.emit("골드가 부족해요.")
	SaveSystem.save_game()


func _reset_skills() -> void:
	var n := Profile.reset_skills()
	Events.toast.emit("스킬 포인트 %d 반환" % n if n > 0 else "되돌릴 스킬이 없어요.")
	SaveSystem.save_game()
