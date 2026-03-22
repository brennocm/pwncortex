import os

from src.data import models
from src.data.database import SessionLocal
from src.domain.parsers.nmap_parser import process_nmap_file
from src.domain.ai.provider import get_extractor


def process_directory(base_path: str, project_id: str) -> None:
    """
    Walks base_path looking for a sub-directory named after the project,
    then routes each file to the appropriate parser.
    """
    db = SessionLocal()
    try:
        project = (
            db.query(models.Project).filter(models.Project.id == project_id).first()
        )
        if not project:
            print(f"[bulk_ingestion] project {project_id} not found")
            return

        target_dir = ""
        for root, dirs, _ in os.walk(base_path):
            if project.name in dirs:
                target_dir = os.path.join(root, project.name)
                break

        if not target_dir:
            print(
                f"[bulk_ingestion] no folder named '{project.name}' under {base_path}"
            )
            return

        print(f"[bulk_ingestion] starting for {project.name} at {target_dir}")

        for root, _, files in os.walk(target_dir):
            for file in files:
                file_path = os.path.join(root, file)

                if file.endswith(".xml"):
                    print(f"[bulk_ingestion] nmap → {file_path}")
                    process_nmap_file(file_path, project_id)

                elif file.endswith((".txt", ".md", ".json", ".log")):
                    print(f"[bulk_ingestion] ai → {file_path}")
                    try:
                        with open(file_path, encoding="utf-8") as f:
                            content = f.read()
                        success, result = get_extractor()(content, project_id)
                        if not success:
                            print(f"[bulk_ingestion] ai failed for {file}: {result}")
                    except Exception as exc:
                        print(f"[bulk_ingestion] error reading {file_path}: {exc}")

        print(f"[bulk_ingestion] completed project {project_id}")
    finally:
        db.close()
