use std::collections::HashMap;

use bytemuck::{Pod, Zeroable};
use gpu::{FULLSCREEN_SHADER_SOURCE, GpuContext};
use thiserror::Error;
use wgpu::util::DeviceExt;

use crate::{EffectPass, UniformValue};

type UniformPacker = fn(&EffectPass, u32, u32) -> Result<GenericUniformBuffer, EffectsError>;

const SHADER_REGISTRY: &[(&str, &str, UniformPacker)] = &[
    (
        "gaussian-blur",
        include_str!("shaders/gaussian_blur.wgsl"),
        pack_gaussian_blur as UniformPacker,
    ),
    (
        "brightness-contrast",
        include_str!("shaders/brightness_contrast.wgsl"),
        pack_brightness_contrast as UniformPacker,
    ),
    (
        "grayscale",
        include_str!("shaders/grayscale.wgsl"),
        pack_grayscale as UniformPacker,
    ),
    (
        "saturation",
        include_str!("shaders/saturation.wgsl"),
        pack_saturation as UniformPacker,
    ),
    (
        "sepia",
        include_str!("shaders/sepia.wgsl"),
        pack_sepia as UniformPacker,
    ),
    (
        "invert",
        include_str!("shaders/invert.wgsl"),
        pack_invert as UniformPacker,
    ),
    (
        "vignette",
        include_str!("shaders/vignette.wgsl"),
        pack_vignette as UniformPacker,
    ),
    (
        "hue-rotate",
        include_str!("shaders/hue_rotate.wgsl"),
        pack_hue_rotate as UniformPacker,
    ),
    (
        "color-temperature",
        include_str!("shaders/color_temperature.wgsl"),
        pack_color_temperature as UniformPacker,
    ),
    (
        "tint",
        include_str!("shaders/tint.wgsl"),
        pack_tint as UniformPacker,
    ),
    (
        "posterize",
        include_str!("shaders/posterize.wgsl"),
        pack_posterize as UniformPacker,
    ),
    (
        "duotone",
        include_str!("shaders/duotone.wgsl"),
        pack_duotone as UniformPacker,
    ),
    (
        "cross-process",
        include_str!("shaders/cross_process.wgsl"),
        pack_cross_process as UniformPacker,
    ),
    (
        "pixelate",
        include_str!("shaders/pixelate.wgsl"),
        pack_pixelate as UniformPacker,
    ),
    (
        "chromatic-aberration",
        include_str!("shaders/chromatic_aberration.wgsl"),
        pack_chromatic_aberration as UniformPacker,
    ),
    (
        "glitch",
        include_str!("shaders/glitch.wgsl"),
        pack_glitch as UniformPacker,
    ),
    (
        "wave",
        include_str!("shaders/wave.wgsl"),
        pack_wave as UniformPacker,
    ),
    (
        "mirror",
        include_str!("shaders/mirror.wgsl"),
        pack_mirror as UniformPacker,
    ),
    (
        "kaleidoscope",
        include_str!("shaders/kaleidoscope.wgsl"),
        pack_kaleidoscope as UniformPacker,
    ),
    (
        "fisheye",
        include_str!("shaders/fisheye.wgsl"),
        pack_fisheye as UniformPacker,
    ),
    (
        "sharpen",
        include_str!("shaders/sharpen.wgsl"),
        pack_sharpen as UniformPacker,
    ),
    (
        "glow",
        include_str!("shaders/glow.wgsl"),
        pack_glow as UniformPacker,
    ),
    (
        "exposure",
        include_str!("shaders/exposure.wgsl"),
        pack_exposure as UniformPacker,
    ),
    (
        "shadows-highlights",
        include_str!("shaders/shadows_highlights.wgsl"),
        pack_shadows_highlights as UniformPacker,
    ),
    (
        "edge-detection",
        include_str!("shaders/edge_detection.wgsl"),
        pack_edge_detection as UniformPacker,
    ),
    (
        "emboss",
        include_str!("shaders/emboss.wgsl"),
        pack_emboss as UniformPacker,
    ),
    (
        "film-grain",
        include_str!("shaders/film_grain.wgsl"),
        pack_film_grain as UniformPacker,
    ),
    (
        "halftone",
        include_str!("shaders/halftone.wgsl"),
        pack_halftone as UniformPacker,
    ),
    (
        "scanlines",
        include_str!("shaders/scanlines.wgsl"),
        pack_scanlines as UniformPacker,
    ),
    (
        "color-key",
        include_str!("shaders/color_key.wgsl"),
        pack_color_key as UniformPacker,
    ),
];

pub struct ApplyEffectsOptions<'a> {
    pub source: &'a wgpu::Texture,
    pub width: u32,
    pub height: u32,
    pub passes: &'a [EffectPass],
}

pub struct EffectPipeline {
    uniform_bind_group_layout: wgpu::BindGroupLayout,
    pipelines: HashMap<String, wgpu::RenderPipeline>,
}

#[derive(Debug, Error)]
pub enum EffectsError {
    #[error("At least one effect pass is required")]
    MissingEffectPasses,
    #[error("Unknown effect shader '{shader}'")]
    UnknownEffectShader { shader: String },
    #[error("Missing uniform '{uniform}' for shader '{shader}'")]
    MissingUniform { shader: String, uniform: String },
    #[error("Uniform '{uniform}' for shader '{shader}' must be a number")]
    InvalidNumberUniform { shader: String, uniform: String },
    #[error(
        "Uniform '{uniform}' for shader '{shader}' must be a vector of length {expected_length}"
    )]
    InvalidVectorUniform {
        shader: String,
        uniform: String,
        expected_length: usize,
    },
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct GenericUniformBuffer {
    resolution: [f32; 2],
    _pad_res: [f32; 2],
    scalars: [[f32; 4]; 2],
    vectors: [[f32; 4]; 2],
}

impl Default for GenericUniformBuffer {
    fn default() -> Self {
        Self {
            resolution: [0.0, 0.0],
            _pad_res: [0.0, 0.0],
            scalars: [[0.0; 4]; 2],
            vectors: [[0.0; 4]; 2],
        }
    }
}

impl EffectPipeline {
    pub fn new(context: &GpuContext) -> Self {
        let uniform_bind_group_layout =
            context
                .device()
                .create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
                    label: Some("effects-uniform-bind-group-layout"),
                    entries: &[wgpu::BindGroupLayoutEntry {
                        binding: 0,
                        visibility: wgpu::ShaderStages::FRAGMENT,
                        ty: wgpu::BindingType::Buffer {
                            ty: wgpu::BufferBindingType::Uniform,
                            has_dynamic_offset: false,
                            min_binding_size: None,
                        },
                        count: None,
                    }],
                });

        let vertex_shader_module =
            context
                .device()
                .create_shader_module(wgpu::ShaderModuleDescriptor {
                    label: Some("effects-fullscreen-shader"),
                    source: wgpu::ShaderSource::Wgsl(FULLSCREEN_SHADER_SOURCE.into()),
                });

        let pipeline_layout =
            context
                .device()
                .create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                    label: Some("effects-pipeline-layout"),
                    bind_group_layouts: &[
                        Some(context.texture_sampler_bind_group_layout()),
                        Some(&uniform_bind_group_layout),
                    ],
                    immediate_size: 0,
                });

        let mut pipelines = HashMap::new();
        for (id, source, _packer) in SHADER_REGISTRY {
            let shader_module =
                context
                    .device()
                    .create_shader_module(wgpu::ShaderModuleDescriptor {
                        label: Some(&format!("effects-{id}-shader")),
                        source: wgpu::ShaderSource::Wgsl((*source).into()),
                    });
            let pipeline =
                context
                    .device()
                    .create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                        label: Some(&format!("effects-{id}-pipeline")),
                        layout: Some(&pipeline_layout),
                        vertex: wgpu::VertexState {
                            module: &vertex_shader_module,
                            entry_point: Some("vertex_main"),
                            buffers: &[wgpu::VertexBufferLayout {
                                array_stride: std::mem::size_of::<[f32; 2]>() as u64,
                                step_mode: wgpu::VertexStepMode::Vertex,
                                attributes: &[wgpu::VertexAttribute {
                                    format: wgpu::VertexFormat::Float32x2,
                                    offset: 0,
                                    shader_location: 0,
                                }],
                            }],
                            compilation_options: wgpu::PipelineCompilationOptions::default(),
                        },
                        fragment: Some(wgpu::FragmentState {
                            module: &shader_module,
                            entry_point: Some("fragment_main"),
                            targets: &[Some(wgpu::ColorTargetState {
                                format: context.texture_format(),
                                blend: None,
                                write_mask: wgpu::ColorWrites::ALL,
                            })],
                            compilation_options: wgpu::PipelineCompilationOptions::default(),
                        }),
                        primitive: wgpu::PrimitiveState::default(),
                        depth_stencil: None,
                        multisample: wgpu::MultisampleState::default(),
                        multiview_mask: None,
                        cache: None,
                    });
            pipelines.insert(id.to_string(), pipeline);
        }

        Self {
            uniform_bind_group_layout,
            pipelines,
        }
    }

    pub fn apply(
        &self,
        context: &GpuContext,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut encoder =
            context
                .device()
                .create_command_encoder(&wgpu::CommandEncoderDescriptor {
                    label: Some("effects-command-encoder"),
                });
        let output = self.apply_with_encoder(
            context,
            &mut encoder,
            ApplyEffectsOptions {
                source,
                width,
                height,
                passes,
            },
        )?;
        context.queue().submit([encoder.finish()]);
        Ok(output)
    }

    pub fn apply_with_encoder(
        &self,
        context: &GpuContext,
        encoder: &mut wgpu::CommandEncoder,
        ApplyEffectsOptions {
            source,
            width,
            height,
            passes,
        }: ApplyEffectsOptions<'_>,
    ) -> Result<wgpu::Texture, EffectsError> {
        let mut current_texture: Option<wgpu::Texture> = None;

        for pass in passes {
            let input_texture = current_texture.as_ref().unwrap_or(source);
            let output_texture =
                context.create_render_texture(width, height, "effects-pass-output");
            let input_view = input_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let output_view = output_texture.create_view(&wgpu::TextureViewDescriptor::default());
            let texture_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-texture-bind-group"),
                        layout: context.texture_sampler_bind_group_layout(),
                        entries: &[
                            wgpu::BindGroupEntry {
                                binding: 0,
                                resource: wgpu::BindingResource::TextureView(&input_view),
                            },
                            wgpu::BindGroupEntry {
                                binding: 1,
                                resource: wgpu::BindingResource::Sampler(context.linear_sampler()),
                            },
                        ],
                    });

            let packed = pack_uniforms_for_shader(pass, width, height)?;
            let uniform_buffer =
                context
                    .device()
                    .create_buffer_init(&wgpu::util::BufferInitDescriptor {
                        label: Some("effects-uniform-buffer"),
                        contents: bytemuck::bytes_of(&packed),
                        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
                    });
            let uniform_bind_group =
                context
                    .device()
                    .create_bind_group(&wgpu::BindGroupDescriptor {
                        label: Some("effects-uniform-bind-group"),
                        layout: &self.uniform_bind_group_layout,
                        entries: &[wgpu::BindGroupEntry {
                            binding: 0,
                            resource: uniform_buffer.as_entire_binding(),
                        }],
                    });
            let pipeline = self.pipelines.get(&pass.shader).ok_or_else(|| {
                EffectsError::UnknownEffectShader {
                    shader: pass.shader.clone(),
                }
            })?;

            {
                let mut render_pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
                    label: Some("effects-render-pass"),
                    color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                        view: &output_view,
                        resolve_target: None,
                        depth_slice: None,
                        ops: wgpu::Operations {
                            load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                            store: wgpu::StoreOp::Store,
                        },
                    })],
                    depth_stencil_attachment: None,
                    occlusion_query_set: None,
                    timestamp_writes: None,
                    multiview_mask: None,
                });
                render_pass.set_pipeline(pipeline);
                render_pass.set_vertex_buffer(0, context.fullscreen_quad().slice(..));
                render_pass.set_bind_group(0, &texture_bind_group, &[]);
                render_pass.set_bind_group(1, &uniform_bind_group, &[]);
                render_pass.draw(0..6, 0..1);
            }

            current_texture = Some(output_texture);
        }

        current_texture.ok_or(EffectsError::MissingEffectPasses)
    }
}

fn pack_uniforms_for_shader(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    for (id, _source, packer) in SHADER_REGISTRY {
        if pass.shader == *id {
            return packer(pass, width, height);
        }
    }
    Err(EffectsError::UnknownEffectShader {
        shader: pass.shader.clone(),
    })
}

fn read_number_uniform(pass: &EffectPass, uniform: &str) -> Result<f32, EffectsError> {
    let Some(value) = pass.uniforms.get(uniform) else {
        return Err(EffectsError::MissingUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        });
    };
    match value {
        UniformValue::Number(value) => Ok(*value),
        UniformValue::Vector(_) => Err(EffectsError::InvalidNumberUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        }),
    }
}

fn read_number_uniform_or(pass: &EffectPass, uniform: &str, default: f32) -> f32 {
    pass.uniforms
        .get(uniform)
        .and_then(|v| match v {
            UniformValue::Number(n) => Some(*n),
            _ => None,
        })
        .unwrap_or(default)
}

fn read_vec2_uniform(pass: &EffectPass, uniform: &str) -> Result<[f32; 2], EffectsError> {
    let Some(value) = pass.uniforms.get(uniform) else {
        return Err(EffectsError::MissingUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        });
    };
    let UniformValue::Vector(values) = value else {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 2,
        });
    };
    if values.len() != 2 {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 2,
        });
    }
    Ok([values[0], values[1]])
}

fn read_vec3_uniform(pass: &EffectPass, uniform: &str) -> Result<[f32; 3], EffectsError> {
    let Some(value) = pass.uniforms.get(uniform) else {
        return Err(EffectsError::MissingUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
        });
    };
    let UniformValue::Vector(values) = value else {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 3,
        });
    };
    if values.len() != 3 {
        return Err(EffectsError::InvalidVectorUniform {
            shader: pass.shader.clone(),
            uniform: uniform.to_string(),
            expected_length: 3,
        });
    }
    Ok([values[0], values[1], values[2]])
}

fn pack_gaussian_blur(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let sigma = read_number_uniform(pass, "u_sigma")?;
    let step = read_number_uniform(pass, "u_step")?;
    let direction = read_vec2_uniform(pass, "u_direction")?;

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = sigma;
    buf.scalars[0][1] = step;
    buf.vectors[0][0] = direction[0];
    buf.vectors[0][1] = direction[1];
    Ok(buf)
}

fn pack_brightness_contrast(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let brightness = read_number_uniform_or(pass, "u_brightness", 0.0);
    let contrast = read_number_uniform_or(pass, "u_contrast", 1.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = brightness;
    buf.scalars[0][1] = contrast;
    Ok(buf)
}

fn pack_grayscale(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 1.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    Ok(buf)
}

fn pack_saturation(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let saturation = read_number_uniform_or(pass, "u_saturation", 1.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = saturation;
    Ok(buf)
}

fn pack_sepia(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 1.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    Ok(buf)
}

fn pack_invert(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 1.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    Ok(buf)
}

fn pack_vignette(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let radius = read_number_uniform_or(pass, "u_radius", 0.75);
    let softness = read_number_uniform_or(pass, "u_softness", 0.35);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = radius;
    buf.scalars[0][1] = softness;
    Ok(buf)
}

fn pack_hue_rotate(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let angle = read_number_uniform_or(pass, "u_angle", 0.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = angle;
    Ok(buf)
}

fn pack_color_temperature(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let temperature = read_number_uniform_or(pass, "u_temperature", 0.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = temperature;
    Ok(buf)
}

fn pack_tint(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 50.0);
    let tint_color = read_vec3_uniform(pass, "u_tint_color")?;

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.vectors[0][0] = tint_color[0];
    buf.vectors[0][1] = tint_color[1];
    buf.vectors[0][2] = tint_color[2];
    Ok(buf)
}

fn pack_posterize(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let levels = read_number_uniform_or(pass, "u_levels", 8.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = levels;
    Ok(buf)
}

fn pack_duotone(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 100.0);
    let shadow_color = read_vec3_uniform(pass, "u_shadow_color")?;
    let highlight_color = read_vec3_uniform(pass, "u_highlight_color")?;

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.vectors[0][0] = shadow_color[0];
    buf.vectors[0][1] = shadow_color[1];
    buf.vectors[0][2] = shadow_color[2];
    buf.vectors[1][0] = highlight_color[0];
    buf.vectors[1][1] = highlight_color[1];
    buf.vectors[1][2] = highlight_color[2];
    Ok(buf)
}

fn pack_cross_process(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 100.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    Ok(buf)
}

fn pack_pixelate(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let size = read_number_uniform_or(pass, "u_size", 10.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = size;
    Ok(buf)
}

fn pack_chromatic_aberration(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let offset = read_number_uniform_or(pass, "u_offset", 15.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = offset;
    Ok(buf)
}

fn pack_glitch(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 50.0);
    let block_size = read_number_uniform_or(pass, "u_block_size", 20.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.scalars[0][1] = block_size;
    Ok(buf)
}

fn pack_wave(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let amplitude = read_number_uniform_or(pass, "u_amplitude", 30.0);
    let frequency = read_number_uniform_or(pass, "u_frequency", 5.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = amplitude;
    buf.scalars[0][1] = frequency;
    Ok(buf)
}

fn pack_mirror(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let axis = read_number_uniform_or(pass, "u_axis", 0.0);
    let position = read_number_uniform_or(pass, "u_position", 50.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = axis;
    buf.scalars[0][1] = position;
    Ok(buf)
}

fn pack_kaleidoscope(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let segments = read_number_uniform_or(pass, "u_segments", 6.0);
    let angle = read_number_uniform_or(pass, "u_angle", 0.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = segments;
    buf.scalars[0][1] = angle;
    Ok(buf)
}

fn pack_fisheye(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let strength = read_number_uniform_or(pass, "u_strength", 50.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = strength;
    Ok(buf)
}

fn pack_sharpen(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 50.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    Ok(buf)
}

fn pack_glow(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 50.0);
    let threshold = read_number_uniform_or(pass, "u_threshold", 70.0);
    let radius = read_number_uniform_or(pass, "u_radius", 4.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.scalars[0][1] = threshold;
    buf.scalars[1][0] = radius;
    Ok(buf)
}

fn pack_exposure(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let exposure = read_number_uniform_or(pass, "u_exposure", 0.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = exposure;
    Ok(buf)
}

fn pack_shadows_highlights(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let shadows = read_number_uniform_or(pass, "u_shadows", 0.0);
    let highlights = read_number_uniform_or(pass, "u_highlights", 0.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = shadows;
    buf.scalars[0][1] = highlights;
    Ok(buf)
}

fn pack_edge_detection(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 100.0);
    let threshold = read_number_uniform_or(pass, "u_threshold", 10.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.scalars[0][1] = threshold;
    Ok(buf)
}

fn pack_emboss(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 50.0);
    let angle = read_number_uniform_or(pass, "u_angle", 135.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.scalars[0][1] = angle;
    Ok(buf)
}

fn pack_film_grain(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 30.0);
    let size = read_number_uniform_or(pass, "u_size", 1.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.scalars[0][1] = size;
    Ok(buf)
}

fn pack_halftone(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let dot_size = read_number_uniform_or(pass, "u_dot_size", 4.0);
    let angle = read_number_uniform_or(pass, "u_angle", 45.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = dot_size;
    buf.scalars[0][1] = angle;
    Ok(buf)
}

fn pack_scanlines(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let intensity = read_number_uniform_or(pass, "u_intensity", 30.0);
    let count = read_number_uniform_or(pass, "u_count", 240.0);

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = intensity;
    buf.scalars[0][1] = count;
    Ok(buf)
}

fn pack_color_key(
    pass: &EffectPass,
    width: u32,
    height: u32,
) -> Result<GenericUniformBuffer, EffectsError> {
    let tolerance = read_number_uniform_or(pass, "u_tolerance", 40.0);
    let softness = read_number_uniform_or(pass, "u_softness", 10.0);
    let key_color = read_vec3_uniform(pass, "u_key_color")?;

    let mut buf = GenericUniformBuffer::default();
    buf.resolution = [width as f32, height as f32];
    buf.scalars[0][0] = tolerance;
    buf.scalars[0][1] = softness;
    buf.vectors[0][0] = key_color[0];
    buf.vectors[0][1] = key_color[1];
    buf.vectors[0][2] = key_color[2];
    Ok(buf)
}
