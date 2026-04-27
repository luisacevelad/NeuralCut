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
    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let tolerance = uniforms.scalars[0].x / 100.0;
    let softness = uniforms.scalars[0].y / 100.0;
    let key_color = uniforms.vectors[0].xyz;

    let diff = distance(color.rgb, key_color);

    let edge = softness + 0.001;
    let alpha = 1.0 - smoothstep(tolerance - edge, tolerance + edge, diff);

    return vec4f(color.rgb, color.a * alpha);
}
