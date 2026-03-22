import logging
from src.data import models
from sqlalchemy.orm import Session


def persist_extracted_entities(
    data: dict,
    original_text: str,
    project_id: str,
    db: Session,
    client_name: str = "ai",
) -> None:
    """
    Shared logic to persist AI-extracted hosts/vulnerabilities.
    Invalidates NodeExplanation cache when new data is added.
    """
    ip_addr = data.get("ip_address")
    if not ip_addr:
        return

    node = (
        db.query(models.Node)
        .filter(
            models.Node.project_id == project_id,
            models.Node.ip_address == ip_addr,
        )
        .first()
    )

    if not node:
        node = models.Node(
            project_id=project_id,
            ip_address=ip_addr,
            hostname=data.get("hostname"),
            notes=f"AI Extracted from note: {original_text[:100]}...",
        )
        db.add(node)
        db.commit()
        db.refresh(node)
        logging.info(f"[{client_name}] Created new node {ip_addr}")
    else:
        node.notes = (node.notes or "") + f"\nAI Note: {original_text[:100]}..."
        if data.get("hostname") and not node.hostname:
            node.hostname = data.get("hostname")
        # Invalidate explanation cache since new context is added
        db_exp = db.query(models.NodeExplanation).filter_by(node_id=node.id).first()
        if db_exp:
            db_exp.invalidated = True
        db.commit()

    vulns_added = 0
    for v in data.get("vulnerabilities", []):
        vuln = models.Vulnerability(
            node_id=node.id,
            name=v.get("name", "Unknown Vuln"),
            severity=v.get("severity", "Medium"),
            description=v.get("description", ""),
        )
        db.add(vuln)
        vulns_added += 1

        # Risk escalation
        if vuln.severity == "Critical":
            node.risk_level = "Critical"
        elif vuln.severity == "High" and node.risk_level != "Critical":
            node.risk_level = "High"

    if vulns_added > 0:
        # Invalidate explanation cache again if vulns were added
        db_exp = db.query(models.NodeExplanation).filter_by(node_id=node.id).first()
        if db_exp:
            db_exp.invalidated = True
        db.commit()

    logging.info(
        f"[{client_name}] Persisted extraction for {ip_addr} (vulns: {vulns_added})"
    )
