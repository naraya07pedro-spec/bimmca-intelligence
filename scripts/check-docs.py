from pathlib import Path
import re
from urllib.parse import unquote, urlsplit

root = Path.cwd().resolve()
count = 0
for path in root.rglob("*.md"):
    if any(part in {"node_modules", ".git"} for part in path.parts):
        continue
    text = path.read_text(encoding="utf-8")
    for target in re.findall(r"\[[^\]]*\]\(([^\s)]+)\)", text):
        parsed = urlsplit(target)
        if parsed.scheme:
            if parsed.scheme not in {"https", "http", "mailto"}:
                raise SystemExit(f"Unsupported link scheme in {path.relative_to(root)}")
            if parsed.scheme in {"https", "http"} and not parsed.netloc:
                raise SystemExit(f"Malformed URL in {path.relative_to(root)}")
        elif parsed.path:
            dest = (path.parent / unquote(parsed.path)).resolve()
            if not dest.is_relative_to(root) or not dest.exists():
                raise SystemExit(f"Missing local target in {path.relative_to(root)}: {parsed.path}")
        count += 1
print(f"Checked {count} Markdown targets (local existence and URL syntax; no remote requests)")
