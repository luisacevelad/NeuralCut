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

fn luminance(color: vec3f) -> f32 {
    return dot(color, vec3f(0.2126, 0.7152, 0.0722));
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let intensity = uniforms.scalars[0].x / 100.0;
    let threshold = uniforms.scalars[0].y / 100.0;
    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;

    let tl = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f(-texel_size.x, -texel_size.y)).rgb);
    let t  = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f( 0.0,           -texel_size.y)).rgb);
    let tr = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f( texel_size.x,  -texel_size.y)).rgb);
    let l  = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f(-texel_size.x,   0.0)).rgb);
    let r  = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f( texel_size.x,   0.0)).rgb);
    let bl = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f(-texel_size.x,   texel_size.y)).rgb);
    let b  = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f( 0.0,            texel_size.y)).rgb);
    let br = luminance(textureSample(input_texture, input_sampler, input.tex_coord + vec2f( texel_size.x,   texel_size.y)).rgb);

    let gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
    let gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;

    let edge = sqrt(gx * gx + gy * gy);

    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let edge_mask = smoothstep(threshold, threshold + 0.1, edge);

    let result = mix(color.rgb, vec3f(edge_mask), intensity);

    return vec4f(result, color.a);
}
