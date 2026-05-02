/**
 * Client-only barrel for agent skills. Importing this file registers every
 * built-in skill with `skillRegistry` via side effects.
 *
 * To add a new skill: create a `*.skill.ts` file in builtin/, then add
 * a single side-effect import below.
 */

import "@/agent/skills/builtin/viral-short.skill";
import "@/agent/skills/builtin/pitch-video.skill";
import "@/agent/skills/builtin/remove-silences.skill";
import "@/agent/skills/builtin/talking-head.skill";
import "@/agent/skills/builtin/short-form.skill";
import "@/agent/skills/builtin/b-roll-narrative.skill";
import "@/agent/skills/builtin/corporate.skill";
