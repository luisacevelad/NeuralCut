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
    var p3 = fract(vec3f(p.x, p.y, p.x) * vec3f(0.1031, 0.1030, 0.0973));
    p3 = p3 + dot(p3, vec3f(p3.y, p3.z, p3.x) + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let intensity = uniforms.scalars[0].x / 100.0;
    let size = max(uniforms.scalars[0].y, 1.0);

    let color = textureSample(input_texture, input_sampler, input.tex_coord);

    let pixel_pos = input.tex_coord * uniforms.resolution;
    let grain_uv = floor(pixel_pos / size);
    let noise = hash21(grain_uv) * 2.0 - 1.0;

    let grain_amount = intensity * 0.3;
    let result = color.rgb + vec3f(noise * grain_amount);

    return vec4f(clamp(result, vec3f(0.0), vec3f(1.0)), color.a);
}
