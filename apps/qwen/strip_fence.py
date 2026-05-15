#!/usr/bin/env python3
"""Strip markdown code fences from stdin. Keeps inner content only.

If no fence detected, passes through unchanged. Drops leading/trailing blank
lines.
"""
import sys, re

text = sys.stdin.read()
m = re.search(r"```[a-zA-Z0-9_+\-]*\n(.*?)```", text, re.DOTALL)
out = m.group(1) if m else text
print(out.strip("\n"))
