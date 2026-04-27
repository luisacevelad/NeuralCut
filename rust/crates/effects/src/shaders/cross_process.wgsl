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
    let intensity = uniforms.scalars[0].x / 100.0;

    let r = min(color.r * 1.2 + 0.05, 1.0);
    let g = max(color.g * 0.8 - 0.02, 0.0);
    let b = min(color.b * 1.4 + 0.1, 1.0);

    let contrast_r = (r - 0.5) * 1.2 + 0.5;
    let contrast_g = (g - 0.5) * 1.1 + 0.5;
    let contrast_b = (b - 0.5) * 1.3 + 0.5;

    let cross = vec3f(clamp(contrast_r, 0.0, 1.0), clamp(contrast_g, 0.0, 1.0), clamp(contrast_b, 0.0, 1.0));
    let result = mix(color.rgb, cross, intensity);

    return vec4f(result, color.a);
}
