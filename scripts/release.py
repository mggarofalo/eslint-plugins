#!/usr/bin/env python3
"""Release a package: bump version, commit, push, and create a GitHub release."""

import json
import platform
import re
import subprocess
import sys
from pathlib import Path

_SHELL = platform.system() == "Windows"


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=True, text=True, shell=_SHELL, **kwargs)


def fatal(msg: str) -> None:
    print(f"Error: {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 3:
        print(f"Usage: {sys.argv[0]} <package-short-name> <version>")
        print(f"Example: {sys.argv[0]} react-hook-stability 0.2.0")
        sys.exit(1)

    short_name = sys.argv[1]
    version = sys.argv[2]
    package_dir = Path("packages") / f"eslint-plugin-{short_name}"
    tag = f"{short_name}-v{version}"

    if not package_dir.is_dir():
        fatal(f"package directory '{package_dir}' not found")

    if not re.match(r"^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$", version):
        fatal(f"invalid version '{version}' (expected semver like 1.2.3 or 1.2.3-beta.1)")

    # Ensure working tree is clean
    result = run(["git", "status", "--porcelain"], capture_output=True)
    if result.stdout.strip():
        fatal("working tree is not clean. Commit or stash changes first.")

    # Ensure we're on main
    result = run(["git", "branch", "--show-current"], capture_output=True)
    branch = result.stdout.strip()
    if branch != "main":
        fatal(f"releases should be created from main (currently on '{branch}')")

    # Read package name from package.json
    pkg_json = json.loads((package_dir / "package.json").read_text())
    package_name = pkg_json["name"]

    print(f"Releasing {package_name}@{version} (tag: {tag})")
    print()

    # Bump version in package.json
    run(["npm", "version", version, "--no-git-tag-version", "-w", str(package_dir)])

    # Update package-lock.json
    run(["npm", "install", "--package-lock-only"])

    # Commit the version bump
    run(["git", "add", f"{package_dir}/package.json", "package-lock.json"])
    run(["git", "commit", "-m", f"chore({short_name}): release v{version}"])

    # Push the commit
    run(["git", "push"])

    # Create GitHub release (triggers publish workflow)
    run([
        "gh", "release", "create", tag,
        "--title", f"{package_name}@{version}",
        "--generate-notes",
        "--target", "main",
    ])

    print()
    print(f"Release created: {tag}")
    print("The publish workflow will build, test, and publish to npm.")
    print("Monitor: gh run watch")


if __name__ == "__main__":
    main()
