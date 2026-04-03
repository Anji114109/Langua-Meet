from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import numpy as np
import asyncio
import json
import os
import warnings
from typing import Dict, List
from io import BytesIO
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from model import StreamingASR
from translate import translate_text
from pdf_font import register_pdf_font

# 🔥 GEMINI IMPORTS (with graceful fallback)
gemini_api_key = os.getenv("GEMINI_API_KEY", "")
gemini_available = False

if gemini_api_key:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", FutureWarning)
            import google.generativeai as genai
            from google.generativeai import configure, GenerativeModel
        configure(api_key=gemini_api_key)
        gemini_available = True
        print("✅ Gemini API configured successfully")
    except Exception as e:
        print(f"⚠️ Gemini API configuration warning: {e}")
        gemini_available = False
else:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", FutureWarning)
            import google.generativeai as genai
            from google.generativeai import configure, GenerativeModel
    except ImportError:
        print("⚠️ google-generativeai not available. Install with: pip install google-generativeai")

# 🔥 PDF IMPORTS
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.units import inch

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DEFAULT_LANGUAGE = "en"
GEMINI_MODEL_CANDIDATE_PREFERENCES = [
    "models/gemini-2.5-flash",
    "models/gemini-2.0-flash",
    "models/gemini-flash-latest",
    "models/gemini-pro-latest",
]

# =========================================
# IN-MEMORY TRANSCRIPT STORE
# =========================================
MEETING_TRANSCRIPTS: Dict[str, List[dict]] = {}


def log_runtime(event: str, payload: dict | None = None):
    data = payload or {}
    print(f"[runtime] {event}: {json.dumps(data, ensure_ascii=False)}")


def resolve_available_gemini_models():
    """
    Query Gemini for models available to the current API key and keep only
    those supporting generateContent.
    """
    try:
        models = list(genai.list_models())
    except Exception as err:
        log_runtime("gemini_list_models_error", {"error": str(err)})
        return []

    available = []
    for m in models:
        methods = getattr(m, "supported_generation_methods", []) or []
        if "generateContent" in methods:
            available.append(getattr(m, "name", ""))

    log_runtime("gemini_models_available", {
        "count": len(available),
        "sample": available[:8],
    })
    return available


def run_gemini_with_fallback(prompt: str):
    last_error = None

    available_models = resolve_available_gemini_models()

    # Prioritize preferred models if they are available, then try the rest.
    prioritized = [m for m in GEMINI_MODEL_CANDIDATE_PREFERENCES if m in available_models]
    remaining = [m for m in available_models if m not in prioritized]
    candidate_models = prioritized + remaining

    if not candidate_models:
        raise RuntimeError("No Gemini models with generateContent are available for this API key")

    for model_name in candidate_models:
        try:
            model = GenerativeModel(model_name)
            response = model.generate_content(prompt)

            text = (getattr(response, "text", "") or "").strip()
            if not text:
                raise ValueError("Gemini returned an empty response")

            log_runtime("gemini_model_selected", {
                "model": model_name,
            })
            return text, model_name
        except Exception as err:
            last_error = err
            log_runtime("gemini_model_failed", {
                "model": model_name,
                "error": str(err),
            })

    raise last_error if last_error else RuntimeError("No Gemini models available")


# =========================================
# WEBSOCKET (UNCHANGED LOGIC)
# =========================================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()
    asr = StreamingASR()
    loop = asyncio.get_running_loop()

    target_lang = DEFAULT_LANGUAGE
    meeting_id = None
    speaker_id = "unknown"
    display_name = "Guest"

    try:
        while True:
            message = await websocket.receive()

            # Handle disconnect message gracefully
            if message.get("type") == "websocket.disconnect":
                break

            if "text" in message:
                try:
                    data = json.loads(message["text"])

                    if data.get("type") == "set-language":
                        target_lang = data.get("lang", "en")

                    if data.get("type") == "init":
                        meeting_id = data.get("meeting_id")
                        speaker_id = data.get("speaker_id", "guest")
                        display_name = data.get("display_name") or speaker_id

                        if meeting_id not in MEETING_TRANSCRIPTS:
                            MEETING_TRANSCRIPTS[meeting_id] = []

                except:
                    pass
                continue

            if "bytes" in message:
                audio_bytes = message["bytes"]
                chunk = np.frombuffer(audio_bytes, dtype=np.float32)

                if chunk.size == 0:
                    continue

                result = await loop.run_in_executor(
                    None, asr.step, chunk
                )

                if not result:
                    continue

                if result["final"]:
                    original_text = result["text"]

                    translated = await loop.run_in_executor(
                        None,
                        translate_text,
                        original_text,
                        target_lang,
                    )

                    if meeting_id:
                        MEETING_TRANSCRIPTS[meeting_id].append({
                            "speaker": display_name,
                            "original": original_text,
                            "translated": translated,
                            "language": target_lang
                        })

                    log_runtime("subtitle_final", {
                        "meeting_id": meeting_id,
                        "speaker": display_name,
                        "text_preview": original_text[:80],
                    })

                    await websocket.send_json({
                        "text": translated,
                        "final": True,
                        "speaker": display_name,
                    })

                else:
                    log_runtime("subtitle_partial", {
                        "meeting_id": meeting_id,
                        "speaker": display_name,
                        "text_preview": result.get("text", "")[:80],
                    })
                    await websocket.send_json({
                        **result,
                        "speaker": display_name,
                    })

    except WebSocketDisconnect:
        print(f"🔴 WebSocket disconnected: {meeting_id}")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")



# =========================================
# GET TRANSCRIPT
# =========================================
@app.get("/transcript/{meeting_id}")
async def get_transcript(meeting_id: str):
    transcript = MEETING_TRANSCRIPTS.get(meeting_id, [])
    return JSONResponse(content={
        "meeting_id": meeting_id,
        "transcript": transcript
    })


# =========================================
# 🔥 PDF GENERATION ENDPOINT
# =========================================
@app.get("/pdf/{meeting_id}")
async def generate_pdf(
    meeting_id: str,
    lang: str = Query("en"),
    host_name: str = Query("Host"),
    subject: str = Query("General Discussion")
):

    transcript = MEETING_TRANSCRIPTS.get(meeting_id)

    if not transcript:
        return JSONResponse(
            status_code=404,
            content={"error": "Transcript not found"}
        )

    buffer = BytesIO()

    doc = SimpleDocTemplate(buffer)
    elements = []

    styles = getSampleStyleSheet()
    pdf_font_name = register_pdf_font()

    text_style = ParagraphStyle(
        name="TextStyle",
        parent=styles["Normal"],
        fontName=pdf_font_name,
        fontSize=11,
        spaceAfter=12,
    )

    title_style = ParagraphStyle(
        name="TitleStyle",
        parent=styles["Heading1"],
        fontName=pdf_font_name,
    )

    # 🔥 TITLE
    elements.append(Paragraph(f"<b>{host_name.upper()} -- {subject.upper()}</b>", title_style))
    elements.append(Spacer(1, 0.3 * inch))

    # 🔥 CONTENT
    for entry in transcript:

        speaker = entry["speaker"]
        original_text = entry.get("original", "")

        if lang == "en":
            text = original_text
        else:
            # Translate on demand so PDF always matches the user-selected language.
            try:
                text = translate_text(original_text, lang)
            except Exception:
                text = entry.get("translated", original_text)

        elements.append(Paragraph(f"{speaker}: {text}", text_style))

    doc.build(elements)

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
            f"attachment; filename=meeting-{meeting_id}-{lang}.pdf"
        }
    )


# =========================================
# 🔥 MODIFY TRANSCRIPT USING GEMINI
# =========================================
@app.post("/modify-transcript/{meeting_id}")
async def modify_transcript(meeting_id: str):
    """
    Automatically modify/correct the transcript for a meeting using Gemini API.
    This is called when the user leaves the meeting to improve transcript quality.
    """
    if not gemini_available:
        print(f"⚠️ Gemini API not available. Skipping transcript modification for {meeting_id}")
        log_runtime("gemini_modify_skipped", {
            "meeting_id": meeting_id,
            "reason": "gemini_not_available",
        })
        return JSONResponse(
            status_code=200,
            content={"status": "success", "message": "Gemini API not available, skipping modification", "meeting_id": meeting_id}
        )

    transcript = MEETING_TRANSCRIPTS.get(meeting_id)

    if not transcript or not transcript:
        log_runtime("gemini_modify_not_found", {
            "meeting_id": meeting_id,
        })
        return JSONResponse(
            status_code=404,
            content={"error": "Transcript not found"}
        )

    try:
        log_runtime("gemini_modify_started", {
            "meeting_id": meeting_id,
            "entries": len(transcript),
        })
        
        # Build the transcript text to send to Gemini
        transcript_text = "\n".join([
            f"{entry['speaker']}: {entry['original']}"
            for entry in transcript
        ])

        prompt = f"""You are a professional transcript editor. Improve the following meeting transcript by:
1. Correcting grammar, spelling, and punctuation
2. Improving clarity and readability
3. Fixing capitalization and formatting
4. Maintaining the original meaning and all content

Please provide the corrected transcript in the same format (Speaker: text per line).

Transcript:
{transcript_text}
"""

        modified_text, selected_model = run_gemini_with_fallback(prompt)

        # Parse the modified text back into the original structure
        lines = modified_text.split("\n")
        modified_entries = []
        modified_count = 0

        for i, entry in enumerate(transcript):
            speaker = entry["speaker"]
            # Find the line for this speaker in the modified text
            modified_line = None
            for line in lines:
                if line.startswith(f"{speaker}:"):
                    modified_line = line[len(speaker) + 1:].strip()
                    break
            
            if modified_line:
                if entry.get("original", "") != modified_line:
                    modified_count += 1
                entry["original"] = modified_line
            modified_entries.append(entry)

        # Update the transcript in memory
        MEETING_TRANSCRIPTS[meeting_id] = modified_entries

        log_runtime("gemini_modify_completed", {
            "meeting_id": meeting_id,
            "entries": len(modified_entries),
            "modified_count": modified_count,
            "model": selected_model,
        })

        return JSONResponse(content={
            "status": "success",
            "message": "Transcript modified successfully",
            "meeting_id": meeting_id,
            "modified_count": modified_count,
            "model": selected_model,
        })

    except Exception as e:
        print(f"❌ Gemini modification error: {e}")
        log_runtime("gemini_modify_error", {
            "meeting_id": meeting_id,
            "error": str(e),
        })
        return JSONResponse(
            status_code=200,
            content={
                "status": "skipped",
                "message": "Gemini modification unavailable; continuing with original transcript",
                "meeting_id": meeting_id,
                "detail": str(e),
            }
        )