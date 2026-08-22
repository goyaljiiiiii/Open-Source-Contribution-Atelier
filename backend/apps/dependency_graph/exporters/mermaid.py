"""
Export dependency graph as Mermaid diagram.
"""

import re
from typing import Any, Dict


class MermaidExporter:
    """
    Export dependency graph as Mermaid format.
    """

    @staticmethod
    def _sanitize_node_id(node_id: str) -> str:
        """Return a Mermaid-safe node identifier while preserving the label."""
        sanitized = re.sub(r"[^A-Za-z0-9_]", "_", str(node_id))
        sanitized = re.sub(r"_+", "_", sanitized).strip("_")
        return f"node_{sanitized or 'unnamed'}"

    def export(self, graph_data: Dict[str, Any]) -> str:
        """Generate Mermaid diagram code."""
        lines = ["graph TD"]

        # Add nodes with sanitized IDs and original labels.
        node_ids = {}
        for node in graph_data["nodes"]:
            original_id = str(node["id"])
            mermaid_id = self._sanitize_node_id(original_id)
            node_ids[original_id] = mermaid_id
            label = str(node["label"]).replace('"', '\"')
            lines.append(f'    {mermaid_id}["{label}"]')

        # Add edges using the same sanitized IDs as their nodes.
        for edge in graph_data["edges"]:
            source = node_ids.get(str(edge["source"]), self._sanitize_node_id(edge["source"]))
            target = node_ids.get(str(edge["target"]), self._sanitize_node_id(edge["target"]))
            lines.append(f"    {source} --> {target}")

        return "\n".join(lines)
