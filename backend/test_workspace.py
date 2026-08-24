import os
import unittest

from workspace import apply_workspace


class ApplyWorkspaceTests(unittest.TestCase):
    def test_injects_root_for_list_dir(self):
        out = apply_workspace("list_dir", {"path": "."}, "/tmp/proj")
        self.assertEqual(out["root"], "/tmp/proj")
        self.assertEqual(out["path"], ".")

    def test_does_not_overwrite_explicit_root(self):
        out = apply_workspace("read_file", {"path": "a.ts", "root": "/other"}, "/tmp/proj")
        self.assertEqual(out["root"], "/other")

    def test_replaces_dot_path_for_git_and_tests(self):
        git = apply_workspace("git_status", {"path": "."}, "/tmp/proj")
        self.assertEqual(git["path"], "/tmp/proj")
        tests = apply_workspace("run_tests", {}, "/tmp/proj")
        self.assertEqual(tests["path"], "/tmp/proj")

    def test_shell_cwd_and_relative_file_info(self):
        shell = apply_workspace("run_command", {"command": "ls"}, "/tmp/proj")
        self.assertEqual(shell["cwd"], "/tmp/proj")
        info = apply_workspace("get_file_info", {"path": "plan.md"}, "/tmp/proj")
        self.assertEqual(info["path"], os.path.join("/tmp/proj", "plan.md"))

    def test_empty_workspace_is_noop(self):
        args = {"path": "."}
        self.assertEqual(apply_workspace("list_dir", args, ""), args)

    def test_generate_image_gets_root(self):
        out = apply_workspace("generate_image", {"prompt": "cat"}, "/tmp/proj")
        self.assertEqual(out["root"], "/tmp/proj")
        self.assertEqual(out["prompt"], "cat")


if __name__ == "__main__":
    unittest.main()
