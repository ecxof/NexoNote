#!/usr/bin/env python3
"""
Minimal HTTP server for semantic linking (browser / localhost dev).
Run: python -m semantic_linking.server  (or python semantic_linking/server.py)
Then the React app at http://localhost:5173 can POST to http://localhost:5000/find-links.
"""
import json
import sys
from pathlib import Path

# Ensure package is importable when run as script
root = Path(__file__).resolve().parent.parent
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from flask import Flask, request, jsonify

app = Flask(__name__)

# Allow requests from Vite dev server
@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
    resp.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp

@app.route("/find-links", methods=["POST", "OPTIONS"])
def find_links():
    if request.method == "OPTIONS":
        return "", 204
    try:
        body = request.get_json(force=True) or {}
        target_content = body.get("target_content", "")
        notes = body.get("notes", [])
        threshold = float(body.get("threshold", 0.25))
        max_results = body.get("max_results")
        top_keywords = int(body.get("top_keywords", 8))
        if max_results is not None:
            max_results = int(max_results)
    except (ValueError, TypeError) as e:
        return jsonify({"error": str(e)}), 400

    existing = {n["id"]: n.get("content", "") for n in notes if n.get("id")}
    if not existing:
        return jsonify({"links": []})

    try:
        from semantic_linking import find_semantic_links
        links = find_semantic_links(
            target_content,
            existing,
            threshold=threshold,
            max_results=max_results,
            top_keywords=top_keywords,
        )
        return jsonify({"links": links})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
