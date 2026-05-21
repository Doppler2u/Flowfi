# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json


class FlowFiArbiter(gl.Contract):
    verdicts: TreeMap[str, str]

    def __init__(self):
        pass

    @gl.public.view
    def get_verdict(self, dispute_id: str) -> str:
        return self.verdicts.get(dispute_id, "")

    @gl.public.view
    def is_resolved(self, dispute_id: str) -> bool:
        raw = self.verdicts.get(dispute_id, "")
        if raw == "":
            return False
        try:
            data = json.loads(raw)
            return data.get("status") == "RESOLVED"
        except Exception:
            return False

    @gl.public.write
    def arbitrate(
        self,
        dispute_id: str,
        content_cid: str,
        content_url: str,
        task_description: str
    ) -> None:
        # Idempotent: skip if already resolved
        existing_raw = self.verdicts.get(dispute_id, "")
        if existing_raw != "":
            try:
                existing = json.loads(existing_raw)
                if existing.get("status") == "RESOLVED":
                    return
            except Exception:
                pass

        # Mark as PENDING before non-deterministic block
        self.verdicts[dispute_id] = json.dumps({
            "dispute_id": dispute_id,
            "is_scam": False,
            "confidence": 0,
            "reasoning": "Pending AI arbitration",
            "red_flags": "",
            "status": "PENDING"
        })

        def leader_fn():
            ipfs_data = "IPFS content unavailable"
            try:
                resp = gl.nondet.web.get(f"https://ipfs.io/ipfs/{content_cid}")
                ipfs_data = resp.body.decode("utf-8")[:2000]
            except Exception:
                ipfs_data = "IPFS fetch failed"

            url_data = "URL unreachable or dead link"
            try:
                resp2 = gl.nondet.web.get(content_url)
                url_data = resp2.body.decode("utf-8")[:2000]
            except Exception:
                url_data = "URL unreachable or dead link"

            prompt = f"""You are an impartial AI arbitrator for a digital content marketplace dispute.

PURCHASED TASK: {task_description}
IPFS METADATA (CID: {content_cid}): {ipfs_data}
DELIVERY URL CONTENT: {url_data}

Determine: CREATOR SCAM (dead/wrong/malicious link) or BUYER FRAUD (valid content delivered).

Respond only as JSON with this exact shape:
{{
  "is_scam": true or false,
  "confidence": integer from 0 to 100,
  "reasoning": "short reason",
  "red_flags": "issues found or None"
}}"""

            result = gl.nondet.exec_prompt(prompt, response_format="json")
            if isinstance(result, str):
                result = json.loads(result.replace("```json", "").replace("```", ""))
            is_scam = bool(result.get("is_scam", False))
            confidence = int(result.get("confidence", 0))
            if confidence < 0:
                confidence = 0
            if confidence > 100:
                confidence = 100
            return {
                "is_scam": is_scam,
                "confidence": confidence,
                "reasoning": str(result.get("reasoning", "")),
                "red_flags": str(result.get("red_flags", "None")),
            }

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            my_result = leader_fn()
            leader_result = leaders_res.calldata
            if bool(my_result["is_scam"]) != bool(leader_result["is_scam"]):
                return False
            return abs(int(my_result["confidence"]) - int(leader_result["confidence"])) <= 15

        verdict = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.verdicts[dispute_id] = json.dumps({
            "dispute_id": dispute_id,
            "is_scam": bool(verdict["is_scam"]),
            "confidence": int(verdict["confidence"]),
            "reasoning": str(verdict["reasoning"]),
            "red_flags": str(verdict["red_flags"]),
            "status": "RESOLVED"
        })
