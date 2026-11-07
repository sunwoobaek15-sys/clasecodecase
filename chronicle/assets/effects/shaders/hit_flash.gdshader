shader_type canvas_item;
// Hit flash / tint for pixel sprites. flash_amount mixes the sprite towards
// flash_color while keeping its alpha (silhouette), so the hit reads clearly
// without changing the pixel grid.

uniform vec4 flash_color : source_color = vec4(1.0, 1.0, 1.0, 1.0);
uniform float flash_amount : hint_range(0.0, 1.0) = 0.0;

void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	c.rgb = mix(c.rgb, flash_color.rgb, flash_amount);
	COLOR = c;
}
