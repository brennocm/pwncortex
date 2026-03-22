from src.domain.ai.persistence import persist_extracted_entities
import logging
import os
import re
import json
import requests
from sqlalchemy.orm import Session
from src.data.database import SessionLocal
from src.domain.ai.constants import SYSTEM_PROMPT

OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen2.5:3b")


def get_ollama_base_url() -> str:
    """Returns Ollama base URL. Required environment variable OLLAMA_BASE_URL."""
    url = os.environ.get("OLLAMA_BASE_URL")
    if not url:
        raise RuntimeError(
            "OLLAMA_BASE_URL environment variable is required. "
            "Run the stack via docker compose."
        )
    return url



def extract_entities_from_text(text: str, project_id: str):
    """
    Sends free-text pentest notes to Ollama and persists extracted entities.

    Returns (True, extracted_dict) on success or (False, error_str) on failure.
    """
    db = SessionLocal()
    try:
        url = get_ollama_base_url()
        # Normalize URL for /api/chat
        if not url.endswith("/api/chat"):
            url = url.rstrip("/") + "/api/chat"

        logging.debug("[ollama] trying %s", url)
        response = requests.post(
            url,
            json={
                "model": OLLAMA_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Extract the data from this penetration test note: {text}",
                    },
                ],
                "stream": False,
                "format": "json",
            },
            timeout=60,
        )

        if response.status_code == 404:
            gen_url = url.replace("/api/chat", "/api/generate")
            logging.debug("[ollama] /api/chat 404, fallback to %s", gen_url)
            response = requests.post(
                gen_url,
                json={
                    "model": OLLAMA_MODEL,
                    "system": SYSTEM_PROMPT,
                    "prompt": f"Extract the data from this penetration test note: {text}",
                    "stream": False,
                    "format": "json",
                },
                timeout=60,
            )

        response.raise_for_status()
        result = response.json()

        if "message" in result:
            raw = result["message"].get("content", "{}")
        else:
            raw = result.get("response", "{}")

        # Strip markdown code fences if present
        match = re.search(r"```(?:json)?\s*(.*?)\s*```", raw, re.DOTALL)
        if match:
            raw = match.group(1)

        extracted = json.loads(raw.strip())
        _persist_extracted(extracted, text, project_id, db)
        return True, extracted

    except requests.exceptions.ConnectionError:
        return False, "Ollama service unreachable. Is the Ollama container running?"
    except requests.exceptions.Timeout:
        return False, "Ollama request timed out. The model may still be loading."
    except json.JSONDecodeError as exc:
        return False, f"Ollama returned invalid JSON: {exc}"
    except Exception as exc:
        logging.exception("Ollama extraction failed")
        return (
            False,
            f"Ollama request failed. Error: {str(exc)}",
        )

    finally:
        db.close()


def chat_completion(messages: list) -> tuple[bool, str]:
    """
    Sends a list of OpenAI-style messages to Ollama and returns a conversational response.
    """
    try:
        url = get_ollama_base_url()
        if not url.endswith("/api/chat"):
            url = url.rstrip("/") + "/api/chat"

        response = requests.post(
            url,
            json={
                "model": OLLAMA_MODEL,
                "messages": messages,
                "stream": False,
            },
            timeout=60,
        )
        response.raise_for_status()
        result = response.json()
        content = (
            result["message"]["content"]
            if "message" in result
            else result.get("response", "")
        )
        return True, content
    except RuntimeError as exc:
        # OLLAMA_BASE_URL not set — service not enabled
        return False, f"Ollama not available: {exc}"
    except requests.exceptions.ConnectionError:
        return False, "Ollama service unreachable. Is the Ollama container running?"
    except requests.exceptions.Timeout:
        return False, "Ollama request timed out. The model may still be loading."
    except Exception as exc:
        logging.exception("Ollama chat failed")
        return False, f"Ollama error: {exc}"


def _persist_extracted(
    data: dict, original_text: str, project_id: str, db: Session
) -> None:
    persist_extracted_entities(
        data, original_text, project_id, db, client_name="ollama"
    )
