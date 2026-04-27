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
    let texel_size = vec2f(1.0, 1.0) / uniforms.resolution;
    let intensity = uniforms.scalars[0].x / 100.0;
    let threshold = uniforms.scalars[0].y / 100.0;
    let radius = uniforms.scalars[1].x;

    let center = textureSample(input_texture, input_sampler, input.tex_coord);
    let luminance = dot(center.rgb, vec3f(0.2126, 0.7152, 0.0722));

    if (luminance < threshold) {
        return center;
    }

    let samples = 16.0;
    var bloom = vec3f(0.0);
    let step = radius / samples;

    for (var i = -samples; i <= samples; i = i + 1.0) {
        for (var j = -samples; j <= samples; j = j + 1.0) {
            let offset = vec2f(i, j) * step * texel_size;
            let sample_color = textureSample(input_texture, input_sampler, input.tex_coord + offset);
            let sample_lum = dot(sample_color.rgb, vec3f(0.2126, 0.7152, 0.0722));
            if (sample_lum >= threshold) {
                bloom = bloom + sample_color.rgb;
            }
        }
    }

    let total = (samples * 2.0 + 1.0) * (samples * 2.0 + 1.0);
    bloom = bloom / total;

    let result = mix(center.rgb, center.rgb + bloom * intensity, intensity);

    return vec4f(clamp(result, vec3f(0.0), vec3f(1.0)), center.a);
}
