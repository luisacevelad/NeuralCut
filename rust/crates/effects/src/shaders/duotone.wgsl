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

    let shadow = vec3f(uniforms.vectors[0].x, uniforms.vectors[0].y, uniforms.vectors[0].z);
    let highlight = vec3f(uniforms.vectors[1].x, uniforms.vectors[1].y, uniforms.vectors[1].z);

    let luminance = dot(color.rgb, vec3f(0.2126, 0.7152, 0.0722));
    let duotone = mix(shadow, highlight, luminance);
    let result = mix(color.rgb, duotone, intensity);

    return vec4f(clamp(result, vec3f(0.0), vec3f(1.0)), color.a);
}
