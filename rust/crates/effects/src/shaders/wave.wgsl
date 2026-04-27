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
    let amplitude = uniforms.scalars[0].x / 100.0;
    let frequency = uniforms.scalars[0].y;

    let wave_x = sin(input.tex_coord.y * frequency * 6.28318530718) * amplitude * 0.02;
    let wave_y = cos(input.tex_coord.x * frequency * 6.28318530718) * amplitude * 0.02;

    let distorted_uv = vec2f(
        clamp(input.tex_coord.x + wave_x, 0.0, 1.0),
        clamp(input.tex_coord.y + wave_y, 0.0, 1.0),
    );

    return textureSample(input_texture, input_sampler, distorted_uv);
}
