import logging
import os
from collections.abc import Callable

import sqlalchemy.exc

from src.data.database import SessionLocal
from src.data.models import AppSettings

_log = logging.getLogger(__name__)


def _read_provider_from_db():
    db = SessionLocal()
    try:
        setting = db.query(AppSettings).filter_by(key="llm_provider").first()
        return setting.value if setting else None
    except sqlalchemy.exc.SQLAlchemyError:
        _log.warning("Could not read llm_provider from DB; falling back to env.")
        return None
    finally:
        db.close()


def _get_api_key():
    db = SessionLocal()
    try:
        setting = db.query(AppSettings).filter_by(key="openrouter_api_key").first()
        val = setting.value if setting else None
        if val:
            _log.debug("OpenRouter API key found in database.")
            return val
        env_key = os.environ.get("OPENROUTER_API_KEY")
        if env_key:
            _log.debug("OpenRouter API key falling back to environment variable.")
        return env_key
    except sqlalchemy.exc.SQLAlchemyError:
        _log.warning("Could not read OpenRouter API key from DB; falling back to env.")
        return os.environ.get("OPENROUTER_API_KEY")
    finally:
        db.close()


def _get_openrouter_model():
    db = SessionLocal()
    try:
        setting = db.query(AppSettings).filter_by(key="openrouter_model").first()
        return (
            setting.value
            if setting
            else os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
        )
    except sqlalchemy.exc.SQLAlchemyError:
        _log.warning("Could not read OpenRouter model from DB; falling back to env.")
        return os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
    finally:
        db.close()


def get_chat_client():
    """Returns callable(messages: list[dict]) -> tuple[bool, str] for conversational chat."""
    db_provider = _read_provider_from_db()

    provider = (db_provider or os.environ.get("LLM_PROVIDER", "ollama")).lower()

    if provider == "openrouter":
        api_key = _get_api_key()
        if not api_key:
            return lambda messages: (False, "OpenRouter API key not configured")
        import src.domain.ai.openrouter_client as openrouter_client

        model = _get_openrouter_model()
        return openrouter_client.OpenRouterClient(api_key=api_key, model=model).chat
    else:
        import src.domain.ai.ollama_client as ollama_client

        return ollama_client.chat_completion


def get_extractor() -> Callable[[str, str], tuple[bool, dict | str]]:
    db_provider = _read_provider_from_db()

    if db_provider:
        db_p = db_provider.lower()
        if db_p == "openrouter":
            api_key = _get_api_key()
            if not api_key:
                return lambda text, project_id: (
                    False,
                    "OpenRouter API key not configured",
                )
            import src.domain.ai.openrouter_client as openrouter_client

            model = _get_openrouter_model()

            return openrouter_client.OpenRouterClient(api_key=api_key, model=model)
        elif db_p == "ollama":
            import src.domain.ai.ollama_client as ollama_client

            return ollama_client.extract_entities_from_text

    env_provider = os.environ.get("LLM_PROVIDER", "ollama").lower()
    if env_provider == "openrouter":
        api_key = _get_api_key()
        if not api_key:
            return lambda text, project_id: (False, "OpenRouter API key not configured")
        import src.domain.ai.openrouter_client as openrouter_client

        model = _get_openrouter_model()

        return openrouter_client.OpenRouterClient(api_key=api_key, model=model)
    elif env_provider == "ollama":
        import src.domain.ai.ollama_client as ollama_client

        return ollama_client.extract_entities_from_text
    else:
        raise ValueError(f"Unknown LLM_PROVIDER: {env_provider}")
