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
    let temperature = uniforms.scalars[0].x;

    let warm = vec3f(1.0, 0.85, 0.65);
    let cool = vec3f(0.65, 0.85, 1.0);
    let tint = select(
        mix(vec3f(0.0), cool, -temperature),
        mix(vec3f(0.0), warm, temperature),
        temperature >= 0.0
    );

    let result = color.rgb + tint * 0.3;

    return vec4f(clamp(result, vec3f(0.0), vec3f(1.0)), color.a);
}
