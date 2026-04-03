import sherpa_onnx
import numpy as np

print("🔄 Loading Zipformer Streaming INT8 Model...")

MODEL_DIR = "models/zipformer"

recognizer = sherpa_onnx.OnlineRecognizer.from_transducer(
    encoder=f"{MODEL_DIR}/encoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
    decoder=f"{MODEL_DIR}/decoder-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
    joiner=f"{MODEL_DIR}/joiner-epoch-99-avg-1-chunk-16-left-128.int8.onnx",
    tokens=f"{MODEL_DIR}/tokens.txt",
    num_threads=4,
    sample_rate=16000,
    feature_dim=80,
    enable_endpoint_detection=True,
)

print("✅ ASR Ready")


# =====================================
# 🔥 STREAMING CLASS
# =====================================

class StreamingASR:

    def __init__(self):
        self.stream = recognizer.create_stream()
        self.last_partial = ""

    def step(self, chunk: np.ndarray):

        if len(chunk) == 0:
            return None

        self.stream.accept_waveform(16000, chunk)

        while recognizer.is_ready(self.stream):
            recognizer.decode_stream(self.stream)

        result = recognizer.get_result(self.stream).strip()

        if not result:
            return None

        # FINAL (endpoint detected)
        if recognizer.is_endpoint(self.stream):

            self.stream.input_finished()

            while recognizer.is_ready(self.stream):
                recognizer.decode_stream(self.stream)

            final_text = recognizer.get_result(self.stream).strip()

            self.stream = recognizer.create_stream()
            self.last_partial = ""

            return {
                "text": final_text.capitalize(),
                "final": True
            }

        # PARTIAL
        if result == self.last_partial:
            return None

        self.last_partial = result

        return {
            "text": result.capitalize(),
            "final": False
        }