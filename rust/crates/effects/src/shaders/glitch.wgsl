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

fn hash21(p: vec2f) -> f32 {
    var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
    p3 = p3 + dot(p3, vec3f(p3.y, p3.z, p3.x) + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let intensity = uniforms.scalars[0].x / 100.0;
    let block_size = max(uniforms.scalars[0].y, 1.0);

    let block_uv = floor(input.tex_coord * (uniforms.resolution / block_size));
    let block_hash = hash21(block_uv);

    var uv = input.tex_coord;

    let shift_threshold = 1.0 - intensity * 0.8;
    if (block_hash > shift_threshold) {
        let shift = (hash21(block_uv + vec2f(42.0, 0.0)) - 0.5) * intensity * 0.15;
        uv = vec2f(uv.x + shift, uv.y);
    }

    let rgb_shift = intensity * 0.008;
    let r = textureSample(input_texture, input_sampler, vec2f(uv.x + rgb_shift, uv.y)).r;
    let g = textureSample(input_texture, input_sampler, uv).g;
    let b = textureSample(input_texture, input_sampler, vec2f(uv.x - rgb_shift, uv.y)).b;
    let a = textureSample(input_texture, input_sampler, uv).a;

    return vec4f(r, g, b, a);
}
