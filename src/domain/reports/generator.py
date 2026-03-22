import math
from src.data import models

# ── CVSS helpers ───────────────────────────────────────────────────────────────

# Fallback scores when cvss_score is absent in DB
_SEVERITY_DEFAULT_CVSS = {
    "critical": 9.5,
    "high": 7.5,
    "medium": 5.0,
    "low": 2.5,
    "unknown": 3.0,
}

# Business impact language keyed by severity
_BUSINESS_IMPACT = {
    "critical": (
        "Represents an **immediate, exploitable threat** to operations. "
        "A successful attack could result in complete system compromise, mass data exfiltration, "
        "ransomware deployment, or full service disruption. "
        "Regulatory penalties (GDPR, LGPD, PCI-DSS) and reputational damage are likely consequences."
    ),
    "high": (
        "Carries a **high probability of unauthorized access** or sensitive data exposure. "
        "Exploitation typically requires minimal attacker skill or prior access. "
        "Left unmitigated, these findings materially increase the risk of a reportable breach "
        "and potential compliance violations."
    ),
    "medium": (
        "Represents a **moderate risk** that may be exploited under specific conditions or in combination "
        "with other weaknesses (vulnerability chaining). These findings expand the attack surface and, "
        "if left unaddressed, may be escalated by a determined attacker."
    ),
    "low": (
        "Indicates **hardening gaps and best-practice deviations**. While unlikely to be exploited in "
        "isolation, these findings contribute to overall security debt and should be addressed as part "
        "of a continuous improvement programme."
    ),
}

# Remediation timeline guidance keyed by severity
_REMEDIATION_WINDOW = {
    "critical": (
        "0 – 48 hours",
        "Emergency patch/mitigate. Isolate affected systems if patch unavailable.",
    ),
    "high": (
        "≤ 2 weeks",
        "Prioritised patch cycle. Implement compensating controls immediately.",
    ),
    "medium": ("≤ 30 days", "Include in next scheduled maintenance window."),
    "low": ("≤ 90 days", "Address during hardening sprints or infrastructure reviews."),
}


def _effective_cvss(vuln: models.Vulnerability) -> float:
    """Return the CVSS score to use — stored value if available, otherwise severity-based default."""
    if vuln.cvss_score is not None:
        return float(vuln.cvss_score)
    return _SEVERITY_DEFAULT_CVSS.get((vuln.severity or "unknown").lower(), 3.0)


def _overall_risk_score(vulns: list) -> float:
    """
    Weighted CVSS aggregate:
      - Uses the square-root of the sum of squares to penalise clusters of high scores
        more than many low-score findings.
    Returns a value in [0, 10].
    """
    if not vulns:
        return 0.0
    scores = [_effective_cvss(v) for v in vulns]
    rss = math.sqrt(sum(s**2 for s in scores))
    # Normalise: cap at 10
    return round(
        min(
            rss / math.sqrt(len(scores))
            if len(scores) == 1
            else rss / math.sqrt(max(len(scores), 1)),
            10.0,
        ),
        1,
    )


def _posture_label(score: float) -> tuple:
    """Return (label, emoji, description) for a given risk score."""
    if score >= 9.0:
        return "CRITICAL", "🔴", "Immediate action required — active exploitation risk"
    if score >= 7.0:
        return "HIGH", "🟠", "Urgent remediation required — significant exposure"
    if score >= 4.0:
        return "MODERATE", "🟡", "Remediation required within standard SLA"
    if score >= 1.0:
        return "LOW", "🟢", "Hardening recommended — limited direct exposure"
    return "SECURE", "✅", "No significant vulnerabilities identified"


def _exposure_pct(nodes: list) -> int:
    """Percentage of hosts with at least one Critical or High vulnerability."""
    if not nodes:
        return 0
    exposed = sum(
        1
        for n in nodes
        if any(
            (v.severity or "").lower() in ("critical", "high")
            for v in n.vulnerabilities
        )
    )
    return round(exposed / len(nodes) * 100)


# ── Main generator ─────────────────────────────────────────────────────────────


def generate_markdown_report(project: models.Project) -> str:
    """Generates an executive-grade security assessment report."""
    if not project:
        return "# Report Error\nProject not found."

    nodes = project.nodes
    all_vulns = [v for n in nodes for v in n.vulnerabilities]
    total_open_ports = sum(1 for n in nodes for p in n.ports if p.state == "open")

    # Risk counts
    risk_counts: dict[str, int] = {
        "Critical": 0,
        "High": 0,
        "Medium": 0,
        "Low": 0,
        "Unknown": 0,
    }
    for v in all_vulns:
        key = v.severity if v.severity in risk_counts else "Unknown"
        risk_counts[key] += 1
    total_vulns = sum(risk_counts.values())

    # Aggregate CVSS metrics
    overall_score = _overall_risk_score(all_vulns)
    posture, posture_emoji, posture_desc = _posture_label(overall_score)
    exposure = _exposure_pct(nodes)
    avg_cvss = (
        round(sum(_effective_cvss(v) for v in all_vulns) / len(all_vulns), 1)
        if all_vulns
        else 0.0
    )
    max_cvss = round(max((_effective_cvss(v) for v in all_vulns), default=0.0), 1)

    lines = []

    # ══════════════════════════════════════════════════════════════════════════
    # COVER
    # ══════════════════════════════════════════════════════════════════════════
    lines += [
        "# Security Assessment Report",
        f"## {project.name}",
        "",
        "> **CONFIDENTIAL** — This document contains sensitive security information.",
        "> Distribution is restricted to authorised personnel only.",
        "",
        "---",
        "",
        "| | |",
        "| :--- | :--- |",
        f"| **Engagement** | {project.name} |",
        f"| **Report Date** | {project.created_at.strftime('%d %B %Y')} |",
        "| **Classification** | Confidential |",
        f"| **Scope** | {len(nodes)} host(s) assessed |",
        f"| **Overall Risk Score** | **{overall_score} / 10** — {posture_emoji} {posture} |",
        "",
        "---",
        "",
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 1. EXECUTIVE SUMMARY
    # ══════════════════════════════════════════════════════════════════════════
    lines += ["## 1. Executive Summary", ""]

    if not nodes and not all_vulns:
        lines += [
            "No scan data has been ingested for this engagement. "
            "Import Nmap XML, JSON, or text-based scan results to generate the full assessment.",
            "",
        ]
    else:
        # Headline posture statement
        if posture in ("CRITICAL", "HIGH"):
            lines += [
                f"> {posture_emoji} **The security posture of {project.name} is rated {posture} "
                f"(Risk Score {overall_score}/10).** Immediate executive attention is required.",
                "",
            ]
        elif posture == "MODERATE":
            lines += [
                f"> {posture_emoji} **The security posture of {project.name} is rated {posture} "
                f"(Risk Score {overall_score}/10).** Remediation should be planned within current SLAs.",
                "",
            ]
        else:
            lines += [
                f"> {posture_emoji} **The security posture of {project.name} is rated {posture} "
                f"(Risk Score {overall_score}/10).** No critical exposure was identified.",
                "",
            ]

        # Narrative paragraph — management language
        critical_hosts = [
            n for n in nodes if n.risk_level and n.risk_level.lower() == "critical"
        ]
        lines += [
            f"This assessment evaluated **{len(nodes)} system(s)** across the defined scope. "
            f"**{total_open_ports} exposed service(s)** were identified, "
            f"and **{total_vulns} security finding(s)** were catalogued across "
            f"**{len(set(n.id for n in nodes if n.vulnerabilities))} affected host(s)**.",
        ]
        if critical_hosts:
            lines += [
                "",
                f"**{len(critical_hosts)} host(s) present a Critical risk profile** and are at immediate "
                f"risk of exploitation. These systems require priority isolation or patching before the next business day.",
            ]
        lines += [""]

        # Key risk highlights (top 3 vulns by CVSS)
        top_vulns = sorted(all_vulns, key=_effective_cvss, reverse=True)[:3]
        if top_vulns:
            lines += ["**Top findings requiring immediate attention:**", ""]
            for i, v in enumerate(top_vulns, 1):
                node = next((n for n in nodes if v in n.vulnerabilities), None)
                host_ref = f"`{node.ip_address}`" if node else "unknown host"
                score = _effective_cvss(v)
                sev = (v.severity or "Unknown").upper()
                lines += [
                    f"{i}. **{v.name}** — {sev} (CVSS {score}) on {host_ref}  "
                    f"  {_business_headline(v)}",
                ]
            lines += [""]

    # ══════════════════════════════════════════════════════════════════════════
    # 2. RISK SCORECARD
    # ══════════════════════════════════════════════════════════════════════════
    lines += [
        "## 2. Risk Scorecard",
        "",
        "| KPI | Value | Interpretation |",
        "| :--- | :---: | :--- |",
        f"| Overall Risk Score | **{overall_score} / 10** | {posture_emoji} {posture_desc} |",
        f"| Average CVSS | {avg_cvss} | Mean severity across all findings |",
        f"| Maximum CVSS | {max_cvss} | Highest individual finding score |",
        f"| Exposed Hosts (Critical/High) | {exposure}% | Share of hosts with critical or high findings |",
        f"| Total Attack Surface | {total_open_ports} ports | Number of externally reachable services |",
        f"| Total Findings | {total_vulns} | Across all severity levels |",
        "",
    ]

    # ══════════════════════════════════════════════════════════════════════════
    # 3. RISK DISTRIBUTION & BUSINESS IMPACT
    # ══════════════════════════════════════════════════════════════════════════
    lines += ["## 3. Risk Distribution & Business Impact", ""]

    lines += [
        "| Severity | Count | Share | Business Impact |",
        "| :--- | :---: | :---: | :--- |",
    ]
    for sev, emoji in [
        ("Critical", "🔴"),
        ("High", "🟠"),
        ("Medium", "🟡"),
        ("Low", "🟢"),
    ]:
        count = risk_counts[sev]
        share = f"{round(count / total_vulns * 100)}%" if total_vulns else "0%"
        impact_short = _impact_short(sev)
        lines += [f"| {emoji} **{sev}** | {count} | {share} | {impact_short} |"]
    lines += [""]

    # Expanded impact descriptions for severities present
    for sev in ["critical", "high", "medium", "low"]:
        count = risk_counts[sev.capitalize()]
        if count > 0:
            label, emoji_map = (
                sev.capitalize(),
                {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"},
            )
            lines += [
                f"### {emoji_map[sev]} {label} ({count} finding{'s' if count > 1 else ''})",
                "",
                _BUSINESS_IMPACT[sev],
                "",
            ]

    # ══════════════════════════════════════════════════════════════════════════
    # 4. PRIORITISED REMEDIATION ROADMAP
    # ══════════════════════════════════════════════════════════════════════════
    lines += ["## 4. Prioritised Remediation Roadmap", ""]

    roadmap_entries = []
    for node in nodes:
        for v in sorted(node.vulnerabilities, key=_effective_cvss, reverse=True):
            sev_key = (v.severity or "low").lower()
            window, guidance = _REMEDIATION_WINDOW.get(
                sev_key, ("≤ 90 days", "Address in next review cycle.")
            )
            roadmap_entries.append(
                (sev_key, _effective_cvss(v), node, v, window, guidance)
            )

    roadmap_entries.sort(key=lambda x: (-x[1], x[0]))

    if roadmap_entries:
        lines += [
            "| Priority | Finding | Host | CVSS | Deadline | Action |",
            "| :---: | :--- | :--- | :---: | :--- | :--- |",
        ]
        for rank, (sev_key, score, node, v, window, guidance) in enumerate(
            roadmap_entries, 1
        ):
            emoji = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(
                sev_key, "⚪"
            )
            host_ref = node.ip_address or node.hostname or "unknown"
            name_cell = v.name[:55] + "…" if len(v.name) > 55 else v.name
            lines += [
                f"| {emoji} **{rank}** | {name_cell} | `{host_ref}` | {score} | {window} | {guidance} |"
            ]
        lines += [""]
    else:
        lines += ["No remediation actions required at this time.", ""]

    # Strategic actions
    lines += ["### Strategic Actions", ""]
    if risk_counts["Critical"] > 0:
        lines += [
            "1. **Emergency Response (0–48 h):** Invoke incident response procedures for Critical findings. "
            "Isolate affected systems from production networks until patches are applied.",
            "2. **Compensating Controls:** Where immediate patching is not feasible, implement network-level "
            "mitigations (firewall rules, WAF policies, ACL restrictions) as temporary controls.",
            "3. **Patch Management (≤ 2 weeks):** Prioritise High findings within the next emergency patch cycle.",
            "4. **Security Monitoring:** Increase logging and alerting thresholds on affected systems to detect "
            "active exploitation attempts.",
            "5. **30-Day Review:** Schedule a follow-up assessment to validate remediation effectiveness.",
        ]
    elif risk_counts["High"] > 0:
        lines += [
            "1. **Prioritised Patching (≤ 2 weeks):** Schedule High findings in the next patch cycle "
            "with executive sponsor sign-off.",
            "2. **Risk Acceptance:** For findings that cannot be patched immediately, document formal "
            "risk acceptance with a defined remediation deadline.",
            "3. **Monitoring Uplift:** Enable enhanced alerting on exposed services.",
            "4. **30-Day Review:** Validate remediation of High findings within 30 days.",
        ]
    else:
        lines += [
            "1. **Routine Patching:** Address Medium and Low findings within standard maintenance windows.",
            "2. **Hardening Programme:** Implement CIS Benchmarks or equivalent hardening baselines.",
            "3. **Vulnerability Management:** Establish a continuous scanning cadence (quarterly minimum).",
        ]
    lines += [""]

    # ══════════════════════════════════════════════════════════════════════════
    # 5. SCOPE OVERVIEW
    # ══════════════════════════════════════════════════════════════════════════
    if nodes:
        lines += ["## 5. Scope Overview", ""]
        lines += [
            "| # | Host | Hostname | OS | Risk Rating | CVSS Score | Findings |",
            "| :---: | :--- | :--- | :--- | :---: | :---: | :---: |",
        ]
        for i, node in enumerate(sorted(nodes, key=lambda n: n.ip_address or ""), 1):
            node_score = (
                _overall_risk_score(node.vulnerabilities)
                if node.vulnerabilities
                else 0.0
            )
            _, n_emoji, _ = _posture_label(node_score)
            lines += [
                f"| {i} | `{node.ip_address or '—'}` | {node.hostname or '—'} "
                f"| {node.os_info or '—'} "
                f"| {n_emoji} `{(node.risk_level or 'Low').upper()}` "
                f"| {node_score} | {len(node.vulnerabilities)} |",
            ]
        lines += [""]

    # ══════════════════════════════════════════════════════════════════════════
    # 6. OPERATOR NOTES  (/report command)
    # ══════════════════════════════════════════════════════════════════════════
    from src.data.database import SessionLocal

    db = SessionLocal()
    try:
        report_notes = (
            db.query(models.ChatMessage)
            .filter(
                models.ChatMessage.project_id == project.id,
                models.ChatMessage.role == "report_note",
            )
            .order_by(models.ChatMessage.created_at.asc())
            .all()
        )
        if report_notes:
            lines += ["## 6. Analyst Notes", ""]
            for note in report_notes:
                lines += [
                    f"> {note.content}",
                    ">",
                    f"> *— Added {note.created_at.strftime('%Y-%m-%d %H:%M')}*",
                    "",
                ]

        # ══════════════════════════════════════════════════════════════════════
        # APPENDIX A — TECHNICAL FINDINGS
        # ══════════════════════════════════════════════════════════════════════
        lines += [
            "---",
            "",
            "## Appendix A — Technical Findings",
            "",
            "> The following section is intended for security engineers and system administrators.",
            "",
        ]

        if nodes:
            for node in sorted(nodes, key=lambda n: n.ip_address or ""):
                node_score = (
                    _overall_risk_score(node.vulnerabilities)
                    if node.vulnerabilities
                    else 0.0
                )
                _, n_emoji, _ = _posture_label(node_score)
                hostname_str = f" / {node.hostname}" if node.hostname else ""
                lines += [
                    f"### {n_emoji} `{node.ip_address}{hostname_str}`",
                    "",
                    "| Field | Value |",
                    "| :--- | :--- |",
                    f"| **Risk Level** | `{(node.risk_level or 'Low').upper()}` |",
                    f"| **CVSS Score** | {node_score} / 10 |",
                ]
                if node.os_info:
                    lines += [f"| **OS** | {node.os_info} |"]
                lines += [
                    f"| **Open Ports** | {sum(1 for p in node.ports if p.state == 'open')} |",
                    f"| **Total Vulnerabilities** | {len(node.vulnerabilities)} |",
                    "",
                ]

                if node.ports:
                    lines += [
                        "#### Services",
                        "",
                        "| Port | Protocol | State | Service | Product / Version | CVEs |",
                        "| :--- | :---: | :---: | :--- | :--- | :--- |",
                    ]
                    for p in sorted(node.ports, key=lambda x: x.port_number):
                        state = (p.state or "unknown").upper()
                        prod_ver = " ".join(filter(None, [p.product, p.version])) or "—"
                        p_cves = [
                            v.cve
                            for v in node.vulnerabilities
                            if v.service_port == p.port_number and v.cve
                        ]
                        cves_str = (
                            ", ".join(f"`{c}`" for c in p_cves) if p_cves else "—"
                        )
                        lines += [
                            f"| **{p.port_number}** | {p.protocol or '—'} | `{state}` "
                            f"| {p.service or '—'} | {prod_ver} | {cves_str} |",
                        ]
                    lines += [""]

                if node.vulnerabilities:
                    lines += ["#### Vulnerability Detail", ""]
                    for v in sorted(
                        node.vulnerabilities,
                        key=lambda x: (
                            0
                            if (x.severity or "") == "Critical"
                            else 1
                            if (x.severity or "") == "High"
                            else 2
                            if (x.severity or "") == "Medium"
                            else 3
                        ),
                    ):
                        cve_tag = f"[{v.cve}] " if v.cve else ""
                        cvss_val = _effective_cvss(v)
                        lines += [
                            f"**{cve_tag}{v.name}**",
                            "",
                            f"- **Severity:** `{v.severity}`",
                            f"- **CVSS Score:** {cvss_val}{' *(inferred)*' if v.cvss_score is None else ''}",
                        ]
                        if v.service_port:
                            lines += [f"- **Affected Port:** {v.service_port}"]
                        if v.description:
                            lines += [f"- **Details:** {v.description}"]
                        lines += [""]

        # ══════════════════════════════════════════════════════════════════════
        # APPENDIX B — CHECKLIST COVERAGE
        # ══════════════════════════════════════════════════════════════════════
        checklist = (
            db.query(models.ChecklistItem)
            .filter(models.ChecklistItem.project_id == project.id)
            .all()
        )
        if checklist:
            done_count = sum(1 for i in checklist if i.status == "done")
            in_progress = sum(1 for i in checklist if i.status == "in_progress")
            pct = round(done_count / len(checklist) * 100) if checklist else 0
            lines += [
                "## Appendix B — Checklist Coverage (WSTG)",
                "",
                f"**Coverage:** {done_count}/{len(checklist)} items complete ({pct}%) · {in_progress} in progress",
                "",
                "| ID | Category | Title | Status | Notes |",
                "| :--- | :--- | :--- | :---: | :--- |",
            ]
            for item in checklist:
                status_emoji = (
                    "✅"
                    if item.status == "done"
                    else "🛠️"
                    if item.status == "in_progress"
                    else "🚫"
                    if item.status == "n/a"
                    else "⏳"
                )
                notes_cell = (item.notes or "—").replace("\n", " ").replace("|", "\\|")
                lines += [
                    f"| `{item.wstg_id}` | {item.category} | {item.title} "
                    f"| {status_emoji} `{item.status}` | {notes_cell} |",
                ]
            lines += [""]
    finally:
        db.close()

    # ── Footer ─────────────────────────────────────────────────────────────────
    lines += [
        "---",
        "",
        f"*Generated by PwnCortex on {project.created_at.strftime('%d %B %Y')}. "
        f"CVSS scores marked *(inferred)* were calculated from severity classification "
        f"where no explicit score was available in the source data.*",
    ]

    return "\n".join(lines)


# ── Private helpers ────────────────────────────────────────────────────────────


def _business_headline(v: models.Vulnerability) -> str:
    """One-sentence business impact headline for a vulnerability."""
    sev = (v.severity or "unknown").lower()
    if sev == "critical":
        return "Risk of full system compromise or data exfiltration."
    if sev == "high":
        return "Risk of unauthorised access or privilege escalation."
    if sev == "medium":
        return "Increases attack surface; exploitable under certain conditions."
    return "Security hardening gap; limited direct business impact."


def _impact_short(sev: str) -> str:
    """Short impact string for the risk distribution table."""
    mapping = {
        "Critical": "Full compromise / data exfiltration / service disruption",
        "High": "Unauthorised access / privilege escalation / data exposure",
        "Medium": "Attack surface expansion / vulnerability chaining risk",
        "Low": "Security debt / best-practice gap",
    }
    return mapping.get(sev, "—")
