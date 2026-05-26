"""Render GraphRAG JSON export into interactive HTML."""

from __future__ import annotations

import json
from pathlib import Path


class GraphRAGVisualizer:
    """Create an interactive graph HTML from node-link JSON."""

    @staticmethod
    def render_html(
        graph_json_path: str | Path,
        output_html_path: str | Path,
        title: str = "GraphRAG Visualization",
    ) -> Path:
        graph_path = Path(graph_json_path)
        out_path = Path(output_html_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        with open(graph_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)

        nodes = payload.get("nodes", [])
        links = payload.get("links", [])

        # Normalize for vis-network
        vis_nodes = []
        community_ids = set()
        community_labels = {}
        for node in nodes:
            nid = node.get("id")
            label = node.get("label", nid)
            entity_type = node.get("entity_type", "AcademicEntity")
            canonical_name = node.get("canonical_name", nid)
            community_id = int(node.get("community_id", -1))
            community_label = node.get("community_label", f"Community {community_id}")
            leiden_community_id = node.get("leiden_community_id", "n/a")
            community_ids.add(community_id)
            community_labels[f"c{community_id}"] = community_label
            title_txt = (
                f"id: {nid}\n"
                f"label: {label}\n"
                f"entity_type: {entity_type}\n"
                f"canonical_name: {canonical_name}\n"
                f"community_id: {community_id}\n"
                f"community_label: {community_label}\n"
                f"leiden_community_id: {leiden_community_id}\n"
                f"aliases: {', '.join(node.get('aliases', []))}"
            )
            vis_nodes.append(
                {
                    "id": nid,
                    "label": label,
                    "title": title_txt,
                    "group": f"c{community_id}",
                    "shape": "dot",
                    "size": 12,
                }
            )

        vis_edges = []
        for edge in links:
            rel = edge.get("relation", "related_to")
            confidence = edge.get("confidence", 0.0)
            src = edge.get("source")
            dst = edge.get("target")
            vis_edges.append(
                {
                    "from": src,
                    "to": dst,
                    "label": rel,
                    "title": f"relation: {rel}\nconfidence: {confidence}",
                    "arrows": "to",
                    "font": {"align": "top"},
                    "color": {"opacity": 0.7},
                }
            )

        html = f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{title}</title>
  <script type="text/javascript" src="https://unpkg.com/vis-network@9.1.9/dist/vis-network.min.js"></script>
  <style>
    body {{
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      background: #0f172a;
      color: #e2e8f0;
    }}
    .wrap {{
      padding: 14px;
    }}
    .meta {{
      display: flex;
      gap: 20px;
      margin-bottom: 10px;
      font-size: 13px;
      color: #94a3b8;
      flex-wrap: wrap;
    }}
    .panel {{
      display: flex;
      gap: 10px;
      margin-bottom: 10px;
      align-items: center;
    }}
    .panel input {{
      width: 320px;
      background: #111827;
      color: #e5e7eb;
      border: 1px solid #374151;
      border-radius: 8px;
      padding: 8px 10px;
    }}
    .panel button {{
      background: #2563eb;
      color: white;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
    }}
    .legend {{
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }}
    .legend-item {{
      font-size: 12px;
      color: #cbd5e1;
      border: 1px solid #334155;
      border-radius: 999px;
      padding: 3px 8px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #0b1220;
    }}
    .legend-dot {{
      width: 10px;
      height: 10px;
      border-radius: 999px;
      display: inline-block;
    }}
    #network {{
      width: 100%;
      height: calc(100vh - 120px);
      border: 1px solid #1f2937;
      border-radius: 12px;
      background: #020617;
    }}
  </style>
</head>
<body>
  <div class="wrap">
    <h2 style="margin:0 0 8px 0;">{title}</h2>
    <div class="meta">
      <div>Nodes: <b>{len(vis_nodes)}</b></div>
      <div>Edges: <b>{len(vis_edges)}</b></div>
      <div>Communities: <b>{len(community_ids)}</b></div>
    </div>
    <div class="legend" id="legend"></div>
    <div class="panel">
      <input id="searchInput" placeholder="Search node label..." />
      <button id="searchBtn">Focus</button>
      <button id="resetBtn">Reset</button>
    </div>
    <div id="network"></div>
  </div>

  <script>
    const nodesData = {json.dumps(vis_nodes, ensure_ascii=False)};
    const edgesData = {json.dumps(vis_edges, ensure_ascii=False)};
    const palette = [
      "#60a5fa","#f59e0b","#34d399","#f472b6","#a78bfa","#f87171",
      "#22d3ee","#84cc16","#fb7185","#2dd4bf","#eab308","#38bdf8"
    ];
    const communityLabels = {json.dumps(community_labels, ensure_ascii=False)};
    const groupsSet = Array.from(new Set(nodesData.map(n => n.group))).sort();
    const groups = {{}};
    groupsSet.forEach((g, idx) => {{
      const c = palette[idx % palette.length];
      groups[g] = {{
        color: {{
          background: c,
          border: "#0f172a",
          highlight: {{ background: "#f8fafc", border: c }}
        }},
        font: {{ color: "#e5e7eb" }}
      }};
    }});

    const nodes = new vis.DataSet(nodesData);
    const edges = new vis.DataSet(edgesData);
    const container = document.getElementById("network");
    const data = {{ nodes, edges }};
    const options = {{
      interaction: {{
        hover: true,
        navigationButtons: true,
        keyboard: true
      }},
      physics: {{
        stabilization: false,
        barnesHut: {{
          gravitationalConstant: -6000,
          springLength: 120,
          springConstant: 0.02
        }}
      }},
      nodes: {{
        font: {{ color: "#e5e7eb" }}
      }},
      groups,
      edges: {{
        color: {{ color: "#93c5fd", highlight: "#fbbf24" }},
        smooth: {{ type: "dynamic" }},
        font: {{ size: 10, color: "#cbd5e1" }}
      }}
    }};

    const network = new vis.Network(container, data, options);
    const legend = document.getElementById("legend");
    groupsSet.forEach((g, idx) => {{
      const c = palette[idx % palette.length];
      const div = document.createElement("div");
      div.className = "legend-item";
      div.innerHTML = `<span class="legend-dot" style="background:${{c}}"></span>${{communityLabels[g] || g}}`;
      legend.appendChild(div);
    }});

    document.getElementById("searchBtn").addEventListener("click", () => {{
      const term = document.getElementById("searchInput").value.trim().toLowerCase();
      if (!term) return;
      const all = nodes.get();
      const found = all.find(n => (n.label || "").toLowerCase().includes(term));
      if (!found) return;
      network.selectNodes([found.id]);
      network.focus(found.id, {{ scale: 1.2, animation: true }});
    }});

    document.getElementById("resetBtn").addEventListener("click", () => {{
      network.fit({{ animation: true }});
      network.unselectAll();
      document.getElementById("searchInput").value = "";
    }});

    network.once("stabilizationIterationsDone", () => {{
      network.fit({{ animation: true }});
    }});
  </script>
</body>
</html>"""

        with open(out_path, "w", encoding="utf-8") as handle:
            handle.write(html)
        return out_path
