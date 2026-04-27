struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) tex_coord: vec2f,
}

struct EffectUniforms {
    resolution: vec2f,
    _pad_res: vec2f,
    scalars: array<vec4f, 2>,
    vectors: array<vec4f, 2>,
}

@group(0) @binding(0) var input_texture: texture_2d<f32>;
@group(0) @binding(1) var input_sampler: sampler;
@group(1) @binding(0) var<uniform> uniforms: EffectUniforms;

const PI: f32 = 3.141592653589793;

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let dot_size = max(uniforms.scalars[0].x, 1.0);
    let angle = uniforms.scalars[0].y * PI / 180.0;

    let aspect = uniforms.resolution.x / uniforms.resolution.y;
    let grid_uv = vec2f(
        input.tex_coord.x * aspect,
        input.tex_coord.y,
    );

    let rotated_x = grid_uv.x * cos(angle) - grid_uv.y * sin(angle);
    let rotated_y = grid_uv.x * sin(angle) + grid_uv.y * cos(angle);

    let grid_spacing = dot_size * 2.0 / uniforms.resolution.y;
    let cell = vec2f(
        floor(rotated_x / grid_spacing),
        floor(rotated_y / grid_spacing),
    );

    let cell_center = (cell + vec2f(0.5)) * grid_spacing;

    let inv_cos = cos(-angle);
    let inv_sin = sin(-angle);
    let sample_uv = vec2f(
        cell_center.x * inv_cos - cell_center.y * inv_sin,
        cell_center.x * inv_sin + cell_center.y * inv_cos,
    );

    let sample_coord = vec2f(sample_uv.x / aspect, sample_uv.y);

    if (sample_coord.x < 0.0 || sample_coord.x > 1.0 || sample_coord.y < 0.0 || sample_coord.y > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    let color = textureSample(input_texture, input_sampler, sample_coord);
    let luminance = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));

    let dist = length(vec2f(rotated_x, rotated_y) - cell_center);
    let max_radius = grid_spacing * 0.5;
    let dot_radius = max_radius * (1.0 - luminance);

    let mask = 1.0 - smoothstep(dot_radius - 0.5, dot_radius + 0.5, dist);

    return vec4f(color.rgb * mask, color.a);
}
