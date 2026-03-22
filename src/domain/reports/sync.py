import datetime
import logging
from src.data.database import SessionLocal
from src.data.models import Project, Note
from src.domain.ai.provider import get_chat_client

_log = logging.getLogger(__name__)


def sync_note_to_report(project_id: str, note_id: str, db=None) -> bool:
    """Sincroniza uma nota verified incrementalmente com o report draft do projeto.

    Sempre cria sua própria sessão de DB para funcionar corretamente em background tasks
    (a sessão do request pode estar fechada quando a task executa).
    """
    _own_db = db is None
    if _own_db:
        db = SessionLocal()

    try:
        note = (
            db.query(Note).filter(Note.id == note_id, Note.project_id == project_id).first()
        )
        if not note or note.status != "verified":
            return False

        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            return False

        draft = project.report_draft or ""

        chat_client = get_chat_client()

        # Try LLM first; fall back to simple append if unavailable
        context = f"Report Draft:\n{draft}\n\nNew Verified Note:\nTitle: {note.title}\nBody: {note.body}"
        prompt = "Incorpore o achado abaixo ao relatório draft, mantendo coesão executiva e preservando seções existentes. Se a seção 'Operator Notes Summary' não existir, crie-a."
        messages = [
            {"role": "system", "content": prompt},
            {"role": "user", "content": context},
        ]
        success, response = chat_client(messages)

        if success:
            project.report_draft = str(response)
        else:
            _log.warning(f"LLM sync failed for note {note_id}: {response}. Falling back to append.")
            if "## Operator Notes Summary" not in draft:
                draft += "\n\n## Operator Notes Summary\n\n"
            draft += f"- **{note.title}**: {note.body}\n"
            project.report_draft = draft

        project.report_draft_synced_at = datetime.datetime.utcnow()
        db.commit()
        return True
    except Exception:
        _log.exception(f"sync_note_to_report failed for note {note_id}")
        return False
    finally:
        if _own_db:
            db.close()
