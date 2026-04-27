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

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let pixel_size = max(uniforms.scalars[0].x, 1.0);
    let aspect = uniforms.resolution.x / uniforms.resolution.y;

    let cell_x = pixel_size / uniforms.resolution.x;
    let cell_y = pixel_size / uniforms.resolution.y;

    let snapped_x = floor(input.tex_coord.x / cell_x) * cell_x + cell_x * 0.5;
    let snapped_y = floor(input.tex_coord.y / cell_y) * cell_y + cell_y * 0.5;

    let snapped_uv = vec2f(clamp(snapped_x, 0.0, 1.0), clamp(snapped_y, 0.0, 1.0));

    return textureSample(input_texture, input_sampler, snapped_uv);
}
