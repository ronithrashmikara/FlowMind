from typing import Dict, List, Any
from utils.mistral_client import MistralClient

class SimplifierAgent:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client
        self.system_prompt = """
        You are an expert at simplifying complex concepts. Your task is to take complex academic or technical content and make it accessible to a general audience.
        
        For each concept, provide:
        1. Simple explanation in plain language
        2. Real-world examples or analogies
        3. Key takeaways
        4. Common misconceptions to avoid
        
        Make explanations clear, engaging, and easy to understand.
        """
    
    async def simplify_concepts(self, concepts: List[Dict[str, str]]) -> List[Dict[str, Any]]:
        """Simplify complex concepts into easy-to-understand explanations"""
        
        simplified_concepts = []
        
        for concept in concepts:
            prompt = f"""
            Simplify this concept for easy understanding:
            
            CONCEPT: {concept.get('term', 'Unknown')}
            DEFINITION: {concept.get('definition', 'No definition provided')}
            
            Please provide:
            1. Simple explanation (2-3 sentences)
            2. Real-world analogy or example
            3. Key takeaway (1 sentence)
            4. Common misconception (if any)
            
            Respond in JSON format:
            {{
                "term": "concept_name",
                "simple_explanation": "easy explanation...",
                "analogy": "real-world example...",
                "key_takeaway": "main point...",
                "misconception": "common mistake..."
            }}
            """
            
            try:
                response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
                
                if response.get('success', True):
                    simplified_concepts.append({
                        "original_term": concept.get('term', 'Unknown'),
                        "original_definition": concept.get('definition', ''),
                        "simple_explanation": response.get('simple_explanation', ''),
                        "analogy": response.get('analogy', ''),
                        "key_takeaway": response.get('key_takeaway', ''),
                        "misconception": response.get('misconception', '')
                    })
                
            except Exception as e:
                print(f"Error simplifying concept {concept.get('term')}: {e}")
                # Add fallback simplified version
                simplified_concepts.append({
                    "original_term": concept.get('term', 'Unknown'),
                    "original_definition": concept.get('definition', ''),
                    "simple_explanation": f"This concept relates to {concept.get('term', 'the topic')}.",
                    "analogy": "Think of it like a basic building block in this subject.",
                    "key_takeaway": f"Understanding {concept.get('term', 'this')} is important for the overall topic.",
                    "misconception": "No common misconceptions identified."
                })
        
        return simplified_concepts
    
    async def create_analogies(self, text: str, topic: str) -> List[Dict[str, str]]:
        """Create analogies to help explain complex topics"""
        
        prompt = f"""
        Create 3-5 helpful analogies to explain this topic: {topic}
        
        Context: {text[:1000]}
        
        For each analogy, provide:
        - The analogy itself
        - How it relates to the concept
        - What it helps clarify
        
        Respond in JSON format:
        {{
            "analogies": [
                {{
                    "analogy": "description of analogy",
                    "connection": "how it relates",
                    "clarifies": "what it explains"
                }}
            ]
        }}
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            return response.get('analogies', [])
            
        except Exception as e:
            print(f"Error creating analogies: {e}")
            return [
                {
                    "analogy": f"Think of {topic} like a puzzle - each piece fits together to create the complete picture.",
                    "connection": "Each concept builds on others",
                    "clarifies": "How different parts work together"
                }
            ]