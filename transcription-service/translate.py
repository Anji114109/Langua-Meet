# translate.py

import torch
import argostranslate.translate
from functools import lru_cache
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

print("🌍 Loading Translation Services...")

# ==========================
# CONFIG
# ==========================

DEVICE = "cpu"
torch.set_num_threads(4)

# ==========================
# ARGOS (English → Hindi)
# ==========================

installed_languages = argostranslate.translate.get_installed_languages()

from_lang = next((l for l in installed_languages if l.code == "en"), None)
to_lang_hi = next((l for l in installed_languages if l.code == "hi"), None)

argos_translation = None
if from_lang and to_lang_hi:
    argos_translation = from_lang.get_translation(to_lang_hi)
    print("✅ Argos Hindi Ready")
else:
    print("⚠️ Argos Hindi model not found")

# ==========================
# NLLB-200 (Tamil + Telugu)
# ==========================

print("🔄 Loading NLLB-200 model...")

MODEL_NAME = "facebook/nllb-200-distilled-600M"

nllb_tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
nllb_model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME).to(DEVICE)

nllb_model.eval()

print("✅ NLLB-200 Ready")
# 🔥 Print all supported languages
print("\n🌍 Supported NLLB Languages:")

all_langs = [
    tok for tok in nllb_tokenizer.additional_special_tokens
    if "_" in tok  # filters language codes
]

print(all_langs)
print(f"\nTotal languages supported: {len(all_langs)}\n")

# NLLB language codes
NLLB_LANGS = {
    "ta": "tam_Taml",   # Tamil
    "te": "tel_Telu",   # Telugu
}

# ==========================
# NLLB TRANSLATION FUNCTION
# ==========================

def nllb_translate(text: str, target_lang: str):

    tgt_lang = NLLB_LANGS.get(target_lang)
    if not tgt_lang:
        return text

    try:
        print("🔥 NLLB branch triggered")
        print("Input:", text)

        # Set source language (English from ASR)
        nllb_tokenizer.src_lang = "eng_Latn"

        inputs = nllb_tokenizer(
            text,
            return_tensors="pt",
            truncation=True,
            padding=True,
        )

        inputs = {k: v.to(DEVICE) for k, v in inputs.items()}

        forced_bos = nllb_tokenizer.convert_tokens_to_ids(tgt_lang)

        with torch.no_grad():
            generated_tokens = nllb_model.generate(
                **inputs,
                forced_bos_token_id=forced_bos,
                max_length=128,
                num_beams=1,
            )

        output = nllb_tokenizer.batch_decode(
            generated_tokens,
            skip_special_tokens=True
        )[0]

        print("Translated:", output)

        return output.strip()

    except Exception as e:
        print("🔥 NLLB error:", e)
        return text


# ==========================
# MAIN TRANSLATE FUNCTION
# ==========================

@lru_cache(maxsize=5000)
def translate_text(text: str, target_lang: str):

    print("TRANSLATE REQUEST:", text, "→", target_lang)

    if not text:
        return text

    try:
        # Hindi → Argos
        if target_lang == "hi" and argos_translation:
            print("🔥 Hindi branch triggered")
            return argos_translation.translate(text)

        # Tamil / Telugu → NLLB
        if target_lang in NLLB_LANGS:
            return nllb_translate(text, target_lang)

        # English selected
        if target_lang == "en":
            return text

        return text

    except Exception as e:
        print("🔥 Translation error:", e)
        return text