from pathlib import Path
import json
import time

SKILLS_DIR = Path.home() / ".local" / "share" / "pollenforge" / "skills"

TOOLS = [
    {
        "name": "save_skill",
        "description": "Save a workflow as a reusable Skill",
        "params": {"name": "Skill name", "description": "What this skill does", "steps": "JSON array of steps to execute", "tags": "Comma-separated tags"},
        "handler": lambda name="", description="", steps="[]", tags="": _save_skill(name, description, steps, tags)
    },
    {
        "name": "list_skills",
        "description": "List all saved Skills",
        "params": {"tag": "Filter by tag (optional)"},
        "handler": lambda tag="": _list_skills(tag)
    },
    {
        "name": "get_skill",
        "description": "Get a Skill's details and steps",
        "params": {"name": "Skill name or ID"},
        "handler": lambda name="": _get_skill(name)
    },
    {
        "name": "run_skill",
        "description": "Execute a saved Skill",
        "params": {"name": "Skill name or ID", "args": "JSON object of arguments to pass"},
        "handler": lambda name="", args="{}": _get_skill(name)  # Returns the skill for the agent to execute
    },
    {
        "name": "delete_skill",
        "description": "Delete a saved Skill",
        "params": {"name": "Skill name or ID"},
        "handler": lambda name="": _delete_skill(name)
    },
    {
        "name": "teach_convention",
        "description": "Teach a coding convention or rule",
        "params": {"name": "Convention name", "rule": "The rule/convention description", "example": "Example of the convention"},
        "handler": lambda name="", rule="", example="": _teach_convention(name, rule, example)
    },
    {
        "name": "list_conventions",
        "description": "List all learned conventions",
        "params": {},
        "handler": lambda: _list_conventions()
    },
]


def _ensure_dirs():
    SKILLS_DIR.mkdir(parents=True, exist_ok=True)
    (SKILLS_DIR / "skills").mkdir(exist_ok=True)
    (SKILLS_DIR / "conventions").mkdir(exist_ok=True)


def _save_skill(name: str, description: str, steps_json: str, tags: str) -> dict:
    if not name:
        return {"error": "Skill name is required"}
    
    try:
        _ensure_dirs()
        steps = json.loads(steps_json) if isinstance(steps_json, str) else steps_json
        skill_id = name.lower().replace(" ", "_").replace("-", "_")
        
        skill = {
            "id": skill_id,
            "name": name,
            "description": description,
            "steps": steps,
            "tags": [t.strip() for t in tags.split(",") if t.strip()],
            "created_at": time.time(),
            "updated_at": time.time()
        }
        
        path = SKILLS_DIR / "skills" / f"{skill_id}.json"
        path.write_text(json.dumps(skill, indent=2))
        
        return {"success": True, "id": skill_id, "path": str(path)}
    except json.JSONDecodeError as e:
        return {"error": f"Invalid steps JSON: {e}"}
    except Exception as e:
        return {"error": str(e)}


def _list_skills(tag: str = "") -> dict:
    try:
        _ensure_dirs()
        skills = []
        skills_dir = SKILLS_DIR / "skills"
        
        for f in skills_dir.glob("*.json"):
            try:
                skill = json.loads(f.read_text())
                if tag and tag not in skill.get("tags", []):
                    continue
                skills.append({
                    "id": skill["id"],
                    "name": skill["name"],
                    "description": skill.get("description", ""),
                    "tags": skill.get("tags", []),
                    "step_count": len(skill.get("steps", [])),
                    "created_at": skill.get("created_at", 0)
                })
            except Exception:
                continue
        
        skills.sort(key=lambda s: s["created_at"], reverse=True)
        return {"skills": skills, "count": len(skills)}
    except Exception as e:
        return {"error": str(e)}


def _get_skill(name: str) -> dict:
    if not name:
        return {"error": "Skill name or ID is required"}
    
    try:
        _ensure_dirs()
        skill_id = name.lower().replace(" ", "_").replace("-", "_")
        path = SKILLS_DIR / "skills" / f"{skill_id}.json"
        
        if not path.exists():
            # Try fuzzy match
            for f in (SKILLS_DIR / "skills").glob("*.json"):
                skill = json.loads(f.read_text())
                if name.lower() in skill.get("name", "").lower():
                    path = f
                    break
        
        if not path.exists():
            return {"error": f"Skill '{name}' not found"}
        
        return json.loads(path.read_text())
    except Exception as e:
        return {"error": str(e)}


def _delete_skill(name: str) -> dict:
    if not name:
        return {"error": "Skill name or ID is required"}
    
    try:
        _ensure_dirs()
        skill_id = name.lower().replace(" ", "_").replace("-", "_")
        path = SKILLS_DIR / "skills" / f"{skill_id}.json"
        
        if path.exists():
            path.unlink()
            return {"success": True, "deleted": name}
        
        return {"error": f"Skill '{name}' not found"}
    except Exception as e:
        return {"error": str(e)}


def _teach_convention(name: str, rule: str, example: str) -> dict:
    if not name or not rule:
        return {"error": "Convention name and rule are required"}
    
    try:
        _ensure_dirs()
        convention = {
            "name": name,
            "rule": rule,
            "example": example,
            "created_at": time.time()
        }
        
        path = SKILLS_DIR / "conventions" / f"{name.lower().replace(' ', '_')}.json"
        path.write_text(json.dumps(convention, indent=2))
        
        return {"success": True, "message": f"Convention '{name}' saved"}
    except Exception as e:
        return {"error": str(e)}


def _list_conventions() -> dict:
    try:
        _ensure_dirs()
        conventions = []
        conv_dir = SKILLS_DIR / "conventions"
        
        for f in conv_dir.glob("*.json"):
            try:
                conv = json.loads(f.read_text())
                conventions.append({
                    "name": conv["name"],
                    "rule": conv["rule"],
                    "example": conv.get("example", "")
                })
            except Exception:
                continue
        
        return {"conventions": conventions, "count": len(conventions)}
    except Exception as e:
        return {"error": str(e)}
