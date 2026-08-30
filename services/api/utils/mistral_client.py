import json
import os
import re
from typing import Any, Optional

try:
    from mistralai import Mistral
except ImportError:
    Mistral = None


class MistralClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("MISTRAL_API_KEY")
        self.model = os.getenv("MISTRAL_MODEL", "mistral-small-latest")
        self.client = Mistral(api_key=self.api_key) if self.api_key and Mistral else None

    async def generate_response(self, prompt: str, system_prompt: Optional[str] = None, max_tokens: int = 2400) -> str:
        if not self.client:
            return ""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        response = await self.client.chat.complete_async(model=self.model, messages=messages, max_tokens=max_tokens, temperature=0.25, response_format={"type": "json_object"})
        return str(response.choices[0].message.content or "")

    async def generate_json_response(self, prompt: str, system_prompt: Optional[str] = None, expect_array: bool = False) -> Any:
        try:
            response = await self.generate_response(prompt, system_prompt)
            if not response:
                return [] if expect_array else {}
            parsed = json.loads(re.sub(r"^```(?:json)?\s*|\s*```$", "", response.strip(), flags=re.IGNORECASE))
            if expect_array and isinstance(parsed, dict):
                return next((value for value in parsed.values() if isinstance(value, list)), parsed)
            return parsed
        except Exception as exc:
            return {"error": str(exc)}
