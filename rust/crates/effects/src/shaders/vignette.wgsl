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
    let radius = uniforms.scalars[0].x;
    let softness = uniforms.scalars[0].y;

    let center = input.tex_coord - vec2f(0.5);
    let dist = length(center);

    let edge = smoothstep(radius, radius - softness, dist);

    return vec4f(color.rgb * edge, color.a);
}
