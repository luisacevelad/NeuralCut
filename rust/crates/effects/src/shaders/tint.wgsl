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
    let tint_r = uniforms.vectors[0].x;
    let tint_g = uniforms.vectors[0].y;
    let tint_b = uniforms.vectors[0].z;

    let tint_color = vec3f(tint_r, tint_g, tint_b);
    let luminance = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
    let tinted = mix(vec3f(luminance), tint_color, 0.5);
    let result = mix(color.rgb, tinted, intensity);

    return vec4f(clamp(result, vec3f(0.0), vec3f(1.0)), color.a);
}
