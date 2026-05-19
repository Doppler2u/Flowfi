# contracts/FlowFiArbiter.py
# GenLayer Intelligent Contract — FlowFi Dispute Arbitration
# Deployed on GenLayer Studionet

from genlayer import *
import json

@dataclass
class DisputeVerdict:
    dispute_id: str
    content_url: str
    is_scam: bool           # True = creator is scamming, False = buyer fraud
    confidence: u8          # 0-100
    reasoning: str
    red_flags: str
    status: str             # "PENDING" | "RESOLVED"

@allow_storage
class FlowFiArbiter:
    verdicts: TreeMap[str, DisputeVerdict]  # keyed by dispute_id

    def __init__(self) -> None:
        self.verdicts = TreeMap()

    # ── Read ─────────────────────────────────────────────────────────────
    def get_verdict(self, dispute_id: str) -> DisputeVerdict | None:
        return self.verdicts.get(dispute_id)

    def is_resolved(self, dispute_id: str) -> bool:
        v = self.verdicts.get(dispute_id)
        return v is not None and v.status == "RESOLVED"

    # ── Write (triggers AI consensus) ────────────────────────────────────
    @nondet
    def arbitrate(
        self,
        dispute_id: str,      # unique ID from FlowFi Arc contract
        content_cid: str,     # IPFS CID of the disputed content metadata
        content_url: str,     # direct URL to the content/secret link
        task_description: str # what the buyer claimed they purchased
    ) -> None:
        # Idempotent: don't re-arbitrate the same dispute
        if dispute_id in self.verdicts and self.verdicts[dispute_id].status == "RESOLVED":
            return

        # Mark as pending
        self.verdicts[dispute_id] = DisputeVerdict(
            dispute_id=dispute_id,
            content_url=content_url,
            is_scam=False,
            confidence=0,
            reasoning="Pending AI arbitration",
            red_flags="",
            status="PENDING"
        )

        # Fetch IPFS metadata
        ipfs_data = ""
        try:
            ipfs_response = gl.nondet.web.get(
                f"https://ipfs.io/ipfs/{content_cid}"
            )
            ipfs_data = ipfs_response[:3000] if ipfs_response else "IPFS content unavailable"
        except Exception:
            ipfs_data = "IPFS fetch failed"

        # Fetch the actual content URL
        url_data = ""
        try:
            url_response = gl.nondet.web.get(content_url)
            url_data = url_response[:3000] if url_response else "URL returned empty"
        except Exception:
            url_data = "URL unreachable or dead link"

        # AI arbitration
        result = gl.eq_principle.prompt_non_comparative(
            f"""You are an impartial AI arbitrator for a digital content marketplace dispute.

TASK THE BUYER PURCHASED: {task_description}

CONTENT METADATA (from IPFS CID {content_cid}):
{ipfs_data}

CONTENT AT DELIVERY URL:
{url_data}

ARBITRATION TASK:
Determine whether this is a CREATOR SCAM or BUYER FRAUD.

A CREATOR SCAM means:
- The link is dead, empty, or unreachable
- The content is completely unrelated to what was purchased
- The content is malware, phishing, or dangerous
- The IPFS metadata doesn't match the actual content
- The delivery is clearly fraudulent or fake

A BUYER FRAUD means:
- The content is present and accessible
- The content reasonably matches the purchased task
- The buyer is disputing despite receiving valid content
- The URL works and delivers relevant material

Respond ONLY with valid JSON:
{{
  "is_scam": true or false,
  "confidence": <integer 0-100>,
  "reasoning": "<1-2 sentence explanation>",
  "red_flags": "<specific suspicious elements found, or 'None'>"
}}""",
            response_format="json"
        )

        parsed = json.loads(result)

        self.verdicts[dispute_id] = DisputeVerdict(
            dispute_id=dispute_id,
            content_url=content_url,
            is_scam=bool(parsed.get("is_scam", False)),
            confidence=int(parsed.get("confidence", 50)),
            reasoning=str(parsed.get("reasoning", "")),
            red_flags=str(parsed.get("red_flags", "None")),
            status="RESOLVED"
        )
