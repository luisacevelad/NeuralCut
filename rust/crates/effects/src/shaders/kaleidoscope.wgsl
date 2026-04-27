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

const PI: f32 = 3.141592653589793;

@fragment
fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
    let segments = max(uniforms.scalars[0].x, 2.0);
    let angle_offset = uniforms.scalars[0].y * PI / 180.0;

    let centered = input.tex_coord - vec2f(0.5);
    let r = length(centered);
    var theta = atan2(centered.y, centered.x) + angle_offset;

    let segment_angle = 2.0 * PI / segments;
    theta = abs(mod(theta, segment_angle) - segment_angle * 0.5);

    let uv = vec2f(0.5) + vec2f(cos(theta), sin(theta)) * r;

    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    return textureSample(input_texture, input_sampler, uv);
}
