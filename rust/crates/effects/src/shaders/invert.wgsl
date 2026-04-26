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
    let intensity = uniforms.scalars[0].x;

    let inverted = vec3f(1.0 - color.r, 1.0 - color.g, 1.0 - color.b);
    let result = mix(color.rgb, inverted, intensity);

    return vec4f(result, color.a);
}
