"""
AI Summary Service using HuggingFace Inference API.
Uses meta-llama/Llama-3.3-70B-Instruct (free tier) to generate
intelligent incident summaries, root cause suggestions, and action items.
"""
from typing import Optional, Dict, Any
from app.core.config import settings
from app.core.logging import logger
import httpx
import json


SYSTEM_PROMPT = """You are an expert Site Reliability Engineer (SRE) and incident response specialist.
You analyze incident data from production systems and provide clear, actionable summaries.
Always respond in valid JSON format exactly as specified. Be concise, technical, and practical."""

INCIDENT_SUMMARY_PROMPT = """Analyze this production incident and respond with ONLY a valid JSON object (no markdown, no extra text):

Incident Data:
- Title: {title}
- Severity: {severity}
- Status: {status}
- Component: {component_id} ({component_type})
- Team: {team}
- Signal Count: {signal_count} signals
- Description: {description}
- Recent Signals: {signals_summary}
- Duration: {duration}
- RCA Completed: {rca_completed}

Respond with this exact JSON structure:
{{
  "executive_summary": "2-3 sentence plain English summary of what happened and business impact",
  "technical_summary": "2-3 sentence technical explanation of the root cause and affected systems",
  "likely_cause": "Most probable root cause based on the signals and component type",
  "business_impact": "Impact on users, revenue, or operations",
  "immediate_actions": ["action 1", "action 2", "action 3"],
  "prevention_suggestions": ["suggestion 1", "suggestion 2"],
  "severity_assessment": "Why this severity level is appropriate or if it should be changed",
  "estimated_resolution_time": "Estimated time to resolve based on incident type",
  "confidence": "high/medium/low"
}}"""


async def generate_incident_summary(incident_data: Dict[str, Any], signals: list) -> Dict[str, Any]:
    """
    Generate AI-powered incident summary using HuggingFace Inference API.
    Falls back to a rule-based summary if HF token is not configured.
    """
    hf_token = getattr(settings, 'HF_TOKEN', None)

    # Build signals summary
    signals_summary = "No signals available"
    if signals:
        recent = signals[:5]
        signals_summary = "; ".join([
            f"{s.get('signal_type', 'UNKNOWN')}: {s.get('message', '')[:80]}"
            for s in recent
        ])

    # Calculate duration
    duration = "Unknown"
    if incident_data.get('first_signal_at') and incident_data.get('status') not in ['RESOLVED', 'CLOSED']:
        duration = f"Ongoing since {incident_data.get('first_signal_at', '')[:16].replace('T', ' ')} UTC"
    elif incident_data.get('mttr_seconds'):
        mttr = incident_data['mttr_seconds']
        if mttr < 3600:
            duration = f"{int(mttr/60)} minutes"
        else:
            duration = f"{round(mttr/3600, 1)} hours"

    prompt = INCIDENT_SUMMARY_PROMPT.format(
        title=incident_data.get('title', 'Unknown'),
        severity=incident_data.get('severity', 'Unknown'),
        status=incident_data.get('status', 'Unknown'),
        component_id=incident_data.get('component_id', 'Unknown'),
        component_type=incident_data.get('component_type', 'Unknown'),
        team=incident_data.get('team', 'Unknown'),
        signal_count=incident_data.get('signal_count', 0),
        description=incident_data.get('description', 'No description')[:300],
        signals_summary=signals_summary,
        duration=duration,
        rca_completed=incident_data.get('rca_completed', False),
    )

    # Try HuggingFace API if token is available
    if hf_token and hf_token.strip() and hf_token != "your_hf_token_here":
        try:
            result = await _call_huggingface(prompt, hf_token)
            if result:
                result['source'] = 'ai'
                result['model'] = 'meta-llama/Llama-3.3-70B-Instruct'
                return result
        except Exception as e:
            logger.warning("HuggingFace API call failed, using rule-based fallback", error=str(e))

    # Rule-based fallback (works without any API key)
    return _rule_based_summary(incident_data, signals, duration)


async def _call_huggingface(prompt: str, token: str) -> Optional[Dict]:
    """Call HuggingFace Inference API."""
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            "https://api-inference.huggingface.co/models/meta-llama/Llama-3.3-70B-Instruct/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            },
            json={
                "model": "meta-llama/Llama-3.3-70B-Instruct",
                "messages": messages,
                "max_tokens": 1024,
                "temperature": 0.3,
            },
        )

        if response.status_code != 200:
            logger.warning("HuggingFace API error", status=response.status_code, body=response.text[:200])
            return None

        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()

        # Strip markdown code blocks if present
        if content.startswith("```"):
            content = content.split("```")[1]
            if content.startswith("json"):
                content = content[4:]
        content = content.strip()

        return json.loads(content)


def _rule_based_summary(incident_data: Dict, signals: list, duration: str) -> Dict:
    """
    Intelligent rule-based summary when no HF token is configured.
    Produces useful summaries based on component type and signal patterns.
    """
    severity = incident_data.get('severity', 'P2_MEDIUM')
    component_type = incident_data.get('component_type', 'UNKNOWN')
    status = incident_data.get('status', 'OPEN')
    signal_count = incident_data.get('signal_count', 1)
    title = incident_data.get('title', 'Unknown incident')
    team = incident_data.get('team', 'on-call team')
    component_id = incident_data.get('component_id', 'unknown component')

    # Severity-based impact
    impact_map = {
        'P0_CRITICAL': 'Critical business impact — service is down or severely degraded for all users.',
        'P1_HIGH': 'High impact — significant degradation affecting a large portion of users.',
        'P2_MEDIUM': 'Medium impact — partial degradation, some users affected.',
        'P3_LOW': 'Low impact — minor issue, most users unaffected.',
        'P4_INFO': 'Informational — no immediate user impact.',
    }

    # Component-specific likely causes
    cause_map = {
        'API': 'Application-level error — likely a code bug, dependency failure, or resource exhaustion causing HTTP errors.',
        'RDBMS': 'Database issue — possible causes include slow queries, connection pool exhaustion, disk space, or replication lag.',
        'CACHE': 'Cache layer failure — node crash, memory exhaustion, or network partition affecting cache availability.',
        'QUEUE': 'Message queue issue — consumer lag, dead consumers, or broker overload causing processing delays.',
        'SERVER': 'Infrastructure issue — resource exhaustion (CPU/RAM/disk) or process crash on the host.',
        'NOSQL': 'NoSQL store issue — node failure, network partition, or write/read timeout under load.',
        'SECURITY': 'Security anomaly — unauthorized access attempts, brute force, or certificate issues requiring immediate attention.',
        'NETWORK': 'Network connectivity issue — possible DNS failure, routing problem, or firewall change.',
    }

    # Immediate actions by component type
    actions_map = {
        'API': [
            f'Check application logs on {component_id} for stack traces',
            'Verify upstream dependencies (database, cache, external APIs)',
            'Check recent deployments — consider rollback if issue started post-deploy',
        ],
        'RDBMS': [
            'Run SHOW PROCESSLIST to identify blocking queries',
            'Check disk space and connection pool utilization',
            'Review slow query log for recent changes',
        ],
        'CACHE': [
            f'Check Redis/cache node status and memory usage on {component_id}',
            'Verify replication status across cluster nodes',
            'Consider failover to replica if primary is unresponsive',
        ],
        'QUEUE': [
            'Check consumer group lag and restart dead consumers',
            'Verify broker health and disk space',
            'Review DLQ (dead letter queue) for failed messages',
        ],
        'SERVER': [
            f'SSH into {component_id} and check top/htop for resource usage',
            'Review system logs: journalctl -xe',
            'Check for OOM killer events: dmesg | grep -i oom',
        ],
        'SECURITY': [
            'Block suspicious IP ranges at the firewall/WAF immediately',
            'Rotate affected credentials and API keys',
            'Enable enhanced logging and alert security team',
        ],
    }

    prevention_map = {
        'API': ['Add circuit breakers and retry logic', 'Implement better health checks and auto-scaling'],
        'RDBMS': ['Set up query timeout limits', 'Add read replicas and connection pooling'],
        'CACHE': ['Configure Redis Sentinel or Cluster for HA', 'Add cache warming on startup'],
        'QUEUE': ['Set up consumer auto-scaling based on lag', 'Configure DLQ alerting'],
        'SERVER': ['Set up auto-scaling policies', 'Add proactive disk/memory alerting at 80%'],
        'SECURITY': ['Implement rate limiting and CAPTCHA', 'Set up automated IP blocking for brute force'],
    }

    noise_note = ""
    if signal_count > 10:
        noise_note = f" The system received {signal_count:,} signals but intelligently deduplicated them into this single incident."

    return {
        "executive_summary": f"{title}. {impact_map.get(severity, 'Impact assessment pending.')} The {team} has been notified and is actively working on resolution.{noise_note}",
        "technical_summary": f"The {component_type} component '{component_id}' is experiencing issues. {cause_map.get(component_type, 'Root cause analysis is in progress.')} Current status: {status}. Duration: {duration}.",
        "likely_cause": cause_map.get(component_type, "Root cause under investigation. Check recent deployments, configuration changes, and resource utilization."),
        "business_impact": impact_map.get(severity, "Impact being assessed."),
        "immediate_actions": actions_map.get(component_type, [
            "Acknowledge the incident and assign to the correct team",
            "Check service logs and recent deployments",
            "Assess user impact and communicate status",
        ]),
        "prevention_suggestions": prevention_map.get(component_type, [
            "Add comprehensive monitoring and alerting",
            "Document runbook for this type of incident",
        ]),
        "severity_assessment": f"Severity {severity} is {'appropriate' if severity in ['P0_CRITICAL', 'P1_HIGH'] else 'assigned'} based on the {component_type} component type and {signal_count} signals received.",
        "estimated_resolution_time": _estimate_resolution(severity, component_type, status),
        "confidence": "medium",
        "source": "rule-based",
        "model": "IMS Rule Engine",
        "note": "Add HF_TOKEN to .env for AI-powered summaries using Llama-3.3-70B",
    }


def _estimate_resolution(severity: str, component_type: str, status: str) -> str:
    if status in ['RESOLVED', 'CLOSED']:
        return "Already resolved"
    if status == 'MITIGATED':
        return "Mitigated — full resolution within 1-2 hours"
    estimates = {
        'P0_CRITICAL': {'API': '30-60 minutes', 'RDBMS': '1-2 hours', 'CACHE': '30-45 minutes', 'SECURITY': '1-4 hours'},
        'P1_HIGH':     {'API': '1-2 hours',     'RDBMS': '2-4 hours', 'CACHE': '1 hour',        'SECURITY': '2-6 hours'},
        'P2_MEDIUM':   {'API': '2-4 hours',     'RDBMS': '4-8 hours', 'CACHE': '2-3 hours',     'SECURITY': '4-8 hours'},
    }
    return estimates.get(severity, {}).get(component_type, '2-4 hours depending on root cause')
