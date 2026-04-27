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
    let intensity = uniforms.scalars[0].x / 100.0;
    let count = max(uniforms.scalars[0].y, 1.0);

    let color = textureSample(input_texture, input_sampler, input.tex_coord);

    let line_y = input.tex_coord.y * count;
    let line = smoothstep(0.4, 0.5, fract(line_y));

    let darkness = 1.0 - line * intensity;

    return vec4f(color.rgb * darkness, color.a);
}
