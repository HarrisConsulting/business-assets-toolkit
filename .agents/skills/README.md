# Agent Skills

This directory contains custom agent skills used to extend Codex and other AI coding agents with reusable, on-demand workflows.

## Creating New Skills

For guidance on creating and structuring new skills, refer to the official quickstart guide:

📖 [Agent Skills Quickstart](https://agentskills.io/skill-creation/quickstart)

## Structure

Each skill lives in its own subdirectory and requires a `SKILL.md` file with a YAML frontmatter block (`name` and `description`) followed by the skill's Markdown instructions:

```text
.agents/
└── skills/
    └── your-skill-name/
        └── SKILL.md
```

## Available Skills

| Skill | Description |
|-------|-------------|
| [regression-guard](./regression-guard/SKILL.md) | Enforces Git branch isolation and Jest testing protocols to prevent regressions during autonomous coding tasks. |
