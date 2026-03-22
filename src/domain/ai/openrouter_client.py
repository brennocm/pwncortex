import os
import re
import json
from sqlalchemy.orm import Session
from src.data.database import SessionLocal
from src.domain.ai.persistence import persist_extracted_entities
from src.domain.ai.constants import SYSTEM_PROMPT

OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")


class OpenRouterClient:
    def __init__(self, api_key: str, model: str):
        self._api_key = api_key
        self._model = model

    def _build_headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/pwncortex/pwncortex",
            "X-Title": "PwnCortex",
        }

    def chat(self, messages: list) -> tuple[bool, str]:
        """
        Sends a list of OpenAI-style messages to OpenRouter and returns a conversational response.
        """
        try:
            import requests

            headers = self._build_headers()
            payload = {"model": self._model, "messages": messages}

            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60,
            )

            if not response.ok:
                try:
                    err_body = response.json()
                    err_msg = err_body.get("error", {}).get("message") or response.text
                except Exception as exc:
                    import logging

                    logging.warning(
                        f"Failed to parse error body as JSON from {response.status_code}: {exc}"
                    )
                    err_msg = response.text or response.reason

                body_lower = err_msg.lower()
                if response.status_code == 401:
                    return False, "OpenRouter: invalid or expired API key."
                if response.status_code == 402:
                    return False, f"OpenRouter: insufficient credits. {err_msg}"
                if response.status_code == 429:
                    return (
                        False,
                        "OpenRouter: rate limit exceeded. Wait a moment and try again.",
                    )
                if response.status_code in (404, 403) and (
                    "guardrail" in body_lower
                    or "data policy" in body_lower
                    or "restrictions" in body_lower
                ):
                    return (
                        False,
                        "OpenRouter blocked the request due to privacy/guardrail settings. "
                        "Visit openrouter.ai/settings/privacy to relax restrictions.",
                    )
                return False, f"OpenRouter error {response.status_code}: {err_msg}"

            result = response.json()
            content = result["choices"][0]["message"]["content"]
            return True, content

        except Exception as exc:
            if "ConnectionError" in str(type(exc)):
                return False, "OpenRouter: connection error. Check your internet."
            if "Timeout" in str(type(exc)):
                return False, "OpenRouter: request timed out."
            if isinstance(exc, ImportError):
                return (
                    False,
                    "OpenRouter: requests module not installed. Run pip install requests.",
                )
            import logging

            logging.exception("OpenRouter chat failed")
            return False, f"OpenRouter chat failed: {exc}"

    def __call__(self, text: str, project_id: str) -> tuple[bool, dict | str]:
        db = SessionLocal()
        try:
            import requests

            headers = self._build_headers()
            payload = {
                "model": self._model,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {
                        "role": "user",
                        "content": f"Extract the data from this penetration test note: {text}",
                    },
                ],
            }

            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=60,
            )

            if not response.ok:
                try:
                    err_body = response.json()
                    err_msg = str(
                        err_body.get("error", {}).get("message") or response.text or ""
                    )
                except Exception as exc:
                    import logging

                    logging.warning(
                        f"Failed to parse error body as JSON from {response.status_code}: {exc}"
                    )
                    err_msg = str(response.text or response.reason or "")

                body_lower = err_msg.lower()
                if response.status_code == 401:
                    return False, "OpenRouter: invalid or expired API key."
                if response.status_code == 402:
                    return False, f"OpenRouter: insufficient credits. {err_msg}"
                if response.status_code == 429:
                    return (
                        False,
                        "OpenRouter: rate limit exceeded. Wait a moment and try again.",
                    )
                if response.status_code in (404, 403) and (
                    "guardrail" in body_lower
                    or "data policy" in body_lower
                    or "restrictions" in body_lower
                ):
                    return (
                        False,
                        "OpenRouter blocked: privacy/guardrail settings. Check https://openrouter.ai/settings/privacy",
                    )
                return (
                    False,
                    f"OpenRouter error {response.status_code}: HTTP {response.status_code} {err_msg}",
                )

            result = response.json()
            raw = result["choices"][0]["message"]["content"]

            # Cleanup markdown format
            match = re.search(r"```(?:json)?\s*(.*?)\s*```", raw, re.DOTALL)
            if match:
                raw = match.group(1)

            extracted = json.loads(raw.strip())
            _persist_extracted(extracted, text, project_id, db)
            return True, extracted

        except json.JSONDecodeError as exc:
            return False, f"OpenRouter returned invalid JSON: {exc}"
        except Exception as exc:
            if "ConnectionError" in str(type(exc)):
                return False, "OpenRouter: connection error. Check your internet."
            if "Timeout" in str(type(exc)):
                return False, "OpenRouter: request timed out."
            if isinstance(exc, ImportError):
                return (
                    False,
                    f"OpenRouter: requests module not installed. Run pip install requests. {exc}",
                )
            import logging

            logging.exception("OpenRouter extraction failed")
            return False, f"OpenRouter API request failed: {exc}"
        finally:
            db.close()


def extract_entities_from_text(text: str, project_id: str) -> tuple[bool, dict | str]:
    # Deprecated fallback
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        return False, "OPENROUTER_API_KEY not configured"
    model = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
    client = OpenRouterClient(api_key=api_key, model=model)
    return client(text, project_id)


def _persist_extracted(
    data: dict, original_text: str, project_id: str, db: Session
) -> None:
    persist_extracted_entities(
        data, original_text, project_id, db, client_name="openrouter"
    )
