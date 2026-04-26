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

    let r = min(color.r * 0.393 + color.g * 0.769 + color.b * 0.189, 1.0);
    let g = min(color.r * 0.349 + color.g * 0.686 + color.b * 0.168, 1.0);
    let b = min(color.r * 0.272 + color.g * 0.534 + color.b * 0.131, 1.0);

    let sepia = vec3f(r, g, b);
    let result = mix(color.rgb, sepia, intensity);

    return vec4f(result, color.a);
}
