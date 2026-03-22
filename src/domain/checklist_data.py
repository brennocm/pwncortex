INITIAL_CHECKLIST = [
    # ── Information Gathering ──────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-INFO-01",
        "title": "Information Gathering: Search Engine Discovery / Reconnaissance",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-02",
        "title": "Information Gathering: Fingerprint Web Server",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-03",
        "title": "Information Gathering: Review Webserver Metafiles for Information Leakage",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-04",
        "title": "Information Gathering: Enumerate Applications on Webserver",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-05",
        "title": "Information Gathering: Review Webpage Content for Information Leakage",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-06",
        "title": "Information Gathering: Identify Application Entry Points",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-07",
        "title": "Information Gathering: Map Execution Paths Through Application",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-08",
        "title": "Information Gathering: Fingerprint Web Application Framework",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-09",
        "title": "Information Gathering: Fingerprint Web Application",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INFO-10",
        "title": "Information Gathering: Map Application Architecture",
        "category": "Web",
    },
    # ── Configuration & Deployment ─────────────────────────────────────────────
    {
        "wstg_id": "WSTG-CONF-01",
        "title": "Configuration: Test Network Infrastructure Configuration",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-02",
        "title": "Configuration: Test Application Platform Configuration",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-03",
        "title": "Configuration: Test File Extension Handling for Sensitive Information",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-04",
        "title": "Configuration: Review Old Backup and Unreferenced Files for Sensitive Information",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-05",
        "title": "Configuration: Enumerate Infrastructure and Application Admin Interfaces",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-06",
        "title": "Configuration: Test HTTP Methods",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-07",
        "title": "Configuration: Test HTTP Strict Transport Security",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-08",
        "title": "Configuration: Test RIA Cross Domain Policy",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-09",
        "title": "Configuration: Test File Permission",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-10",
        "title": "Configuration: Test for Subdomain Takeover",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CONF-11",
        "title": "Configuration: Test Cloud Storage",
        "category": "Web",
    },
    # ── Identity Management ────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-IDNT-01",
        "title": "Identity Management: Test Role Definitions",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-IDNT-02",
        "title": "Identity Management: Test User Registration Process",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-IDNT-03",
        "title": "Identity Management: Test Account Provisioning Process",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-IDNT-04",
        "title": "Identity Management: Testing for Account Enumeration and Guessable User Account",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-IDNT-05",
        "title": "Identity Management: Testing for Weak or Unenforced Username Policy",
        "category": "Web",
    },
    # ── Authentication ─────────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-AUTHN-01",
        "title": "Authentication: Testing for Credentials Transported over an Encrypted Channel",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-02",
        "title": "Authentication: Testing for Default Credentials",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-03",
        "title": "Authentication: Testing for Weak Lock Out Mechanism",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-04",
        "title": "Authentication: Testing for Bypassing Authentication Schema",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-05",
        "title": "Authentication: Testing for Vulnerable Remember Password",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-06",
        "title": "Authentication: Testing for Browser Cache Weaknesses",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-07",
        "title": "Authentication: Testing for Weak Password Policy",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-08",
        "title": "Authentication: Testing for Weak Security Question/Answer",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-09",
        "title": "Authentication: Testing for Weak Password Change or Reset Functionalities",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHN-10",
        "title": "Authentication: Testing for Weaker Authentication in Alternative Channel",
        "category": "Web",
    },
    # ── Authorization ──────────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-AUTHZ-01",
        "title": "Authorization: Testing Directory Traversal / File Include",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHZ-02",
        "title": "Authorization: Testing for Bypassing Authorization Schema",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHZ-03",
        "title": "Authorization: Testing for Privilege Escalation",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-AUTHZ-04",
        "title": "Authorization: Testing for Insecure Direct Object References (IDOR)",
        "category": "Web",
    },
    # ── Session Management ─────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-SESS-01",
        "title": "Session Management: Testing for Session Management Schema",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-02",
        "title": "Session Management: Testing for Cookies Attributes",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-03",
        "title": "Session Management: Testing for Session Fixation",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-04",
        "title": "Session Management: Testing for Exposed Session Variables",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-05",
        "title": "Session Management: Testing for Cross-Site Request Forgery (CSRF)",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-06",
        "title": "Session Management: Testing for Logout Functionality",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-07",
        "title": "Session Management: Testing Session Timeout",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-08",
        "title": "Session Management: Testing for Session Puzzling",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-SESS-09",
        "title": "Session Management: Testing for Session Hijacking",
        "category": "Web",
    },
    # ── Input Validation ───────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-INPV-01",
        "title": "Input Validation: Testing for Reflected Cross-Site Scripting (XSS)",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-02",
        "title": "Input Validation: Testing for Stored Cross-Site Scripting (XSS)",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-03",
        "title": "Input Validation: Testing for HTTP Verb Tampering",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-04",
        "title": "Input Validation: Testing for HTTP Parameter Pollution",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-05",
        "title": "Input Validation: Testing for SQL Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-06",
        "title": "Input Validation: Testing for LDAP Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-07",
        "title": "Input Validation: Testing for XML Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-08",
        "title": "Input Validation: Testing for SSI Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-09",
        "title": "Input Validation: Testing for XPath Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-10",
        "title": "Input Validation: Testing for IMAP/SMTP Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-11",
        "title": "Input Validation: Testing for Code Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-12",
        "title": "Input Validation: Testing for Command Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-13",
        "title": "Input Validation: Testing for Format String Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-14",
        "title": "Input Validation: Testing for Incubated Vulnerability",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-15",
        "title": "Input Validation: Testing for HTTP Splitting/Smuggling",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-16",
        "title": "Input Validation: Testing for HTTP Incoming Requests",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-17",
        "title": "Input Validation: Testing for Host Header Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-18",
        "title": "Input Validation: Testing for Server-Side Template Injection (SSTI)",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-INPV-19",
        "title": "Input Validation: Testing for Server-Side Request Forgery (SSRF)",
        "category": "Web",
    },
    # ── Error Handling ─────────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-ERRH-01",
        "title": "Error Handling: Testing for Improper Error Handling",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-ERRH-02",
        "title": "Error Handling: Testing for Stack Traces",
        "category": "Web",
    },
    # ── Weak Cryptography ──────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-CRYP-01",
        "title": "Cryptography: Testing for Weak Transport Layer Security",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CRYP-02",
        "title": "Cryptography: Testing for Padding Oracle",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CRYP-03",
        "title": "Cryptography: Testing for Sensitive Information Sent via Unencrypted Channels",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CRYP-04",
        "title": "Cryptography: Testing for Weak Encryption",
        "category": "Web",
    },
    # ── Business Logic ─────────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-BUSL-01",
        "title": "Business Logic: Test Business Logic Data Validation",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-02",
        "title": "Business Logic: Test Ability to Forge Requests",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-03",
        "title": "Business Logic: Test Integrity Checks",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-04",
        "title": "Business Logic: Test for Process Timing",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-05",
        "title": "Business Logic: Test Number of Times a Function Can Be Used Limits",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-06",
        "title": "Business Logic: Testing for the Circumvention of Work Flows",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-07",
        "title": "Business Logic: Test Defenses Against Application Misuse",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-08",
        "title": "Business Logic: Test Upload of Unexpected File Types",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-BUSL-09",
        "title": "Business Logic: Test Upload of Malicious Files",
        "category": "Web",
    },
    # ── Client-Side ────────────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-CLNT-01",
        "title": "Client-Side: Testing for DOM-Based Cross-Site Scripting",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-02",
        "title": "Client-Side: Testing for JavaScript Execution",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-03",
        "title": "Client-Side: Testing for HTML Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-04",
        "title": "Client-Side: Testing for Client-Side URL Redirect",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-05",
        "title": "Client-Side: Testing for CSS Injection",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-06",
        "title": "Client-Side: Testing for Client-Side Resource Manipulation",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-07",
        "title": "Client-Side: Testing Cross Origin Resource Sharing (CORS)",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-08",
        "title": "Client-Side: Testing for Cross-Site Flashing",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-09",
        "title": "Client-Side: Testing for Clickjacking",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-10",
        "title": "Client-Side: Testing WebSockets",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-11",
        "title": "Client-Side: Testing Web Messaging",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-12",
        "title": "Client-Side: Testing Browser Storage",
        "category": "Web",
    },
    {
        "wstg_id": "WSTG-CLNT-13",
        "title": "Client-Side: Testing for Cross-Site Script Inclusion (XSSI)",
        "category": "Web",
    },
    # ── API Testing ────────────────────────────────────────────────────────────
    {
        "wstg_id": "WSTG-APIT-01",
        "title": "API Testing: Testing GraphQL",
        "category": "Web",
    },
    # ── Network ────────────────────────────────────────────────────────────────
    {
        "wstg_id": "NET-SCAN-01",
        "title": "Network: TCP Port Scan",
        "category": "Network",
    },
    {
        "wstg_id": "NET-SCAN-02",
        "title": "Network: UDP Port Scan",
        "category": "Network",
    },
    {
        "wstg_id": "NET-ENUM-01",
        "title": "Network: Service Enumeration and Banner Grabbing",
        "category": "Network",
    },
    {
        "wstg_id": "NET-ENUM-02",
        "title": "Network: OS Fingerprinting",
        "category": "Network",
    },
    {
        "wstg_id": "NET-VULN-01",
        "title": "Network: Vulnerability Scan (NSE / Nessus)",
        "category": "Network",
    },
    {
        "wstg_id": "NET-VULN-02",
        "title": "Network: Known CVE Exploitation",
        "category": "Network",
    },
    {
        "wstg_id": "NET-CRED-01",
        "title": "Network: Default / Weak Credentials on Network Services",
        "category": "Network",
    },
    {
        "wstg_id": "NET-SNIFF-01",
        "title": "Network: Traffic Sniffing / ARP Poisoning",
        "category": "Network",
    },
    {
        "wstg_id": "NET-FW-01",
        "title": "Network: Firewall / ACL Rule Analysis",
        "category": "Network",
    },
    # ── Active Directory ───────────────────────────────────────────────────────
    {
        "wstg_id": "AD-ENUM-01",
        "title": "Active Directory: LDAP Enumeration (users, groups, OUs)",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-ENUM-02",
        "title": "Active Directory: SMB Share Enumeration",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-ENUM-03",
        "title": "Active Directory: DNS / SPN Enumeration",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-KERB-01",
        "title": "Active Directory: Kerberoasting",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-KERB-02",
        "title": "Active Directory: AS-REP Roasting",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-CRED-01",
        "title": "Active Directory: Password Spraying",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-CRED-02",
        "title": "Active Directory: Pass-the-Hash (PtH)",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-CRED-03",
        "title": "Active Directory: Pass-the-Ticket (PtT)",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-PRIV-01",
        "title": "Active Directory: Misconfigured ACLs / DACLs (BloodHound)",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-PRIV-02",
        "title": "Active Directory: Unconstrained / Constrained Delegation Abuse",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-PRIV-03",
        "title": "Active Directory: DCSync Attack",
        "category": "Active Directory",
    },
    {
        "wstg_id": "AD-PRIV-04",
        "title": "Active Directory: Golden / Silver Ticket",
        "category": "Active Directory",
    },
    # ── Infrastructure ─────────────────────────────────────────────────────────
    {
        "wstg_id": "INF-CREDS-01",
        "title": "Infrastructure: Default Credentials on Devices / Services",
        "category": "Infrastructure",
    },
    {
        "wstg_id": "INF-PATCH-01",
        "title": "Infrastructure: Unpatched Services and Missing Security Updates",
        "category": "Infrastructure",
    },
    {
        "wstg_id": "INF-CONFIG-01",
        "title": "Infrastructure: Misconfigured Services (FTP anon, NFS exports, etc.)",
        "category": "Infrastructure",
    },
    {
        "wstg_id": "INF-CONFIG-02",
        "title": "Infrastructure: Exposed Management Interfaces (SSH, RDP, Telnet, SNMP)",
        "category": "Infrastructure",
    },
    {
        "wstg_id": "INF-CLOUD-01",
        "title": "Infrastructure: Cloud Misconfiguration (S3 buckets, IAM policies)",
        "category": "Infrastructure",
    },
    {
        "wstg_id": "INF-CLOUD-02",
        "title": "Infrastructure: Container / Kubernetes Misconfiguration",
        "category": "Infrastructure",
    },
    {
        "wstg_id": "INF-LOG-01",
        "title": "Infrastructure: Insufficient Logging and Monitoring",
        "category": "Infrastructure",
    },
]
