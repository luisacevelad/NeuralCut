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
    let axis = uniforms.scalars[0].x;
    let position = uniforms.scalars[0].y / 100.0;

    var uv = input.tex_coord;

    if (axis < 0.5) {
        if (uv.x > position) {
            uv.x = position - (uv.x - position);
        }
    } else {
        if (uv.y > position) {
            uv.y = position - (uv.y - position);
        }
    }

    uv = clamp(uv, vec2f(0.0), vec2f(1.0));

    return textureSample(input_texture, input_sampler, uv);
}
