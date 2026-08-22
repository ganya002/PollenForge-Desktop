import os

FS_ROOT_TOOLS = {
    "read_file",
    "write_file",
    "edit_file",
    "delete_file",
    "list_dir",
    "search_files",
    "read_folder",
}

PATH_DEFAULT_TOOLS = {
    "find_files",
    "search_code",
    "analyze_dependencies",
    "count_lines",
    "find_functions",
    "tree_view",
    "run_tests",
    "run_linter",
    "run_formatter",
    "run_build",
    "run_typecheck",
    "run_security_scan",
    "run_dependency_audit",
    "check_test_coverage",
}

CWD_TOOLS = {"run_command", "start_background_task"}


def _blank_or_dot(value) -> bool:
    if value is None:
        return True
    if not isinstance(value, str):
        return False
    return value.strip() in ("", ".")


def apply_workspace(tool_name: str, tool_args: dict, workspace: str) -> dict:
    """Point filesystem/git/shell tools at the chat's project folder."""
    if not workspace:
        return dict(tool_args)
    args = dict(tool_args)
    if tool_name in FS_ROOT_TOOLS and not args.get("root"):
        args["root"] = workspace
    if tool_name.startswith("git_") and tool_name != "git_clone":
        if _blank_or_dot(args.get("path")):
            args["path"] = workspace
    if tool_name == "git_clone" and _blank_or_dot(args.get("dest")):
        args["dest"] = workspace
    if tool_name in PATH_DEFAULT_TOOLS and _blank_or_dot(args.get("path")):
        args["path"] = workspace
    if tool_name == "get_file_info":
        p = args.get("path") or ""
        if isinstance(p, str) and p and not os.path.isabs(os.path.expanduser(p)):
            args["path"] = os.path.join(workspace, p)
    if tool_name in CWD_TOOLS and _blank_or_dot(args.get("cwd")):
        args["cwd"] = workspace
    return args
