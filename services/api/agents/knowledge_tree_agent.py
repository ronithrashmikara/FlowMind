from typing import Dict, List, Any
from utils.mistral_client import MistralClient
import json

class KnowledgeTreeAgent:
    def __init__(self, mistral_client: MistralClient):
        self.mistral_client = mistral_client
        self.system_prompt = """
        You are an expert at creating knowledge graphs and hierarchical structures from documents.
        
        Create a tree-like knowledge structure that shows:
        1. Main topics as root nodes
        2. Subtopics as child nodes
        3. Concepts and details as leaf nodes
        4. Relationships between different concepts
        
        The structure should be suitable for visualization in React Flow.
        Each node should have: id, label, type, position, and connections.
        """
    
    async def create_knowledge_tree(self, text: str) -> Dict[str, Any]:
        """Create a hierarchical knowledge tree from document text"""
        
        prompt = f"""
        Create a knowledge tree from this document text:
        
        TEXT: {text[:2000]}...
        
        Create a hierarchical structure with:
        1. Root nodes (main topics)
        2. Branch nodes (subtopics)
        3. Leaf nodes (specific concepts)
        4. Connections showing relationships
        
        Format for React Flow visualization:
        {{
            "nodes": [
                {{
                    "id": "node_1",
                    "type": "root|branch|leaf",
                    "data": {{
                        "label": "Node Title",
                        "description": "Brief description",
                        "level": 0
                    }},
                    "position": {{"x": 100, "y": 100}}
                }}
            ],
            "edges": [
                {{
                    "id": "edge_1",
                    "source": "node_1",
                    "target": "node_2",
                    "type": "smoothstep"
                }}
            ]
        }}
        
        Create 10-20 nodes with proper hierarchy and connections.
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            
            if response.get('success', True) and 'nodes' in response:
                return self._format_for_react_flow(response)
            else:
                return self._create_fallback_tree(text)
                
        except Exception as e:
            print(f"Error creating knowledge tree: {e}")
            return self._create_fallback_tree(text)
    
    def _format_for_react_flow(self, response: Dict[str, Any]) -> Dict[str, Any]:
        """Format the response for React Flow"""
        nodes = response.get('nodes', [])
        edges = response.get('edges', [])
        
        # Ensure proper positioning
        for i, node in enumerate(nodes):
            if 'position' not in node:
                level = node.get('data', {}).get('level', 0)
                node['position'] = {
                    'x': (i % 4) * 300 + 100,
                    'y': level * 150 + 100
                }
        
        return {
            "nodes": nodes,
            "edges": edges,
            "layout": "hierarchical"
        }
    
    def _create_fallback_tree(self, text: str) -> Dict[str, Any]:
        """Create a simple fallback tree when AI generation fails"""
        import re
        
        # Extract potential topics
        words = text.split()
        topics = [word.strip('.,!?') for word in words if word[0].isupper() and len(word) > 4]
        unique_topics = list(set(topics))[:8]
        
        nodes = []
        edges = []
        
        # Create root node
        nodes.append({
            "id": "root",
            "type": "root",
            "data": {
                "label": "Document Overview",
                "description": "Main document content",
                "level": 0
            },
            "position": {"x": 400, "y": 50}
        })
        
        # Create topic nodes
        for i, topic in enumerate(unique_topics):
            node_id = f"topic_{i}"
            nodes.append({
                "id": node_id,
                "type": "branch",
                "data": {
                    "label": topic,
                    "description": f"Topic: {topic}",
                    "level": 1
                },
                "position": {"x": (i % 3) * 300 + 200, "y": 200}
            })
            
            # Connect to root
            edges.append({
                "id": f"edge_root_{i}",
                "source": "root",
                "target": node_id,
                "type": "smoothstep"
            })
        
        return {
            "nodes": nodes,
            "edges": edges,
            "layout": "hierarchical"
        }
    
    async def get_node_details(self, node_id: str, context: str) -> Dict[str, Any]:
        """Get detailed information about a specific node"""
        
        prompt = f"""
        Provide detailed information about this topic from the document:
        
        NODE: {node_id}
        CONTEXT: {context[:1000]}
        
        Provide:
        1. Detailed explanation
        2. Key points (3-5 bullet points)
        3. Related concepts
        4. Examples if available
        
        JSON format:
        {{
            "explanation": "detailed explanation...",
            "key_points": ["point1", "point2", ...],
            "related_concepts": ["concept1", "concept2", ...],
            "examples": ["example1", "example2", ...]
        }}
        """
        
        try:
            response = await self.mistral_client.generate_json_response(prompt, self.system_prompt)
            return response
            
        except Exception as e:
            return {
                "explanation": f"Information about {node_id}",
                "key_points": ["Key concept from the document"],
                "related_concepts": ["Related topic"],
                "examples": ["Example from context"]
            }