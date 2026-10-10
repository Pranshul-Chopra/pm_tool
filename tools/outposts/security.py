# ── tools/outposts/security.py ────────────────────────────────────────────────
# Defensive security perimeter for connection outposts: SSRF validation,
# machine-bound credential encryption at rest, and token masking.

import ipaddress
import re
import socket
from typing import Tuple, Optional
from urllib.parse import urlparse

# Re-use the existing PBKDF2-HMAC-SHA256 authenticated secret cipher from gateway
from llm.gateway import encrypt_secret, decrypt_secret


class SSRFSecurityError(ValueError):
    """Raised when an outpost destination URL violates outbound security policy."""
    pass


# Specific cloud metadata IP addresses and prohibited hostnames
BLOCKED_HOSTNAMES = {
    "localhost",
    "metadata.google.internal",
    "instance-data",
    "metadata",
}

BLOCKED_IPS = {
    "169.254.169.254",  # AWS / GCP / Azure metadata service
    "169.254.169.250",
    "100.100.100.200",  # Alibaba cloud metadata
}


def validate_outpost_url(
    url: str,
    provider: Optional[str] = None,
    allow_localhost: bool = False,
) -> Tuple[bool, str]:
    """
    Validates an external outpost endpoint against Server-Side Request Forgery (SSRF),
    prohibited protocols, loopback addresses, RFC 1918 private subnets, and cloud metadata IPs.

    Returns:
        (True, "OK") if safe.
        (False, error_message) if dangerous or malformed.
    """
    if not url or not isinstance(url, str):
        return False, "Outpost URL cannot be empty."

    url = url.strip()

    # Perimeter 1: Check for control characters, null bytes, CRLF injection
    if any(c in url for c in ["\r", "\n", "\0", "\t"]):
        return False, "URL contains illegal control characters or CRLF sequences."

    try:
        parsed = urlparse(url)
    except Exception as e:
        return False, f"Malformed URL syntax: {str(e)}"

    # Perimeter 2: Protocol check - strict HTTPS in production
    scheme = parsed.scheme.lower()
    if allow_localhost and scheme in ("http", "https"):
        pass
    elif scheme != "https":
        return False, f"Insecure protocol '{scheme}'. Connection outposts strictly require 'https://'."

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        return False, "URL does not contain a valid target hostname."

    # Perimeter 3: Explicit blacklisted hostnames
    if hostname in BLOCKED_HOSTNAMES and not allow_localhost:
        return False, f"Access to '{hostname}' is blocked by outbound SSRF policy."

    # Perimeter 4: Direct IP inspection & DNS resolution
    try:
        # Check if hostname itself is a literal IP
        try:
            ip_obj = ipaddress.ip_address(hostname)
            resolved_ips = [ip_obj]
        except ValueError:
            # Resolve DNS
            addr_info = socket.getaddrinfo(hostname, parsed.port or 443, proto=socket.IPPROTO_TCP)
            resolved_ips = [ipaddress.ip_address(entry[4][0]) for entry in addr_info]
    except socket.gaierror:
        # In offline/mock test environments or DNS failures:
        if allow_localhost and (hostname == "127.0.0.1" or hostname == "localhost"):
            return True, "OK"
        return False, f"Failed to resolve DNS hostname '{hostname}'."
    except Exception as e:
        return False, f"DNS resolution error: {str(e)}"

    for ip in resolved_ips:
        ip_str = str(ip)
        if ip_str in BLOCKED_IPS:
            return False, f"Access to cloud metadata address '{ip_str}' is blocked."

        if not allow_localhost:
            if ip.is_loopback:
                return False, f"Access to loopback IP '{ip_str}' is prohibited."
            if ip.is_private:
                return False, f"Access to private subnet IP '{ip_str}' (RFC 1918) is prohibited."
            if ip.is_link_local:
                return False, f"Access to link-local IP '{ip_str}' is prohibited."
            if ip.is_reserved:
                return False, f"Access to reserved IP '{ip_str}' is prohibited."
            if ip.is_multicast:
                return False, f"Access to multicast IP '{ip_str}' is prohibited."

    # Perimeter 5: Provider-specific FQDN validation (optional guard)
    if provider:
        norm_prov = provider.lower().strip()
        if norm_prov == "jira":
            # Atlassian Cloud (*.atlassian.net) or custom enterprise Jira domain
            if not ("." in hostname and len(hostname.split(".")) >= 2):
                return False, "Invalid Jira hostname."
        elif norm_prov == "notion":
            # Notion API endpoints
            if not (hostname == "api.notion.com" or hostname.endswith(".notion.com") or hostname.endswith(".notion.so")):
                return False, f"Invalid Notion API hostname '{hostname}'. Expected 'api.notion.com'."
        elif norm_prov in ("gdocs", "google"):
            if not (hostname.endswith("googleapis.com") or hostname.endswith("google.com")):
                return False, f"Invalid Google API hostname '{hostname}'."

    return True, "OK"


# ── Credential Security & Masking ─────────────────────────────────────────────

def encrypt_token(plain_token: str) -> str:
    """Encrypt an API token or OAuth secret using machine-bound PBKDF2/keystream."""
    return encrypt_secret(plain_token)


def decrypt_token(cipher_token: str) -> str:
    """Decrypt a machine-encrypted token back to plain string."""
    return decrypt_secret(cipher_token)


def mask_token(token: str) -> str:
    """
    Mask an API token or secret for safe rendering in UI and logs.
    Shows only the last 4 characters if long enough, else full mask.
    """
    if not token:
        return ""
    if len(token) <= 6:
        return "••••••••"
    return "••••••••••••" + token[-4:]
