import json

from libnmap.parser import NmapParser

from src.data import models
from src.data.database import SessionLocal


def process_nmap_file(file_path: str, project_id: str) -> None:
    """Parses an Nmap XML file and persists hosts/ports to the database."""
    db = SessionLocal()
    try:
        try:
            nmap_report = NmapParser.parse_fromfile(file_path)
        except Exception as exc:
            print(f"[nmap_parser] failed to parse {file_path}: {exc}")
            return

        for host in nmap_report.hosts:
            if host.status != "up":
                continue

            ip_address = host.address
            hostname = host.hostnames[0] if host.hostnames else None

            # Find or create node
            db_node = (
                db.query(models.Node)
                .filter(
                    models.Node.project_id == project_id,
                    models.Node.ip_address == ip_address,
                )
                .first()
            )

            if not db_node:
                db_node = models.Node(
                    project_id=project_id,
                    ip_address=ip_address,
                    hostname=hostname,
                    notes="Ingested from Nmap scan.",
                )
                db.add(db_node)
                db.commit()
                db.refresh(db_node)

            # Capture extraports summary to avoid data loss
            extraports_info = []
            if hasattr(host, "extraports") and host.extraports:
                for ep in host.extraports:
                    state = ep.get("state", "unknown")
                    count = ep.get("count", "0")
                    extraports_info.append(f"{count} ports are {state}")

            if extraports_info:
                ep_string = " | Extra Nmap info: " + ", ".join(extraports_info)
                db_node.notes = (db_node.notes or "") + ep_string
                db.commit()

            # Upsert ports
            for service in host.services:
                cpes = (
                    [c.cpestring for c in service.cpelist]
                    if hasattr(service, "cpelist")
                    else []
                )
                scripts_dict = (
                    service.scripts_results
                    if hasattr(service, "scripts_results")
                    else []
                )

                db_port = (
                    db.query(models.Port)
                    .filter(
                        models.Port.node_id == db_node.id,
                        models.Port.port_number == service.port,
                        models.Port.protocol == service.protocol,
                    )
                    .first()
                )

                port_data = dict(
                    node_id=db_node.id,
                    port_number=service.port,
                    protocol=service.protocol,
                    state=service.state,
                    reason=getattr(service, "reason", None),
                    service=service.service,
                    product=getattr(service, "product", None),
                    version=getattr(service, "version", None),
                    extrainfo=getattr(service, "extrainfo", None),
                    cpe=", ".join(cpes) if cpes else None,
                    scripts=json.dumps(scripts_dict) if scripts_dict else None,
                )

                if not db_port:
                    db.add(models.Port(**port_data))
                else:
                    for key, value in port_data.items():
                        setattr(db_port, key, value)

            # Invalidate explanation cache
            db_exp = (
                db.query(models.NodeExplanation).filter_by(node_id=db_node.id).first()
            )
            if db_exp:
                db_exp.invalidated = True

            db.commit()

        print(f"[nmap_parser] finished project {project_id}")
    finally:
        db.close()
