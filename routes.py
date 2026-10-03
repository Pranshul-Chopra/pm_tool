# ── routes.py ─────────────────────────────────────────────────────────────────
# Flask routes and REST API for PM Tool.

from flask import Blueprint, render_template, request, jsonify, send_file
import db
import ai_db
from llm import gateway as llm_gateway

bp = Blueprint("main", __name__, template_folder="templates")


@bp.before_request
def _check_api_origin():
    """Restricts API mutations to localhost/local-origin calls."""
    if request.path.startswith("/api/") and request.method not in ("GET", "HEAD", "OPTIONS"):
        origin = request.headers.get("Origin")
        sec_site = request.headers.get("Sec-Fetch-Site")
        if sec_site == "cross-site":
            return jsonify({"error": "cross-origin API requests are not allowed"}), 403

        if origin:
            import urllib.parse
            parsed = urllib.parse.urlparse(origin)
            if parsed.hostname not in ("127.0.0.1", "localhost"):
                return jsonify({"error": "cross-origin API requests are not allowed"}), 403


# ── Page Routes ────────────────────────────────────────────────────────────────

@bp.route("/")
def index():
    return render_template("shell.html")


@bp.route("/home")
def home():
    return render_template("home.html")


@bp.route("/chat")
def chat_page():
    return render_template("chat.html")


@bp.route("/documents")
def documents_page():
    return render_template("documents.html")


@bp.route("/settings")
def settings_page():
    return render_template("settings.html")


# ── Core System APIs ───────────────────────────────────────────────────────────

@bp.route("/api/ping")
def ping():
    """Electron shell polls this endpoint to verify Flask is ready before launching the window."""
    return jsonify({"status": "ok", "app": "pm_tool"})


@bp.route("/api/status")
def status():
    """Provides application health and statistics."""
    try:
        with db.get_db() as con:
            cur = con.execute("SELECT COUNT(*) FROM projects")
            project_count = cur.fetchone()[0]
            cur = con.execute("SELECT COUNT(*) FROM tasks")
            task_count = cur.fetchone()[0]
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

    return jsonify({
        "status": "healthy",
        "app": "PM Tool",
        "version": "1.0.0",
        "counts": {
            "projects": project_count,
            "tasks": task_count,
        }
    })


# ── Rich Project Management APIs ──────────────────────────────────────────────

@bp.route("/api/projects", methods=["GET", "POST"])
def projects():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Project name is required"}), 400

        proj = db.create_project(
            name=name,
            description=data.get("description", ""),
            domain=data.get("domain", "Platform"),
            priority=data.get("priority", "medium"),
            health=data.get("health", "planning"),
            owner=data.get("owner", ""),
            target_date=data.get("target_date", ""),
            goals=data.get("goals", ""),
            tech_stack=data.get("tech_stack", ""),
        )

        initial_tasks = data.get("initial_tasks")
        if not initial_tasks and data.get("seed_tasks", False):
            initial_tasks = [
                ("Define Problem Statement & Target Personas", "high"),
                ("Author Initial PRD Document", "critical"),
                ("Architecture & Technical Specification Review", "high"),
                ("Instrumentation & North Star Metrics Setup", "medium"),
                ("Implementation Sprints & Core Integration", "medium"),
                ("Security & Compliance Audit", "high"),
                ("Beta Testing & User Feedback Review", "medium"),
            ]

        if initial_tasks:
            for item in initial_tasks:
                if isinstance(item, (tuple, list)):
                    title, prio = item[0], item[1]
                else:
                    title, prio = str(item), "medium"
                db.create_task(project_id=proj["id"], title=title, priority=prio)

        return jsonify(proj), 201

    search = request.args.get("search") or request.args.get("q")
    status = request.args.get("status")
    health = request.args.get("health")
    domain = request.args.get("domain")

    rows = db.get_projects(search=search, status=status, health=health, domain=domain)
    return jsonify({"projects": rows, "count": len(rows)})


@bp.route("/api/projects/<int:project_id>", methods=["GET", "PATCH", "DELETE"])
def project_detail(project_id: int):
    if request.method == "GET":
        proj = db.get_project(project_id)
        if not proj:
            return jsonify({"error": "Project not found"}), 404
        tasks = db.get_project_tasks(project_id)
        return jsonify({"project": proj, "tasks": tasks})

    elif request.method == "PATCH":
        data = request.get_json(force=True) or {}
        proj = db.update_project(project_id, **data)
        if not proj:
            return jsonify({"error": "Project not found"}), 404
        return jsonify(proj)

    elif request.method == "DELETE":
        ok = db.delete_project(project_id)
        if not ok:
            return jsonify({"error": "Project not found"}), 404
        return jsonify({"status": "deleted", "id": project_id})


@bp.route("/api/projects/<int:project_id>/tasks", methods=["GET", "POST"])
def project_tasks(project_id: int):
    proj = db.get_project(project_id)
    if not proj:
        return jsonify({"error": "Project not found"}), 404

    if request.method == "POST":
        data = request.get_json(force=True) or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Task title is required"}), 400

        task = db.create_task(
            project_id=project_id,
            title=title,
            description=data.get("description", ""),
            status=data.get("status", "todo"),
            priority=data.get("priority", "medium"),
            due_date=data.get("due_date", ""),
        )
        return jsonify(task), 201

    tasks = db.get_project_tasks(project_id)
    return jsonify({"tasks": tasks, "count": len(tasks)})


@bp.route("/api/tasks", methods=["GET", "POST"])
def tasks():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        title = (data.get("title") or "").strip()
        project_id = data.get("project_id")
        if not title:
            return jsonify({"error": "Task title is required"}), 400

        task = db.create_task(
            project_id=project_id,
            title=title,
            description=data.get("description", ""),
            status=data.get("status", "todo"),
            priority=data.get("priority", "medium"),
            due_date=data.get("due_date", ""),
        )
        return jsonify(task), 201

    with db.get_db() as con:
        rows = con.execute("SELECT * FROM tasks ORDER BY created_at DESC").fetchall()
        return jsonify({"tasks": [dict(r) for r in rows]})


@bp.route("/api/tasks/<int:task_id>", methods=["PATCH", "DELETE"])
def task_detail(task_id: int):
    if request.method == "PATCH":
        data = request.get_json(force=True) or {}
        updated = db.update_task(task_id, **data)
        if not updated:
            return jsonify({"error": "Task not found"}), 404
        return jsonify(updated)

    elif request.method == "DELETE":
        ok = db.delete_task(task_id)
        if not ok:
            return jsonify({"error": "Task not found"}), 404
        return jsonify({"status": "deleted", "id": task_id})


# ── LLM / AI Provider Settings ────────────────────────────────────────────────

@bp.route("/api/llm/status", methods=["GET"])
def api_llm_status():
    """
    Return full LLM provider status:
    - active_provider (ollama | api | none)
    - active_model
    - ollama { available, models, selected_model, warning }
    - api_configured, api_key_display, api_base
    - setup_required
    """
    return jsonify(llm_gateway.get_llm_status(db))


@bp.route("/api/llm/config", methods=["POST"])
def api_llm_save_config():
    """
    Save LLM provider preferences. API keys are encrypted before storage.

    Body (JSON):
      provider    string  — "ollama" | "api" | "auto"
      api_key     string  — plain-text API key (encrypted on save)
      api_base    string  — optional custom base URL for OpenAI-compatible endpoints
      model_name  string  — model identifier override
    """
    data = request.get_json(silent=True) or {}
    provider   = data.get("provider")
    api_key    = data.get("api_key")
    api_base   = data.get("api_base")
    model_name = data.get("model_name") or data.get("model")

    if not provider:
        return jsonify({"error": "provider is required"}), 400

    updated = llm_gateway.save_llm_config(
        db_module=db,
        provider=provider,
        api_key=api_key,
        api_base=api_base,
        model_name=model_name,
    )
    return jsonify(updated)


@bp.route("/api/llm/ollama/probe", methods=["GET"])
def api_llm_ollama_probe():
    """
    Live probe of the local Ollama server.
    Returns available models and selected default.
    Safe to call repeatedly from the UI settings panel.
    """
    result = llm_gateway.detect_ollama(timeout=2.0)
    return jsonify(result)


@bp.route("/api/llm/ollama/models", methods=["GET"])
def api_llm_ollama_models():
    """Return just the list of installed Ollama model names."""
    result = llm_gateway.detect_ollama(timeout=2.0)
    return jsonify({
        "available": result["available"],
        "models": result["models"],
        "warning": result.get("warning"),
    })


@bp.route("/api/llm/gemini/models", methods=["POST"])
def api_llm_gemini_models():
    """
    Discover available Gemini models for a given API key.
    Body: { "api_key": "AIzaSy..." }
    Returns sorted model list (Flash-Lite → Flash → Pro priority).
    """
    data = request.get_json(silent=True) or {}
    api_key = (data.get("api_key") or "").strip()

    # Fall back to stored encrypted key if none provided
    if not api_key:
        raw = db.get_ai_config("api_key")
        if raw:
            api_key = llm_gateway.decrypt_secret(raw)

    if not api_key:
        return jsonify({"error": "api_key is required"}), 400

    models = llm_gateway.get_available_gemini_models(api_key)
    return jsonify({"models": models, "count": len(models)})


@bp.route("/api/llm/custom/probe", methods=["POST"])
def api_llm_custom_probe():
    """
    Probe an OpenAI-compatible custom endpoint (LM Studio, LocalAI, OpenRouter, etc.).
    Body: { "url": "http://localhost:1234/v1" }
    """
    import urllib.request
    import json as _json

    data = request.get_json(silent=True) or {}
    endpoint = (data.get("url") or "http://localhost:1234/v1").rstrip("/")
    probe_target = f"{endpoint}/models" if not endpoint.endswith("/models") else endpoint

    try:
        req = urllib.request.Request(probe_target, headers={"User-Agent": "PM-Tool"})
        with urllib.request.urlopen(req, timeout=2.5) as resp:
            body = _json.loads(resp.read().decode("utf-8"))
            models = []
            if "data" in body and isinstance(body["data"], list):
                models = [
                    m.get("id") or m.get("name")
                    for m in body["data"]
                    if isinstance(m, dict)
                ]
            return jsonify({
                "online": True,
                "status": "connected",
                "models": models,
                "message": f"Connected! Found {len(models)} model(s).",
            })
    except Exception:
        return jsonify({
            "online": False,
            "status": "unreachable",
            "models": [],
            "message": f"Endpoint unreachable at {probe_target}. Ensure your local model server is running.",
        })


# ── PM AI Chat & Conversations ────────────────────────────────────────────────

def _build_pm_system_prompt(project_id: int | None = None) -> str:
    """
    Build the enterprise-grade professional PM Copilot behavioural prompt.
    Equips the model with principal PM frameworks, zero-fluff communication,
    and deep contextual grounding in the active project.
    """
    prompt = [
        "You are PM Copilot, a Staff / Principal Product Manager and Technical Architect assisting an enterprise product team.",
        "Your responses must be structured, rigorous, evidence-driven, and immediately executive-ready. Avoid conversational pleasantries, generic advice, or empty filler.",
        "",
        "### BEHAVIOURAL & OPERATIONAL STANDARDS:",
        "1. **First-Principles Problem Formulation**: Dissect user pain and business goals before jumping to solutions. Clearly isolate assumptions from validated requirements.",
        "2. **Standardized PRD Architecture**: When asked to draft a PRD or feature spec, structure it with:",
        "   - **Executive Summary & Problem Statement**: What problem are we solving, for whom, and why now?",
        "   - **Target Personas & User Journeys**: Precise workflows and friction points.",
        "   - **Goals & Non-Goals**: Explicit boundaries defining what is strictly out-of-scope for this phase.",
        "   - **User Stories & Acceptance Criteria**: Format criteria in Gherkin syntax (`Given [context] / When [action] / Then [expected outcome]`).",
        "   - **Technical & Security Considerations**: API design, latency budgets, data protection, and edge cases.",
        "   - **Success Metrics (KPIs)**: 1 Primary North Star metric + 2 Guardrail/Counter-metrics (to prevent degradation).",
        "3. **Decision & Trade-Off Analysis**: When evaluating architectural or product decisions, use a trade-off matrix evaluating: Value/Impact, Engineering Complexity, Operational Maintenance, and Reversibility (Two-way vs One-way door).",
        "4. **Roadmap & Sprint Execution**: Break releases into MoSCoW (Must, Should, Could, Won't have) buckets with clear dependency sequencing.",
        "5. **Format**: Use clean GitHub-flavored markdown with bold headers, concise bullet points, and markdown tables for data comparisons.",
    ]

    if project_id:
        try:
            proj = db.get_project(project_id)
            if proj:
                prompt.append("\n=======================================================")
                prompt.append(f"### ACTIVE PROJECT CONTEXT: {proj['name'].upper()}")
                prompt.append(f"- **Domain / Category**: {proj.get('domain') or 'General'}")
                prompt.append(f"- **Health Status**: {proj.get('health', 'planning').upper()} | **Priority**: {proj.get('priority', 'medium').upper()}")
                if proj.get('owner'):
                    prompt.append(f"- **Lead PM / Owner**: {proj['owner']}")
                if proj.get('target_date'):
                    prompt.append(f"- **Target Launch Timeline**: {proj['target_date']}")
                if proj.get('description'):
                    prompt.append(f"- **Core Overview**: {proj['description']}")
                if proj.get('goals'):
                    prompt.append(f"- **Strategic Goals / OKRs**:\n  {proj['goals']}")
                if proj.get('tech_stack'):
                    prompt.append(f"- **Architecture / Tech Stack**: {proj['tech_stack']}")

                tasks = db.get_project_tasks(project_id)
                if tasks:
                    prompt.append(f"- **Current Backlog & Tasks ({len(tasks)} items, {proj.get('progress_pct', 0)}% completed)**:")
                    for t in tasks[:20]:
                        due = f" (Due: {t['due_date']})" if t.get('due_date') else ""
                        prompt.append(f"  • [{t['status'].upper()}] {t['title']} [Priority: {t['priority'].capitalize()}]{due}")
                prompt.append("=======================================================")
                prompt.append("Align all suggestions, user stories, edge cases, and architectures directly with the goals, constraints, and tasks of this active project.")
        except Exception:
            pass

    return "\n".join(prompt)


@bp.route("/api/conversations", methods=["GET", "POST"])
def api_conversations():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "New Conversation").strip()
        project_id = data.get("project_id")
        conv = ai_db.create_conversation(title=title, project_id=project_id)
        return jsonify(conv), 201

    project_id = request.args.get("project_id", type=int)
    convs = ai_db.list_conversations(project_id=project_id)
    return jsonify({"conversations": convs})


@bp.route("/api/conversations/<conv_id>", methods=["GET", "PATCH", "DELETE"])
def api_conversation_detail(conv_id):
    if request.method == "GET":
        conv = ai_db.get_conversation(conv_id)
        if not conv:
            return jsonify({"error": "Conversation not found"}), 404
        messages = ai_db.get_conversation_messages(conv_id)
        return jsonify({"conversation": conv, "messages": messages})

    elif request.method == "PATCH":
        data = request.get_json(silent=True) or {}
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Title cannot be empty"}), 400
        ok = ai_db.rename_conversation(conv_id, title)
        if not ok:
            return jsonify({"error": "Conversation not found"}), 404
        return jsonify({"id": conv_id, "title": title})

    elif request.method == "DELETE":
        ok = ai_db.delete_conversation(conv_id)
        if not ok:
            return jsonify({"error": "Conversation not found"}), 404
        return jsonify({"status": "deleted", "id": conv_id})


@bp.route("/api/chat", methods=["POST"])
def api_chat():
    """
    Core AI Chat Endpoint:
    Receives message, resolves/creates conversation thread, records user message in ai_context.db,
    dispatches to LLM Gateway, records assistant response, and returns response payload.
    """
    data = request.get_json(silent=True) or {}
    message = str(data.get("message", "")).strip()
    conv_id = data.get("conversation_id")
    project_id = data.get("project_id")

    if not message:
        return jsonify({"error": "Message cannot be empty."}), 400

    # 1. Resolve or create conversation in ai_db
    conv = None
    if conv_id:
        conv = ai_db.get_conversation(conv_id)
    if not conv:
        first_title = message[:35].strip()
        if len(message) > 35:
            first_title += "..."
        conv = ai_db.create_conversation(title=first_title or "New Chat", project_id=project_id)
        conv_id = conv["id"]

    # 2. Add user message to conversation memory in ai_context.db
    ai_db.add_message(conversation_id=conv_id, role="user", content=message)

    # 3. Retrieve recent history for context
    history = ai_db.get_recent_history_for_llm(conv_id, max_messages=20)
    # The history currently includes the message we just added as the last item,
    # so we pass history[:-1] as prior turns and current message as latest turn
    prior_turns = history[:-1] if len(history) > 1 else []

    # 4. Construct system prompt with active project context
    target_proj_id = conv.get("project_id") or project_id
    system_prompt = _build_pm_system_prompt(project_id=target_proj_id)

    # 4b. Retrieve verified evidence from local company documents (RAG)
    retrieved_chunks = []
    try:
        from rag import engine as rag_engine
        retrieved_chunks = rag_engine.retrieve_context(
            query=message,
            project_id=target_proj_id,
            top_k=4,
        )
        if retrieved_chunks:
            system_prompt += "\n" + rag_engine.format_retrieved_context_for_prompt(retrieved_chunks)
    except Exception as e:
        print("[RAG Retrieval warning]", e)

    # 5. Call LLM Gateway
    result = llm_gateway.call_llm(
        db_module=db,
        system_prompt=system_prompt,
        message=message,
        history=prior_turns,
    )

    if "error" in result:
        return jsonify({
            "error": result.get("error"),
            "setup_required": result.get("setup_required", False),
            "conversation_id": conv_id,
            "conversation_title": conv.get("title"),
        }), 400 if result.get("setup_required") else 502

    # 6. Record assistant response in ai_context.db
    reply_text = result.get("response", "")
    model_meta = f"{result.get('provider', '')} · {result.get('model', '')}"
    ai_db.add_message(
        conversation_id=conv_id,
        role="assistant",
        content=reply_text,
        model_info=model_meta,
    )

    sources = [
        {
            "filename": c.get("filename"),
            "section": c.get("section_title"),
            "file_path": c.get("file_path"),
        }
        for c in retrieved_chunks
    ] if retrieved_chunks else []

    return jsonify({
        "response": reply_text,
        "provider": result.get("provider"),
        "model": result.get("model"),
        "conversation_id": conv_id,
        "conversation_title": conv.get("title"),
        "sources": sources,
    })


# ── Knowledge Base & Local Documents APIs ─────────────────────────────────────

@bp.route("/api/documents", methods=["GET"])
def api_documents():
    project_id = request.args.get("project_id", type=int)
    file_type = request.args.get("file_type")
    docs = db.list_documents(project_id=project_id, file_type=file_type)
    total_chunks = ai_db.get_total_chunks_count()
    return jsonify({
        "documents": docs,
        "count": len(docs),
        "total_chunks": total_chunks,
    })


@bp.route("/api/documents/scan", methods=["POST"])
def api_documents_scan():
    data = request.get_json(force=True) or {}
    folder_path = (data.get("folder_path") or "").strip()
    project_id = data.get("project_id")
    recursive = bool(data.get("recursive", True))

    if not folder_path:
        return jsonify({"error": "Folder path is required."}), 400

    from rag import engine as rag_engine
    result = rag_engine.scan_and_ingest_directory(
        dir_path=folder_path,
        project_id=project_id,
        recursive=recursive,
    )
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result), 200


@bp.route("/api/documents/folders", methods=["GET", "POST"])
def api_doc_folders():
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        folder_path = (data.get("folder_path") or "").strip()
        label = (data.get("label") or "").strip()
        project_id = data.get("project_id")
        recursive = bool(data.get("recursive", True))

        if not folder_path:
            return jsonify({"error": "Folder path is required."}), 400

        entry = db.add_doc_folder(
            folder_path=folder_path,
            project_id=project_id,
            label=label,
            recursive=recursive,
        )
        return jsonify(entry), 201

    folders = db.list_doc_folders()
    return jsonify({"folders": folders})


@bp.route("/api/documents/folders/<int:folder_id>", methods=["DELETE"])
def api_delete_doc_folder(folder_id: int):
    ok = db.delete_doc_folder(folder_id)
    if not ok:
        return jsonify({"error": "Folder not found"}), 404
    return jsonify({"status": "deleted", "id": folder_id})


@bp.route("/api/documents/<int:doc_id>", methods=["DELETE"])
def api_delete_document(doc_id: int):
    doc = db.get_document(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    db.delete_document(doc_id)
    ai_db.delete_document_chunks(doc_id)
    return jsonify({"status": "deleted", "id": doc_id})


@bp.route("/api/documents/<int:doc_id>/chunks", methods=["GET"])
def api_document_chunks(doc_id: int):
    doc = db.get_document(doc_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    chunks = ai_db.get_chunks_for_document(doc_id)
    return jsonify({"document": doc, "chunks": chunks, "count": len(chunks)})


@bp.route("/api/documents/query", methods=["POST"])
def api_documents_query():
    data = request.get_json(force=True) or {}
    query = (data.get("query") or "").strip()
    project_id = data.get("project_id")
    top_k = int(data.get("top_k", 5))

    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400

    from rag import engine as rag_engine
    chunks = rag_engine.retrieve_context(query=query, project_id=project_id, top_k=top_k)
    return jsonify({"query": query, "chunks": chunks, "count": len(chunks)})


@bp.route("/api/documents/upload", methods=["POST"])
def api_documents_upload():
    if "file" not in request.files:
        return jsonify({"error": "No file attached."}), 400
    f = request.files["file"]
    if not f or not f.filename:
        return jsonify({"error": "No selected file."}), 400

    from pathlib import Path
    import werkzeug.utils

    safe_filename = werkzeug.utils.secure_filename(f.filename)
    if not safe_filename:
        safe_filename = "document"

    upload_dir = db._user_data_dir() / "documents"
    upload_dir.mkdir(parents=True, exist_ok=True)
    target_path = upload_dir / safe_filename

    counter = 1
    stem = target_path.stem
    suffix = target_path.suffix
    while target_path.exists():
        target_path = upload_dir / f"{stem}_{counter}{suffix}"
        counter += 1

    f.save(str(target_path))

    project_id = request.form.get("project_id", type=int)
    from rag import engine as rag_engine
    result = rag_engine.ingest_single_file(str(target_path), project_id=project_id)
    if "error" in result:
        return jsonify(result), 400

    return jsonify(result), 201


@bp.route("/api/export/docx", methods=["POST"])
def api_export_docx():
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "Product Requirement Document").strip()
    content = data.get("content") or ""
    metadata = data.get("metadata") or {}

    from tools.document_generator import generate_docx_from_markdown
    buf = generate_docx_from_markdown(title=title, markdown_content=content, metadata=metadata)

    safe_name = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).rstrip() or "Document"
    return send_file(
        buf,
        as_attachment=True,
        download_name=f"{safe_name}.docx",
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )


@bp.route("/api/export/markdown", methods=["POST"])
def api_export_markdown():
    from io import BytesIO
    data = request.get_json(force=True) or {}
    title = (data.get("title") or "Product Requirement Document").strip()
    content = data.get("content") or ""

    buf = BytesIO(content.encode("utf-8"))
    safe_name = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).rstrip() or "Document"
    return send_file(
        buf,
        as_attachment=True,
        download_name=f"{safe_name}.md",
        mimetype="text/markdown"
    )

