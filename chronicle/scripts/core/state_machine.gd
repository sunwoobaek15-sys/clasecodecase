class_name StateMachine
extends RefCounted
## Small finite state machine used by the player, monsters and bosses.
##
## A state is three callables on the owner:
##   enter()                       optional, called on entry
##   update(delta) -> StringName   called every physics frame; return the name
##                                 of the next state, or &"" to stay
##   exit()                        optional, called on exit
## Keeping the states as methods of the owner keeps all behaviour of one
## character in one readable script while transitions stay explicit.

signal state_changed(from: StringName, to: StringName)

var current: StringName = &""
var previous: StringName = &""
var time_in_state: float = 0.0
var _states: Dictionary = {}


func add_state(state: StringName, update: Callable, enter: Callable = Callable(), exit: Callable = Callable()) -> void:
	_states[state] = {"update": update, "enter": enter, "exit": exit}


func has_state(state: StringName) -> bool:
	return _states.has(state)


func is_in(state: StringName) -> bool:
	return current == state


func change(to: StringName) -> void:
	if not _states.has(to):
		push_error("StateMachine: unknown state '%s'" % to)
		return
	if current != &"":
		var exit_cb: Callable = _states[current]["exit"]
		if exit_cb.is_valid():
			exit_cb.call()
	previous = current
	current = to
	time_in_state = 0.0
	var enter_cb: Callable = _states[to]["enter"]
	if enter_cb.is_valid():
		enter_cb.call()
	state_changed.emit(previous, current)


func update(delta: float) -> void:
	if current == &"":
		return
	time_in_state += delta
	var state_before := current
	var next: Variant = (_states[current]["update"] as Callable).call(delta)
	# A state may have been changed from inside update (e.g. by a hit).
	if current != state_before:
		return
	if next != null and str(next) != "" and StringName(str(next)) != current:
		change(StringName(str(next)))
