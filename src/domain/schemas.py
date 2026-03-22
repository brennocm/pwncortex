from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime


class VulnerabilityBase(BaseModel):
    cve: Optional[str] = None
    cvss_score: Optional[float] = None
    service_port: Optional[int] = None
    name: str
    description: Optional[str] = None
    severity: str


class VulnerabilityResponse(VulnerabilityBase):
    id: int
    node_id: int

    model_config = ConfigDict(from_attributes=True)


class ChecklistItemBase(BaseModel):
    wstg_id: str
    title: str
    category: str
    status: str = "pending"
    notes: Optional[str] = None


class ChecklistItemUpdate(BaseModel):
    status: Optional[Literal["pending", "in_progress", "done", "n/a"]] = None
    notes: Optional[str] = None


class ChecklistItemResponse(ChecklistItemBase):
    id: str
    project_id: str

    model_config = ConfigDict(from_attributes=True)


class ChatMessageBase(BaseModel):
    role: Literal["user", "assistant", "system", "report_note"]
    content: str


class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1)


class ChatMessageResponse(ChatMessageBase):
    id: str
    project_id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpenRouterModelResponse(BaseModel):
    id: str
    name: str
    provider: str


class PortBase(BaseModel):
    port_number: int
    protocol: str
    state: Optional[str] = "open"
    reason: Optional[str] = None
    service: Optional[str] = None
    product: Optional[str] = None
    version: Optional[str] = None
    extrainfo: Optional[str] = None
    cpe: Optional[str] = None
    scripts: Optional[str] = None  # JSON string or plain text


class PortResponse(PortBase):
    id: int
    node_id: int

    model_config = ConfigDict(from_attributes=True)


class NodeBase(BaseModel):
    ip_address: str
    hostname: Optional[str] = None
    os_info: Optional[str] = None
    notes: Optional[str] = None
    risk_level: str = "Low"


class NodeCreate(NodeBase):
    pass


class NodeResponse(NodeBase):
    id: int
    project_id: str
    ports: List[PortResponse] = []
    vulnerabilities: List[VulnerabilityResponse] = []

    model_config = ConfigDict(from_attributes=True)


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: str
    status: str
    created_at: datetime
    nodes: List[NodeResponse] = []

    model_config = ConfigDict(from_attributes=True)


class LLMSettingsUpdate(BaseModel):
    provider: Literal["ollama", "openrouter"]
    ollama_model: Optional[str] = "qwen2.5:3b"
    openrouter_api_key: Optional[str] = None
    openrouter_model: Optional[str] = "anthropic/claude-3.5-haiku"


class LLMTestRequest(BaseModel):
    provider: Optional[Literal["ollama", "openrouter"]] = None
    ollama_model: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    openrouter_model: Optional[str] = None


class LLMSettingsResponse(BaseModel):
    provider: str
    ollama_model: str
    openrouter_api_key_set: bool
    openrouter_model: str


class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1)
    body: str
    tags: List[str] = []
    status: Literal["draft", "verified", "reported"] = "draft"
    linked_node_id: Optional[int] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[Literal["draft", "verified", "reported"]] = None


class NoteOut(BaseModel):
    id: str
    project_id: str
    title: str
    body: str
    tags: List[str]
    status: str
    linked_node_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ReportDraftOut(BaseModel):
    project_id: str
    draft: Optional[str] = None
    last_synced_at: Optional[datetime] = None


class NodeExplainOut(BaseModel):
    node_id: int
    explanation: str
    generated_at: datetime
    is_stale: bool


class UploadResult(BaseModel):
    filename: str
    file_type: Literal["nmap_xml", "json", "text", "markdown", "unsupported"]
    hosts_added: int
    ports_added: int
    vulns_added: int
    notes_created: int
    message: str
