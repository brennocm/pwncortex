import re
import json
from sqlalchemy.orm import Session
from src.data.models import Node, Note

_IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def auto_link_note(note: Note, project_id: str, db: Session) -> None:
    """Extrai IPs do body e vincula ao primeiro nó encontrado no projeto."""
    if not note.body:
        return

    ips = _IP_RE.findall(note.body)
    extra_tags = []
    linked = False
    for ip in ips:
        node = db.query(Node).filter_by(project_id=project_id, ip_address=ip).first()
        if node and not linked:
            note.linked_node_id = node.id
            linked = True
        elif node:
            extra_tags.append(f"host:{ip}")

    # Merge extra_tags into existing tags (sem duplicar)
    existing = set()
    if note.tags:
        try:
            existing = set(json.loads(note.tags))
        except json.JSONDecodeError:
            pass

    existing.update(extra_tags)
    note.tags = json.dumps(sorted(existing))
