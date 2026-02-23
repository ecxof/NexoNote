#!/usr/bin/env python3
"""
Example: run semantic linking from the project root.

  cd nexonote
  pip install -r semantic_linking/requirements.txt
  python -m nltk.downloader punkt stopwords wordnet
  python semantic_linking/run_example.py
"""

import sys
from pathlib import Path

# Allow importing semantic_linking when run as script from project root
root = Path(__file__).resolve().parent.parent
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from semantic_linking import find_semantic_links

def main():
    target = """
    <p>Neural networks learn via <strong>backpropagation</strong> and gradient descent.
    The chain rule is used to compute partial derivatives.</p>
    """
    existing = {
        "note-1": "<p>Backpropagation computes gradients layer by layer using the chain rule.</p>",
        "note-2": "<p>Deadlock occurs when two processes wait for each other.</p>",
        "note-3": "<p>Optimization: stochastic gradient descent and learning rate schedules.</p>",
    }
    links = find_semantic_links(target, existing, threshold=0.25)
    print("Semantic links (note_id, score):")
    for item in links:
        print(f"  {item['note_id']}: {item['score']:.4f}")

if __name__ == "__main__":
    main()
