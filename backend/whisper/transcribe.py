import sys
import json
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding="utf-8")


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Missing audio path"}))
        return

    audio_path = sys.argv[1]

    model = WhisperModel(
        "small",
        device="cpu",
        compute_type="int8"
    )

    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500
        ),
        condition_on_previous_text=True
    )

    text = " ".join(segment.text.strip() for segment in segments)

    print(json.dumps({
        "success": True,
        "language": info.language,
        "language_probability": info.language_probability,
        "text": text
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()