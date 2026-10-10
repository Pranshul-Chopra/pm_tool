# ── adapters/notion_document_adapter.py ──────────────────────────────────────
# Notion Workspace API v1 Outpost Adapter for Living Documents & Knowledge Base.

import json
import time
import urllib.request
import urllib.error
from typing import List, Optional, Dict, Any

from ports.knowledge_source import (
    RawDocumentPayload,
    ConnectionDiagnostic,
    KnowledgeSourcePort,
)
from tools.outposts.security import validate_outpost_url, decrypt_token
import artifacts_db


class NotionDocumentAdapter(KnowledgeSourcePort):
    """Notion API v1 implementation for document publishing and knowledge ingestion."""

    BASE_URL = "https://api.notion.com/v1"

    def __init__(
        self,
        auth_token: str,
        database_id: Optional[str] = None,
        allow_localhost: bool = False,
    ):
        self.raw_token = decrypt_token(auth_token) if auth_token.startswith("enc_v1:") else auth_token
        self.database_id = (database_id or "").strip()
        self.allow_localhost = allow_localhost

    def _http_request(
        self,
        endpoint: str,
        method: str = "GET",
        data: Optional[Dict[str, Any]] = None,
        timeout: float = 10.0,
    ) -> Dict[str, Any]:
        """Authenticated request to Notion API."""
        full_url = f"{self.BASE_URL}{endpoint}"
        is_safe, reason = validate_outpost_url(full_url, provider="notion", allow_localhost=self.allow_localhost)
        if not is_safe:
            raise ValueError(f"SSRF violation on Notion outpost endpoint: {reason}")

        headers = {
            "Authorization": f"Bearer {self.raw_token}",
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
            "User-Agent": "PMTool-Desktop-Outpost/2.2.5",
        }

        body = json.dumps(data).encode("utf-8") if data is not None else None
        req = urllib.request.Request(full_url, data=body, headers=headers, method=method)

        with urllib.request.urlopen(req, timeout=timeout) as response:
            resp_bytes = response.read()
            if not resp_bytes:
                return {}
            return json.loads(resp_bytes.decode("utf-8"))

    def test_connection(self, config: Optional[Dict[str, Any]] = None) -> ConnectionDiagnostic:
        """Verifies Notion API integration against /users/me."""
        t0 = time.perf_counter()
        try:
            resp = self._http_request("/users/me", method="GET")
            latency = (time.perf_counter() - t0) * 1000.0
            bot_name = resp.get("name", "Notion Bot")
            return ConnectionDiagnostic(
                provider="notion",
                healthy=True,
                latency_ms=round(latency, 2),
                message=f"Connected to Notion as '{bot_name}'.",
                details={"user_type": resp.get("type"), "id": resp.get("id")},
            )
        except urllib.error.HTTPError as e:
            latency = (time.perf_counter() - t0) * 1000.0
            return ConnectionDiagnostic(
                provider="notion",
                healthy=False,
                latency_ms=round(latency, 2),
                message=f"Notion authentication error: HTTP {e.code}",
            )
        except Exception as e:
            latency = (time.perf_counter() - t0) * 1000.0
            return ConnectionDiagnostic(
                provider="notion",
                healthy=False,
                latency_ms=round(latency, 2),
                message=f"Connection failed: {str(e)}",
            )

    def _markdown_to_notion_blocks(self, markdown_text: str) -> List[Dict[str, Any]]:
        """Transforms basic markdown text into Notion block schemas."""
        blocks = []
        for line in markdown_text.splitlines()[:100]:  # Cap at 100 blocks
            trimmed = line.strip()
            if not trimmed:
                continue

            if trimmed.startswith("### "):
                blocks.append({
                    "object": "block",
                    "type": "heading_3",
                    "heading_3": {"rich_text": [{"type": "text", "text": {"content": trimmed[4:]}}]},
                })
            elif trimmed.startswith("## "):
                blocks.append({
                    "object": "block",
                    "type": "heading_2",
                    "heading_2": {"rich_text": [{"type": "text", "text": {"content": trimmed[3:]}}]},
                })
            elif trimmed.startswith("# "):
                blocks.append({
                    "object": "block",
                    "type": "heading_1",
                    "heading_1": {"rich_text": [{"type": "text", "text": {"content": trimmed[2:]}}]},
                })
            elif trimmed.startswith("- ") or trimmed.startswith("* "):
                blocks.append({
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": trimmed[2:]}}]},
                })
            else:
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": trimmed}}]},
                })
        return blocks

    def push_artifact(self, artifact_id: int) -> Dict[str, Any]:
        """Publishes a living document from artifacts.db directly to Notion."""
        doc = artifacts_db.get_artifact(artifact_id)
        if not doc:
            raise ValueError(f"Living document {artifact_id} not found.")

        title = doc.get("title", "Untitled Document")
        content = doc.get("content", "")
        blocks = self._markdown_to_notion_blocks(content)

        payload: Dict[str, Any] = {
            "children": blocks,
        }

        # If a parent database_id is configured, create page inside database
        if self.database_id:
            payload["parent"] = {"database_id": self.database_id}
            payload["properties"] = {
                "Title": {
                    "title": [{"type": "text", "text": {"content": title}}]
                }
            }
        else:
            # Fallback to page parent
            payload["parent"] = {"type": "workspace", "workspace": True}
            payload["properties"] = {
                "title": [{"type": "text", "text": {"content": title}}]
            }

        resp = self._http_request("/pages", method="POST", data=payload)
        page_id = resp.get("id")
        page_url = resp.get("url", f"https://notion.so/{page_id.replace('-', '') if page_id else ''}")

        # Update local living document record
        artifacts_db.update_artifact(
            artifact_id=artifact_id,
            external_provider="notion",
            external_id=page_id,
            external_url=page_url,
            sync_status="synced",
            last_synced_at=time.strftime("%Y-%m-%d %H:%M:%S"),
        )

        return {
            "success": True,
            "external_id": page_id,
            "external_url": page_url,
            "title": title,
        }

    def pull_documents(self, source_id: Any) -> List[RawDocumentPayload]:
        """Pulls pages from a Notion database as RAG knowledge payloads."""
        db_id = source_id or self.database_id
        if not db_id:
            return []

        try:
            resp = self._http_request(f"/databases/{db_id}/query", method="POST", data={"page_size": 25})
            results = []
            for page in resp.get("results", []):
                pid = page.get("id")
                # Extract title from properties
                props = page.get("properties", {})
                title = "Untitled Notion Page"
                for _, prop_val in props.items():
                    if prop_val.get("type") == "title" and prop_val.get("title"):
                        title = prop_val["title"][0].get("plain_text", title)
                        break

                url = page.get("url", f"https://notion.so/{pid}")
                results.append(
                    RawDocumentPayload(
                        source_id=pid,
                        title=title,
                        content=f"Notion Document: {title}\nURL: {url}",
                        source_type="notion",
                        url=url,
                        metadata={"notion_page_id": pid},
                    )
                )
            return results
        except Exception:
            return []
