#!/usr/bin/env python3
"""
CLI for semantic linking: read JSON from stdin, write JSON to stdout.
Used by Electron main process to spawn Python and get related notes without a server.
"""
import json
import sys

def main():
    try:
        payload = json.load(sys.stdin)
        target_content = payload.get("target_content", "")
        notes = payload.get("notes", [])
        threshold = float(payload.get("threshold", 0.25))
        max_results = payload.get("max_results")
        top_keywords = int(payload.get("top_keywords", 8))
        if max_results is not None:
            max_results = int(max_results)
    except (json.JSONDecodeError, ValueError) as e:
        print(json.dumps({"error": str(e)}), flush=True)
        sys.exit(1)

    existing = {n["id"]: n.get("content", "") for n in notes if n.get("id")}
    if not existing:
        print(json.dumps({"links": []}), flush=True)
        return

    try:
        from semantic_linking import find_semantic_links
        links = find_semantic_links(
            target_content,
            existing,
            threshold=threshold,
            max_results=max_results,
            top_keywords=top_keywords,
        )
        print(json.dumps({"links": links}), flush=True)
    except Exception as e:
        print(json.dumps({"error": str(e)}), flush=True)
        sys.exit(1)

if __name__ == "__main__":
    main()
