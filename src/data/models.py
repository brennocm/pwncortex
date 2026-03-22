from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    Float,
    Boolean,
)
from sqlalchemy.orm import relationship
import datetime
import uuid

from src.data.database import Base


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="Active")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    report_draft = Column(Text, nullable=True)
    report_draft_synced_at = Column(DateTime, nullable=True)
    nodes = relationship("Node", back_populates="project", cascade="all, delete")


class Node(Base):
    __tablename__ = "nodes"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    ip_address = Column(String, index=True)
    hostname = Column(String, nullable=True)
    os_info = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    risk_level = Column(String, default="Low")  # Low, Medium, High, Critical
    project = relationship("Project", back_populates="nodes")
    ports = relationship("Port", back_populates="node", cascade="all, delete")
    vulnerabilities = relationship(
        "Vulnerability", back_populates="node", cascade="all, delete"
    )


class Port(Base):
    __tablename__ = "ports"
    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("nodes.id"))
    port_number = Column(Integer)
    protocol = Column(String)  # tcp, udp
    state = Column(String, default="open")  # open, closed, filtered
    reason = Column(String, nullable=True)  # syn-ack, conn-refused, etc
    service = Column(String, nullable=True)
    product = Column(String, nullable=True)
    version = Column(String, nullable=True)
    extrainfo = Column(String, nullable=True)
    cpe = Column(String, nullable=True)
    scripts = Column(Text, nullable=True)  # JSON string with script results
    node = relationship("Node", back_populates="ports")


class Vulnerability(Base):
    __tablename__ = "vulnerabilities"
    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("nodes.id"))
    cve = Column(String, nullable=True)
    cvss_score = Column(Float, nullable=True)
    service_port = Column(Integer, nullable=True)
    name = Column(String)
    description = Column(Text, nullable=True)
    severity = Column(String)
    node = relationship("Node", back_populates="vulnerabilities")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    wstg_id = Column(String)
    title = Column(String)
    category = Column(String)  # Web, Network, AD, Infra
    status = Column(String, default="pending")  # pending, in_progress, done, n/a
    notes = Column(Text, nullable=True)
    project = relationship("Project")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    role = Column(String)  # user, assistant, system
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    project = relationship("Project")


class AppSettings(Base):
    __tablename__ = "app_settings"
    key = Column(String, primary_key=True)
    value = Column(String, nullable=True)


class Note(Base):
    __tablename__ = "notes"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()), index=True)
    project_id = Column(String, ForeignKey("projects.id"))
    title = Column(String)
    body = Column(Text)
    tags = Column(Text)  # JSON array of tags
    status = Column(String, default="draft")
    linked_node_id = Column(Integer, ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(
        DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow
    )
    project = relationship("Project")
    linked_node = relationship("Node")


class NodeExplanation(Base):
    __tablename__ = "node_explanations"
    id = Column(Integer, primary_key=True, index=True)
    node_id = Column(Integer, ForeignKey("nodes.id"), unique=True)
    explanation = Column(Text)
    generated_at = Column(DateTime, default=datetime.datetime.utcnow)
    invalidated = Column(Boolean, default=False)
