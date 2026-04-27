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
    let strength = uniforms.scalars[0].x / 100.0;

    let centered = input.tex_coord - vec2f(0.5);
    let r = length(centered);

    if (r < 0.001) {
        return textureSample(input_texture, input_sampler, input.tex_coord);
    }

    let normalized_r = r * 2.0;

    var distorted_r: f32;
    if (strength >= 0.0) {
        distorted_r = pow(normalized_r, 1.0 + strength * 1.5) * 0.5;
    } else {
        let abs_s = abs(strength);
        distorted_r = pow(normalized_r, 1.0 / (1.0 + abs_s * 1.5)) * 0.5;
    }

    let theta = atan2(centered.y, centered.x);
    let distorted_uv = vec2f(0.5) + vec2f(cos(theta), sin(theta)) * distorted_r;

    if (distorted_uv.x < 0.0 || distorted_uv.x > 1.0 || distorted_uv.y < 0.0 || distorted_uv.y > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    return textureSample(input_texture, input_sampler, distorted_uv);
}
