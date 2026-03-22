import logging
import os
from time import time
from typing import Any, Dict, List
import json

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.data import models
from src.data.database import engine, get_db
from src.domain import schemas
from src.domain.ai.provider import (
    get_chat_client,
    _get_api_key,
    _get_openrouter_model,
)
from src.domain.ai.constants import CHAT_SYSTEM_PROMPT
from src.domain.parsers.bulk_ingestion import process_directory
from src.domain.parsers.nmap_parser import process_nmap_file
from src.domain.reports.generator import generate_markdown_report
from src.domain.checklist_data import INITIAL_CHECKLIST
from src.domain.ai import nvd_client
from src.domain.notes_logic import auto_link_note
from src.domain.reports.sync import sync_note_to_report
import httpx

# ---------------------------------------------------------------------------
# Global State/Cache
# ---------------------------------------------------------------------------
_openrouter_models_cache: Dict[str, Any] = {"data": None, "timestamp": 0.0}


# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------


def _populate_checklist(project_id: str, db: Session):
    for item in INITIAL_CHECKLIST:
        db_item = models.ChecklistItem(
            project_id=project_id,
            wstg_id=item["wstg_id"],
            title=item["title"],
            category=item["category"],
            status="pending",
            notes="",
        )
        db.add(db_item)
    db.commit()


# Initialise DB tables
models.Base.metadata.create_all(bind=engine)


def _migrate_report_notes_to_notes(db) -> int:
    """Migra ChatMessages com role='report_note' para Notes. Idempotente."""
    report_notes = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.role == "report_note")
        .all()
    )
    count = 0
    for msg in report_notes:
        note = models.Note(
            project_id=msg.project_id,
            title=f"Report note ({msg.created_at.strftime('%Y-%m-%d %H:%M')})",
            body=msg.content,
            tags="[]",
            status="verified",
            linked_node_id=None,
        )
        db.add(note)
        db.delete(msg)
        count += 1
    if count:
        db.commit()
    return count


app = FastAPI(title="PwnCortex API")


@app.on_event("startup")
def on_startup():
    from src.data.database import SessionLocal as _SL

    db = _SL()
    try:
        count = _migrate_report_notes_to_notes(db)
        if count:
            logging.info(f"[startup] Migrated {count} report_notes to Notes.")
    except Exception:
        logging.exception("[startup] Migration failed.")
    finally:
        db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler to prevent leaking internal stack traces."""
    import logging

    logging.exception(f"Unhandled error at {request.url.path}: {exc}")
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error. Please contact administrator.",
            "success": False,
        },
    )


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


@app.get("/")
def read_root():
    return {"status": "System Ready", "message": "PwnCortex API Online"}


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


@app.post("/projects/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    _populate_checklist(db_project.id, db)
    return db_project


@app.get("/projects/", response_model=List[schemas.ProjectResponse])
def list_projects(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Project).offset(skip).limit(limit).all()


@app.get("/projects/{project_id}", response_model=schemas.ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/projects/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}


# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------


@app.post("/projects/{project_id}/nodes/", response_model=schemas.NodeResponse)
def create_node(
    project_id: str, node: schemas.NodeCreate, db: Session = Depends(get_db)
):
    db_node = models.Node(**node.model_dump(), project_id=project_id)
    db.add(db_node)
    db.commit()
    db.refresh(db_node)
    return db_node


@app.get("/projects/{project_id}/nodes/", response_model=List[schemas.NodeResponse])
def list_project_nodes(project_id: str, db: Session = Depends(get_db)):
    return db.query(models.Node).filter(models.Node.project_id == project_id).all()


# ---------------------------------------------------------------------------
# Graph (Cytoscape)
# ---------------------------------------------------------------------------


@app.get("/projects/{project_id}/graph")
def get_project_graph(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    nodes = db.query(models.Node).filter(models.Node.project_id == project_id).all()

    elements = [
        {
            "data": {
                "id": f"proj_{project_id}",
                "label": project.name,  # Use full project name
                "type": "project",
            }
        }
    ]

    for node in nodes:
        node_id_str = f"node_{node.id}"
        elements.append(
            {
                "data": {
                    "id": node_id_str,
                    "label": node.ip_address,  # TC-02: label must be IP
                    "hostname": node.hostname,
                    "os_info": node.os_info,
                    "risk_level": node.risk_level,
                    "type": "host",
                    "db_id": node.id,
                    "ports": [
                        {
                            "port_number": p.port_number,
                            "protocol": p.protocol,
                            "service": p.service,
                            "version": p.version,
                            "state": p.state,
                            "reason": p.reason,
                            "product": p.product,
                            "extrainfo": p.extrainfo,
                            "cpe": p.cpe,
                            "scripts": p.scripts,
                        }
                        for p in node.ports
                    ],
                    "vulnerabilities": [
                        {
                            "name": v.name,
                            "severity": v.severity,
                            "description": v.description,
                            "cve": v.cve,
                            "cvss_score": v.cvss_score,
                            "service_port": v.service_port,
                        }
                        for v in node.vulnerabilities
                    ],
                }
            }
        )
        elements.append(
            {
                "data": {
                    "id": f"edge_proj_{project_id}_{node_id_str}",
                    "source": f"proj_{project_id}",
                    "target": node_id_str,
                }
            }
        )

    return {"elements": elements}


# ---------------------------------------------------------------------------
# File Upload / Ingestion
# ---------------------------------------------------------------------------


@app.post(
    "/projects/{project_id}/upload",
    response_model=schemas.UploadResult,
    status_code=201,
)
async def upload_unified(
    project_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # SEC-11: enforce upload size limit (10 MB)
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 10 MB.")
    filename = file.filename.lower()

    result = schemas.UploadResult(
        filename=file.filename,
        file_type="unsupported",
        hosts_added=0,
        ports_added=0,
        vulns_added=0,
        notes_created=0,
        message="",
    )

    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    safe_filename = os.path.basename(file.filename)  # SEC-02: prevent path traversal
    temp_path = os.path.join(upload_dir, safe_filename)
    with open(temp_path, "wb") as buf:
        buf.write(content)

    if filename.endswith(".xml"):
        result.file_type = "nmap_xml"
        background_tasks.add_task(process_nmap_file, temp_path, project_id)
        result.message = "Nmap XML received. Processing in background."
    elif filename.endswith(".txt") or filename.endswith(".md"):
        result.file_type = "text" if filename.endswith(".txt") else "markdown"
        text_content = content.decode("utf-8", errors="ignore")
        note = models.Note(
            project_id=project_id,
            title=f"Imported notes from {file.filename}",
            body=text_content,
            status="draft",
        )
        db.add(note)
        db.commit()
        db.refresh(note)
        auto_link_note(note, project_id, db)
        db.commit()
        result.notes_created = 1
        result.message = "Text note created and linked to existing hosts if any."
    elif filename.endswith(".json"):
        result.file_type = "json"
        try:
            data = json.loads(content.decode("utf-8"))
            hosts = data.get("hosts", [])
            for h in hosts:
                ip = h.get("ip")
                if ip:
                    db_node = (
                        db.query(models.Node)
                        .filter_by(project_id=project_id, ip_address=ip)
                        .first()
                    )
                    if not db_node:
                        db_node = models.Node(project_id=project_id, ip_address=ip)
                        db.add(db_node)
                        result.hosts_added += 1
                        db.commit()
                        db.refresh(db_node)
                    else:
                        # If node exists, we should still invalidate its explanation
                        # as new data might be coming in JSON in the future
                        # (even if currently we only check for IP)
                        db_exp = (
                            db.query(models.NodeExplanation)
                            .filter_by(node_id=db_node.id)
                            .first()
                        )
                        if db_exp:
                            db_exp.invalidated = True
            db.commit()
            result.message = "JSON hosts imported."
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            import logging

            logging.exception("JSON Upload Error")
            raise HTTPException(
                status_code=422, detail=f"Invalid JSON format: {str(exc)}"
            )
        except Exception:
            import logging

            logging.exception("Unified Upload General Error")
            raise HTTPException(status_code=422, detail="Error processing file")
    else:
        result.message = "Unsupported file type."

    return result


class IngestFolderRequest(BaseModel):
    base_path: str


@app.post("/projects/{project_id}/ingest-folder/")
def ingest_project_folder(
    project_id: str,
    payload: IngestFolderRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # SEC-01: confine base_path to the uploads directory to prevent path traversal
    allowed_root = os.path.realpath(
        os.path.join(os.path.dirname(__file__), "..", "..", "uploads")
    )
    real_path = os.path.realpath(payload.base_path)
    if not real_path.startswith(allowed_root + os.sep) and real_path != allowed_root:
        raise HTTPException(
            status_code=400,
            detail="base_path must be inside the uploads directory.",
        )
    if not os.path.exists(real_path):
        raise HTTPException(
            status_code=400, detail="base_path does not exist on server"
        )

    background_tasks.add_task(process_directory, real_path, project_id)
    return {"message": f"Bulk ingestion started for {real_path}"}


# ---------------------------------------------------------------------------
# AI Notes
# ---------------------------------------------------------------------------


@app.post(
    "/projects/{project_id}/notes", response_model=schemas.NoteOut, status_code=201
)
def create_note(
    project_id: str, note_in: schemas.NoteCreate, db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # SEC-09: validate linked_node_id belongs to this project
    if note_in.linked_node_id is not None:
        node_check = (
            db.query(models.Node)
            .filter(models.Node.id == note_in.linked_node_id, models.Node.project_id == project_id)
            .first()
        )
        if not node_check:
            raise HTTPException(status_code=400, detail="linked_node_id does not belong to this project")

    new_note = models.Note(
        project_id=project_id,
        title=note_in.title,
        body=note_in.body,
        status=note_in.status,
        tags=json.dumps(note_in.tags) if note_in.tags else "[]",
        linked_node_id=note_in.linked_node_id,
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    if new_note.linked_node_id is None:
        auto_link_note(new_note, project_id, db)
        db.commit()
        db.refresh(new_note)

    return {**new_note.__dict__, "tags": json.loads(new_note.tags)}


@app.get("/projects/{project_id}/notes", response_model=List[schemas.NoteOut])
def list_notes(
    project_id: str,
    status: str = None,
    node_id: int = None,
    q: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(models.Note).filter(models.Note.project_id == project_id)
    if status is not None:
        query = query.filter(models.Note.status == status)
    if node_id is not None:
        query = query.filter(models.Note.linked_node_id == node_id)
    if q is not None and q.strip() != "":
        # SEC-10: escape LIKE wildcards to prevent wildcard injection
        q_safe = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.filter(models.Note.body.like(f"%{q_safe}%", escape="\\"))

    notes = query.order_by(models.Note.created_at.desc()).all()
    res = []
    for n in notes:
        d = dict(n.__dict__)
        d["tags"] = json.loads(n.tags) if n.tags else []
        res.append(d)
    return res


@app.patch("/projects/{project_id}/notes/{note_id}", response_model=schemas.NoteOut)
def update_note(
    project_id: str,
    note_id: str,
    note_upd: schemas.NoteUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.project_id == project_id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    body_changed = False

    if note_upd.title is not None:
        note.title = note_upd.title
    if note_upd.body is not None:
        note.body = note_upd.body
        body_changed = True
    if note_upd.tags is not None:
        note.tags = json.dumps(note_upd.tags)
    if note_upd.status is not None:
        note.status = note_upd.status

    if body_changed:
        note.linked_node_id = None
        auto_link_note(note, project_id, db)

    db.commit()
    db.refresh(note)

    if note.status == "verified":
        background_tasks.add_task(sync_note_to_report, project_id, note.id)

    return {**note.__dict__, "tags": json.loads(note.tags)}


@app.delete("/projects/{project_id}/notes/{note_id}")
def delete_note(project_id: str, note_id: str, db: Session = Depends(get_db)):
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.project_id == project_id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"message": "Note deleted"}


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


@app.get("/projects/{project_id}/report")
def get_project_report(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    report_md = generate_markdown_report(project)
    return {"markdown": report_md}


# ---------------------------------------------------------------------------
# Scans & CVE Discovery
# ---------------------------------------------------------------------------


@app.get("/projects/{project_id}/report/draft", response_model=schemas.ReportDraftOut)
def get_report_draft(project_id: str, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "project_id": project.id,
        "draft": project.report_draft,
        "last_synced_at": project.report_draft_synced_at,
    }


@app.post("/projects/{project_id}/report/sync")
def sync_project_report(
    project_id: str, background_tasks: BackgroundTasks, db: Session = Depends(get_db)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # trigger syncs for all verified notes? Spec says " POST /projects/{id}/report/sync -> Aciona sync de notas verified -> relatório (background)"
    verified_notes = (
        db.query(models.Note)
        .filter(models.Note.project_id == project_id, models.Note.status == "verified")
        .all()
    )
    for n in verified_notes:
        background_tasks.add_task(sync_note_to_report, project_id, n.id)

    return {"message": "Sync enqueued"}


@app.post(
    "/projects/{project_id}/nodes/{node_id}/explain",
    response_model=schemas.NodeExplainOut,
)
def explain_node(project_id: str, node_id: int, db: Session = Depends(get_db)):
    node = (
        db.query(models.Node)
        .filter(models.Node.id == node_id, models.Node.project_id == project_id)
        .first()
    )
    if not node:
        raise HTTPException(status_code=404, detail="Node not found in project")

    explanation = (
        db.query(models.NodeExplanation)
        .filter(models.NodeExplanation.node_id == node_id)
        .first()
    )

    if not explanation or explanation.invalidated:
        chat_client = get_chat_client()

        ports_info = ", ".join(
            [
                f"{p.port_number}/{p.protocol} ({p.service})"
                for p in node.ports
                if p.state == "open"
            ]
        )
        vulns_info = ", ".join([v.name for v in node.vulnerabilities])

        prompt = f"Explique por que o nó {node.ip_address} ({node.os_info}) com as portas {ports_info} e as vulnerabilidades {vulns_info} é crítico."
        messages = [{"role": "user", "content": prompt}]
        success, response = chat_client(messages)

        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"LLM unavailable: {response}",
            )

        if not explanation:
            explanation = models.NodeExplanation(node_id=node_id, explanation=str(response))
            db.add(explanation)
        else:
            explanation.explanation = str(response)
            explanation.invalidated = False

        db.commit()
        db.refresh(explanation)

    return {
        "node_id": explanation.node_id,
        "explanation": explanation.explanation,
        "generated_at": explanation.generated_at,
        "is_stale": explanation.invalidated,
    }


# ---------------------------------------------------------------------------
# Pentest Checklist (R3)
# ---------------------------------------------------------------------------


@app.get(
    "/projects/{project_id}/checklist/",
    response_model=List[schemas.ChecklistItemResponse],
)
def get_project_checklist(project_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.ChecklistItem)
        .filter(models.ChecklistItem.project_id == project_id)
        .all()
    )


@app.put(
    "/projects/{project_id}/checklist/{item_id}/",
    response_model=schemas.ChecklistItemResponse,
)
def update_checklist_item(
    project_id: str,
    item_id: str,
    update: schemas.ChecklistItemUpdate,
    db: Session = Depends(get_db),
):
    db_item = (
        db.query(models.ChecklistItem)
        .filter(
            models.ChecklistItem.project_id == project_id,
            models.ChecklistItem.id == item_id,
        )
        .first()
    )
    if not db_item:
        # Try by wstg_id if id is not found (convenience)
        db_item = (
            db.query(models.ChecklistItem)
            .filter(
                models.ChecklistItem.project_id == project_id,
                models.ChecklistItem.wstg_id == item_id,
            )
            .first()
        )

    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    if update.status is not None:
        db_item.status = update.status
    if update.notes is not None:
        db_item.notes = update.notes

    db.commit()
    db.refresh(db_item)
    return db_item


@app.post("/projects/{project_id}/checklist/reset/")
def reset_project_checklist(project_id: str, db: Session = Depends(get_db)):
    db.query(models.ChecklistItem).filter(
        models.ChecklistItem.project_id == project_id
    ).update({"status": "pending", "notes": ""})
    db.commit()
    return {"message": "Checklist reset"}


# ---------------------------------------------------------------------------
# OpenRouter Models (R4)
# ---------------------------------------------------------------------------


@app.get(
    "/settings/llm/openrouter-models/",
    response_model=List[schemas.OpenRouterModelResponse],
)
async def get_openrouter_models():
    if _openrouter_models_cache["data"] and (
        time() - _openrouter_models_cache["timestamp"] < 3600
    ):
        return _openrouter_models_cache["data"]

    # Try to fetch from OpenRouter
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://openrouter.ai/api/v1/models", timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                models_list = []
                for m in data.get("data", []):
                    models_list.append(
                        {
                            "id": m["id"],
                            "name": m["name"],
                            "provider": m.get("id", "").split("/")[0]
                            if "/" in m["id"]
                            else "other",
                        }
                    )
                _openrouter_models_cache["data"] = models_list
                _openrouter_models_cache["timestamp"] = time()
                return models_list
    except Exception as e:
        logging.warning("Failed to fetch OpenRouter models: %s", e)

    # Fallback list
    fallback = [
        {
            "id": "anthropic/claude-3.5-haiku",
            "name": "Claude 3.5 Haiku",
            "provider": "anthropic",
        },
        {
            "id": "anthropic/claude-3-sonnet",
            "name": "Claude 3 Sonnet",
            "provider": "anthropic",
        },
        {"id": "google/gemini-pro-1.5", "name": "Gemini Pro 1.5", "provider": "google"},
        {
            "id": "meta-llama/llama-3.1-405b",
            "name": "Llama 3.1 405B",
            "provider": "meta",
        },
    ]
    return fallback


# ---------------------------------------------------------------------------
# ChatBot AI (R6/R7)
# ---------------------------------------------------------------------------


@app.get(
    "/projects/{project_id}/chat/", response_model=List[schemas.ChatMessageResponse]
)
def get_chat_history(project_id: str, db: Session = Depends(get_db)):
    return (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.project_id == project_id)
        .order_by(models.ChatMessage.created_at.asc())
        .all()
    )


@app.post("/projects/{project_id}/chat/", response_model=schemas.ChatMessageResponse)
async def chat_with_ai(
    project_id: str,
    msg: schemas.ChatMessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # 1. Store user message
    user_msg = models.ChatMessage(
        project_id=project_id, role="user", content=msg.content
    )
    db.add(user_msg)
    db.commit()
    db.refresh(user_msg)

    # 2. Get conversation history (last 10 messages)
    history = (
        db.query(models.ChatMessage)
        .filter(
            models.ChatMessage.project_id == project_id,
            models.ChatMessage.role.in_(["user", "assistant"]),
        )
        .order_by(models.ChatMessage.created_at.desc())
        .limit(11)
        .all()
    )
    history.reverse()

    # 3. Build findings context
    nodes = db.query(models.Node).filter(models.Node.project_id == project_id).all()
    findings_lines = []
    for node in nodes:
        findings_lines.append(
            f"- Host: {node.ip_address} ({node.hostname or 'no hostname'})"
        )
        for port in node.ports:
            if port.state == "open":
                findings_lines.append(
                    f"  - Port {port.port_number}/{port.protocol}: {port.service or '?'} {port.version or ''}"
                )
        for vuln in node.vulnerabilities:
            findings_lines.append(
                f"  - [{vuln.severity}] {vuln.name}: {vuln.description}"
            )
    findings_summary = (
        "\n".join(findings_lines) if findings_lines else "No hosts discovered yet."
    )

    # 4. Build messages list
    chat_client = get_chat_client()
    if not chat_client:
        raise HTTPException(status_code=500, detail="LLM Provider not configured")

    system_content = (
        CHAT_SYSTEM_PROMPT + f"\n\nCurrent project findings:\n{findings_summary}"
    )
    messages: list = [{"role": "system", "content": system_content}]
    for h in history[:-1]:  # exclude the current message we just stored
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": msg.content})

    # 5. Call AI
    success, ai_response = chat_client(messages)
    if not success:
        raise HTTPException(status_code=500, detail=ai_response)

    # 6. Store AI response
    ai_msg = models.ChatMessage(
        project_id=project_id, role="assistant", content=str(ai_response)
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)

    return ai_msg


@app.delete("/projects/{project_id}/chat/")
def clear_chat_history(project_id: str, db: Session = Depends(get_db)):
    db.query(models.ChatMessage).filter(
        models.ChatMessage.project_id == project_id
    ).delete()
    db.commit()
    return {"message": "Chat history cleared"}


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------


@app.get("/settings/llm", response_model=schemas.LLMSettingsResponse)
def get_llm_settings(db: Session = Depends(get_db)):
    settings = {s.key: s.value for s in db.query(models.AppSettings).all()}
    return schemas.LLMSettingsResponse(
        provider=settings.get("llm_provider", "ollama"),
        ollama_model=settings.get("ollama_model", "qwen2.5:3b"),
        openrouter_api_key_set=bool(settings.get("openrouter_api_key")),
        openrouter_model=settings.get("openrouter_model", "anthropic/claude-3.5-haiku"),
    )


@app.put("/settings/llm", response_model=schemas.LLMSettingsResponse)
def update_llm_settings(
    payload: schemas.LLMSettingsUpdate, db: Session = Depends(get_db)
):
    if payload.provider == "openrouter":
        current_key = (
            db.query(models.AppSettings).filter_by(key="openrouter_api_key").first()
        )
        # Strip key to reject empty/whitespace keys
        stripped_key = (
            payload.openrouter_api_key.strip() if payload.openrouter_api_key else ""
        )
        if not stripped_key and (not current_key or not current_key.value):
            raise HTTPException(
                status_code=400, detail="API key is required for OpenRouter"
            )

    settings_to_update = {
        "llm_provider": payload.provider,
        "ollama_model": payload.ollama_model,
        "openrouter_model": payload.openrouter_model,
    }

    if payload.openrouter_api_key:
        settings_to_update["openrouter_api_key"] = payload.openrouter_api_key

    for k, v in settings_to_update.items():
        if v is not None:
            setting = db.query(models.AppSettings).filter_by(key=k).first()
            if setting:
                setting.value = v
            else:
                db.add(models.AppSettings(key=k, value=v))
    db.commit()

    settings_list = db.query(models.AppSettings).all()
    settings = {s.key: s.value for s in settings_list}
    return schemas.LLMSettingsResponse(
        provider=settings.get("llm_provider", "ollama"),
        ollama_model=settings.get("ollama_model", "qwen2.5:3b"),
        openrouter_api_key_set=bool(settings.get("openrouter_api_key")),
        openrouter_model=settings.get("openrouter_model", "anthropic/claude-3.5-haiku"),
    )


@app.post("/settings/llm/test")
async def test_llm_connection(req: schemas.LLMTestRequest = None):
    if req is None:
        req = schemas.LLMTestRequest()
    try:
        provider = (req.provider or "").lower()

        if provider == "ollama":
            import src.domain.ai.ollama_client as ollama_module

            chat_client = ollama_module.chat_completion
        elif provider == "openrouter":
            api_key = (req.openrouter_api_key or "").strip() or _get_api_key()
            if not api_key:
                return {
                    "success": False,
                    "message": "OpenRouter API key not configured",
                }
            model = req.openrouter_model or _get_openrouter_model()
            import src.domain.ai.openrouter_client as openrouter_module

            chat_client = openrouter_module.OpenRouterClient(
                api_key=api_key, model=model
            ).chat
        else:
            # fallback: use DB-configured provider
            chat_client = get_chat_client()

        messages = [
            {"role": "system", "content": "Reply with only the word: OK"},
            {"role": "user", "content": "ping"},
        ]
        success, response = chat_client(messages)
        if success:
            return {
                "success": True,
                "message": f"Connected. Response: {str(response)[:120]}",
            }
        return {"success": False, "message": str(response)}
    except Exception:
        logging.exception("test_llm_connection failed")
        return {"success": False, "message": "Connection failed. Check provider settings and server logs."}
