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
    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;

    let center = textureSample(input_texture, input_sampler, input.tex_coord);
    let top    = textureSample(input_texture, input_sampler, input.tex_coord + vec2f(0.0, -texel_size.y));
    let bottom = textureSample(input_texture, input_sampler, input.tex_coord + vec2f(0.0,  texel_size.y));
    let left   = textureSample(input_texture, input_sampler, input.tex_coord + vec2f(-texel_size.x, 0.0));
    let right  = textureSample(input_texture, input_sampler, input.tex_coord + vec2f( texel_size.x, 0.0));

    let neighbors = top.rgb + bottom.rgb + left.rgb + right.rgb;
    let sharpened = center.rgb * 5.0 - neighbors;

    let result = mix(center.rgb, sharpened, intensity);

    return vec4f(clamp(result, vec3f(0.0), vec3f(1.0)), center.a);
}
