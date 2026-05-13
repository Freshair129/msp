#!/usr/bin/env python3
"""
qwen - Local LLM CLI for Claude delegation via Ollama
Usage:
  qwen "your prompt here"
  echo file content | qwen
  qwen --model llama3.2:1b "write a unit test"
  qwen --code "generate prisma query"
"""

import sys
import argparse
import json
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
DEFAULT_MODEL = "qwen2.5-coder:14b"

SYSTEM_PROMPTS = {
    "code": "You are an expert software engineer. Output code only, no explanation unless asked. Be concise and precise.",
    "review": "You are a senior code reviewer. Be direct, identify issues, suggest improvements. Format as bullet points.",
    "test": "You are a testing expert. Write comprehensive tests. Use the same framework as the existing code.",
    "doc": "You are a technical writer. Write clear, concise documentation in markdown.",
    "default": "You are a helpful coding assistant. Be concise and direct."
}

def query_ollama(prompt, model, system, temperature, stream):
    payload = {
        "model": model,
        "prompt": prompt,
        "system": system,
        "options": {"temperature": temperature},
        "stream": stream
    }
    try:
        if stream:
            with requests.post(OLLAMA_URL, json=payload, stream=True, timeout=120) as r:
                r.raise_for_status()
                for line in r.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        print(chunk.get("response", ""), end="", flush=True)
                        if chunk.get("done"):
                            print()
                            break
        else:
            r = requests.post(OLLAMA_URL, json=payload, timeout=120)
            r.raise_for_status()
            print(r.json()["response"], flush=True)
    except requests.exceptions.ConnectionError:
        print("ERROR: Ollama not running. Start with: ollama serve", file=sys.stderr, flush=True)
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr, flush=True)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Local LLM CLI - delegates to Ollama")
    parser.add_argument("prompt", nargs="*", help="Prompt text")
    parser.add_argument("--model", "-m", default=DEFAULT_MODEL)
    parser.add_argument("--temp", "-t", type=float, default=0.1)
    parser.add_argument("--code", "-c", action="store_true")
    parser.add_argument("--review", "-r", action="store_true")
    parser.add_argument("--test", action="store_true")
    parser.add_argument("--doc", "-d", action="store_true")
    parser.add_argument("--no-stream", action="store_true")
    parser.add_argument("--system", "-s")
    parser.add_argument("--list", "-l", action="store_true")
    args = parser.parse_args()

    if args.list:
        try:
            r = requests.get("http://localhost:11434/api/tags", timeout=5)
            for m in r.json().get("models", []):
                print(f"  {m['name']:<40} {m.get('size',0)/1e9:.1f} GB")
        except Exception:
            print("ERROR: Cannot connect to Ollama", file=sys.stderr)
        return

    prompt_parts = []

    # If no prompt args given, read from stdin (pipe mode only)
    # If prompt args ARE given, skip stdin entirely to avoid blocking
    if args.prompt:
        prompt_parts.append(" ".join(args.prompt))
    else:
        # No args — must be piped: read stdin
        stdin_content = sys.stdin.read().strip()
        if stdin_content:
            prompt_parts.append(stdin_content)

    if not prompt_parts:
        parser.print_help()
        sys.exit(1)

    prompt = "\n\n".join(prompt_parts)

    if args.system:
        system = args.system
    elif args.code:
        system = SYSTEM_PROMPTS["code"]
    elif args.review:
        system = SYSTEM_PROMPTS["review"]
    elif args.test:
        system = SYSTEM_PROMPTS["test"]
    elif args.doc:
        system = SYSTEM_PROMPTS["doc"]
    else:
        system = SYSTEM_PROMPTS["default"]

    query_ollama(prompt=prompt, model=args.model, system=system,
                 temperature=args.temp, stream=not args.no_stream)

if __name__ == "__main__":
    main()
