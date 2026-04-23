# Proposal: Infra Habilitadora — Fase 1

## Intent

Habilitar el primer slice implementable del agente conversacional dentro del editor, validando la frontera UI → proxy API → orquestador cliente → herramienta mock sin introducir todavía lógica pesada ni suite real de tools.

## Scope

### In Scope
- Integrar un chat panel mínimo en el slot derecho del editor, compartido con Properties.
- Crear el entrypoint del agente, el proxy `/api/agent/chat`, stores de chat/agente y contratos base.
- Montar un orquestador cliente shell, tool registry shell y wiring de contexto activo de video/media.
- Entregar un único flujo end-to-end mock con una sola tool mock.

### Out of Scope
- LLM real, streaming, múltiples tools, ejecución real de edición, backend complejo.
- Mover lógica de negocio a Rust o resolver arquitectura final de herramientas futuras.

## Capabilities

### New Capabilities
- `editor-chat-panel`: panel de chat embebido en el editor con envío, historial y estados básicos.
- `agent-session-shell`: frontera mínima entre UI, proxy API, stores y orquestador cliente.
- `agent-context-bridge`: contratos y adapter para exponer media/video activo al agente.

### Modified Capabilities
- None.

## Approach

Seguir un thin vertical slice: UI funcional, proxy API sin lógica de negocio, orquestador ejecutado en cliente y una tool mock registrada con `DefinitionRegistry`. El agente en `apps/web/src/agent/` queda limitado a I/O y coordinación; cualquier lógica pesada futura sigue en `rust/`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `apps/web/src/app/editor/[project_id]/page.tsx` | Modified | Integra tab Chat/Properties |
| `apps/web/src/components/editor/panels/chat/` | New | UI mínima del chat |
| `apps/web/src/stores/chatStore.ts` | New | Mensajes, loading, error |
| `apps/web/src/stores/agentStore.ts` | New | Estado de ejecución y contexto |
| `apps/web/src/app/api/agent/chat/route.ts` | New | Proxy boundary |
| `apps/web/src/agent/` | New | Tipos, orquestador, prompts, tool registry |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deriva de lógica fuera de `rust/` | Med | Limitar `agent/` a orquestación y contratos |
| Acoplamiento con `EditorCore` | Med | Usar adapter de contexto mínimo |
| Scope creep | High | Mantener una sola tool mock |

## Rollback Plan

Revertir la integración del tab Chat, eliminar `apps/web/src/agent/`, stores y ruta API nueva, dejando intacto el panel derecho actual y sin tocar flujos de edición existentes.

## Dependencies

- `EditorCore` (`project`, `media`, `scenes`) como fuente de contexto.
- `DefinitionRegistry` existente para el registro de tools.
- Rutas App Router de Next.js para el proxy.

## Success Criteria

- [ ] El editor muestra un panel Chat funcional sin romper el layout actual.
- [ ] Un mensaje del usuario recorre UI → API proxy → orquestador cliente → tool mock → respuesta visible.
- [ ] Los contratos base permiten agregar tools reales sin rediseñar stores ni frontera API.
