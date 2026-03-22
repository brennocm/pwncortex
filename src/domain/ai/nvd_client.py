import logging
import requests
import os
from typing import List, Dict, Any

NVD_API_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0"
# NVD API Key can be provided via env or settings
NVD_API_KEY = os.environ.get("NVD_API_KEY")


def lookup_cves(product: str, version: str) -> List[Dict[str, Any]]:
    """
    Lookup CVEs for a given product and version using the NVD API.
    Returns a list of dicts: {'cve': str, 'cvss_score': float, 'description': str}
    """
    if not product or not version:
        return []

    # Format CPE or keyword search. Keyword search is easier for general product/version
    query = f"{product} {version}"
    params = {"keywordSearch": query}
    headers = {}
    if NVD_API_KEY:
        headers["apiKey"] = NVD_API_KEY

    try:
        response = requests.get(NVD_API_URL, params=params, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            cves = []
            for item in data.get("vulnerabilities", []):
                cve_data = item.get("cve", {})
                cve_id = cve_data.get("id")

                # Get description
                desc = ""
                for d in cve_data.get("descriptions", []):
                    if d.get("lang") == "en":
                        desc = d.get("value")
                        break

                # Get CVSS score (look for v3.1, then v3.0, then v2)
                score = 0.0
                metrics = cve_data.get("metrics", {})
                if "cvssMetricV31" in metrics:
                    score = (
                        metrics["cvssMetricV31"][0]
                        .get("cvssData", {})
                        .get("baseScore", 0.0)
                    )
                elif "cvssMetricV30" in metrics:
                    score = (
                        metrics["cvssMetricV30"][0]
                        .get("cvssData", {})
                        .get("baseScore", 0.0)
                    )
                elif "cvssMetricV2" in metrics:
                    score = (
                        metrics["cvssMetricV2"][0]
                        .get("cvssData", {})
                        .get("baseScore", 0.0)
                    )

                cves.append({"cve": cve_id, "cvss_score": score, "description": desc})
            return cves
        elif response.status_code == 403:  # Rate limit
            logging.warning("NVD API rate limit hit")
            return []
        else:
            logging.warning("NVD API returned %s", response.status_code)
            return []
    except Exception as exc:
        logging.exception("NVD API lookup failed: %s", exc)
        return []
