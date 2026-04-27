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
    let offset = uniforms.scalars[0].x / 100.0;
    let direction = normalize(input.tex_coord - vec2f(0.5));
    let displacement = direction * offset * 0.02;

    let r = textureSample(input_texture, input_sampler, input.tex_coord + displacement).r;
    let g = textureSample(input_texture, input_sampler, input.tex_coord).g;
    let b = textureSample(input_texture, input_sampler, input.tex_coord - displacement).b;
    let a = textureSample(input_texture, input_sampler, input.tex_coord).a;

    return vec4f(r, g, b, a);
}
