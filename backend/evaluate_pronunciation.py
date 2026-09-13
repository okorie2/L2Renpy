"""CLI compatibility wrapper for the refactored pronunciation evaluator."""

import argparse
import json

from app.speech.pronunciation import evaluate_pronunciation


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--reference-text", required=True)
    parser.add_argument("--reference-audio", required=True)
    parser.add_argument("--learner-audio", required=True)
    args = parser.parse_args()

    result = evaluate_pronunciation(
        reference_text=args.reference_text,
        reference_audio_path=args.reference_audio,
        learner_audio_path=args.learner_audio,
    )

    print("\nRESULT")
    print(json.dumps(result, indent=2, ensure_ascii=False))
