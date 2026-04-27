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
    let angle = uniforms.scalars[0].y * 3.141592653589793 / 180.0;
    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;

    let dx = cos(angle) * texel_size.x;
    let dy = sin(angle) * texel_size.y;

    let color = textureSample(input_texture, input_sampler, input.tex_coord);
    let back  = textureSample(input_texture, input_sampler, input.tex_coord + vec2f(-dx, -dy));
    let front = textureSample(input_texture, input_sampler, input.tex_coord + vec2f( dx,  dy));

    let emboss = (front.rgb - back.rgb + 0.5) * intensity + color.rgb * (1.0 - intensity);

    return vec4f(clamp(emboss, vec3f(0.0), vec3f(1.0)), color.a);
}
