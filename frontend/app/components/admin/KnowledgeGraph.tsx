'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

interface RawNode {
  id: string;
  label?: string;
  entity_type?: string;
  canonical_name?: string;
  community_id?: number;
  community_label?: string;
  leiden_community_id?: number | string;
  aliases?: string[];
}

interface RawLink {
  source: string;
  target: string;
  relation?: string;
  confidence?: number;
}

interface GraphPayload {
  nodes: RawNode[];
  links: RawLink[];
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  group: number;
  groupLabel: string;
  entityType: string;
  aliases: string[];
  color: string;
  degree: number;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  relation: string;
  confidence: number;
  /** Index among parallel edges, used to curve them apart. */
  curve: number;
}

interface DragSubject {
  x: number;
  y: number;
  node: SimNode;
}

const PALETTE = [
  '#60a5fa', '#f59e0b', '#34d399', '#f472b6', '#a78bfa', '#f87171',
  '#22d3ee', '#84cc16', '#fb7185', '#2dd4bf', '#eab308', '#38bdf8',
];

const NODE_RADIUS = 9;
const DOT_GAP = 24;
const ARROW_SIZE = 7;
/** Below this zoom level only hub nodes keep their labels. */
const LABEL_ZOOM = 1.5;
const HUB_DEGREE = 4;
const PRETICKS = 300;

export default function KnowledgeGraph({ url }: { url: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const focusRef = useRef<(query: string) => void>(() => {});
  const resetRef = useRef<() => void>(() => {});

  const [data, setData] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tooltip, setTooltip] = useState<{ x: number; y: number; lines: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('Không tải được dữ liệu đồ thị');
        return res.json();
      })
      .then((json: GraphPayload) => !cancelled && setData(json))
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [url]);

  const legend = useMemo(() => {
    if (!data) return [];
    const groups = new Map<number, string>();
    data.nodes.forEach((n) => {
      const id = Number(n.community_id ?? -1);
      if (!groups.has(id)) groups.set(id, n.community_label ?? `Community ${id}`);
    });
    return [...groups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([id, label], idx) => ({ id, label, color: PALETTE[idx % PALETTE.length] }));
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!data || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colorOf = new Map(legend.map((g) => [g.id, g.color]));

    const nodes: SimNode[] = data.nodes.map((n) => {
      const group = Number(n.community_id ?? -1);
      return {
        id: n.id,
        label: n.label ?? n.id,
        group,
        groupLabel: n.community_label ?? '',
        entityType: n.entity_type ?? 'AcademicEntity',
        aliases: n.aliases ?? [],
        color: colorOf.get(group) ?? '#94a3b8',
        degree: 0,
      };
    });
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Parallel edges between the same pair get different curvature.
    const pairCount = new Map<string, number>();
    const links: SimLink[] = [];
    const adjacency = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set([n.id])]));
    data.links.forEach((l) => {
      const s = nodeById.get(l.source);
      const t = nodeById.get(l.target);
      if (!s || !t) return;
      const key = [l.source, l.target].sort().join('||');
      const curve = pairCount.get(key) ?? 0;
      pairCount.set(key, curve + 1);
      s.degree += 1;
      t.degree += 1;
      adjacency.get(s.id)!.add(t.id);
      adjacency.get(t.id)!.add(s.id);
      links.push({
        source: l.source,
        target: l.target,
        relation: l.relation ?? 'related_to',
        confidence: l.confidence ?? 0,
        curve,
      });
    });

    // Highlight state shared with the draw loop.
    let transform = d3.zoomIdentity;
    let hoverId: string | null = null;
    let focusKeep: Set<string> | null = null;
    let focusMatches: Set<string> = new Set();
    let raf = 0;

    const width = canvas.clientWidth || 1000;
    const height = canvas.clientHeight || 640;

    const simulation = d3
      .forceSimulation<SimNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(90),
      )
      .force('charge', d3.forceManyBody().strength(-220))
      // Isolated nodes have no links to hold them, so pull them in harder.
      .force('x', d3.forceX<SimNode>(width / 2).strength((n) => (n.degree === 0 ? 0.12 : 0.04)))
      .force('y', d3.forceY<SimNode>(height / 2).strength((n) => (n.degree === 0 ? 0.12 : 0.04)))
      .force('collide', d3.forceCollide(NODE_RADIUS + 6))
      .stop();

    // Settle the layout up front so the first frame is already stable.
    for (let i = 0; i < PRETICKS; i++) simulation.tick();

    const schedule = () => {
      if (!raf) {
        raf = requestAnimationFrame(() => {
          raf = 0;
          draw();
        });
      }
    };

    const geo = { sx: 0, sy: 0, cx: 0, cy: 0, tx: 0, ty: 0, ex: 0, ey: 0, ux: 0, uy: 0, loop: false };

    function shape(l: SimLink) {
      const s = l.source as SimNode;
      const t = l.target as SimNode;
      const sx = s.x ?? 0;
      const sy = s.y ?? 0;
      const tx = t.x ?? 0;
      const ty = t.y ?? 0;
      geo.sx = sx;
      geo.sy = sy;
      geo.tx = tx;
      geo.ty = ty;
      geo.loop = s === t;
      if (geo.loop) return;

      const dx = tx - sx;
      const dy = ty - sy;
      const dist = Math.hypot(dx, dy) || 1;
      let cx = (sx + tx) / 2;
      let cy = (sy + ty) / 2;
      if (l.curve > 0) {
        const side = l.curve % 2 ? 1 : -1;
        const off = side * Math.ceil(l.curve / 2) * Math.min(40, dist * 0.25) * 2;
        cx += (-dy / dist) * off;
        cy += (dx / dist) * off;
      }
      let ux = tx - cx;
      let uy = ty - cy;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul;
      uy /= ul;
      geo.cx = cx;
      geo.cy = cy;
      geo.ux = ux;
      geo.uy = uy;
      geo.ex = tx - ux * (NODE_RADIUS + 1.5);
      geo.ey = ty - uy * (NODE_RADIUS + 1.5);
    }

    function draw() {
      const dpr = window.devicePixelRatio || 1;
      const W = canvas!.width / dpr;
      const H = canvas!.height / dpr;
      const { k, x: tx, y: ty } = transform;

      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.globalAlpha = 1;
      ctx!.fillStyle = '#ffffff';
      ctx!.fillRect(0, 0, W, H);

      // Dot grid, anchored to the graph so it pans and zooms with it.
      // When zoomed far out, double the spacing so the dots never turn into a smear.
      let gap = DOT_GAP * k;
      while (gap < 12) gap *= 2;
      const ox = ((tx % gap) + gap) % gap;
      const oy = ((ty % gap) + gap) % gap;
      ctx!.fillStyle = '#cbd5e1';
      ctx!.beginPath();
      for (let x = ox; x < W; x += gap) {
        for (let y = oy; y < H; y += gap) ctx!.rect(x - 1, y - 1, 2, 2);
      }
      ctx!.fill();

      ctx!.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);

      const margin = 60 / k;
      const x0 = transform.invertX(0) - margin;
      const x1 = transform.invertX(W) + margin;
      const y0 = transform.invertY(0) - margin;
      const y1 = transform.invertY(H) + margin;
      const inView = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;

      const hover = hoverId;
      const active: Set<string> | null = hover ? (adjacency.get(hover) ?? null) : focusKeep;
      const edgeActive = (l: SimLink) => {
        const s = (l.source as SimNode).id;
        const t = (l.target as SimNode).id;
        if (hover) return s === hover || t === hover;
        return !focusKeep || (focusKeep.has(s) && focusKeep.has(t));
      };
      const nodeActive = (n: SimNode) => !active || active.has(n.id);

      const pathEdge = (l: SimLink) => {
        shape(l);
        if (!inView(geo.sx, geo.sy) && !inView(geo.tx, geo.ty)) return false;
        if (geo.loop) {
          const r = 8 + l.curve * 5;
          const cy = geo.sy - r * 0.9;
          ctx!.moveTo(geo.sx + r, cy);
          ctx!.arc(geo.sx, cy, r, 0, Math.PI * 2);
        } else {
          ctx!.moveTo(geo.sx, geo.sy);
          if (l.curve > 0) ctx!.quadraticCurveTo(geo.cx, geo.cy, geo.ex, geo.ey);
          else ctx!.lineTo(geo.ex, geo.ey);
        }
        return true;
      };

      const edgePass = (wantActive: boolean, alpha: number) => {
        ctx!.globalAlpha = alpha;
        ctx!.strokeStyle = '#64748b';
        ctx!.fillStyle = '#64748b';
        ctx!.lineWidth = 1.2;

        ctx!.beginPath();
        const arrows: number[] = [];
        for (const l of links) {
          if (edgeActive(l) !== wantActive) continue;
          if (!pathEdge(l) || geo.loop) continue;
          arrows.push(geo.ex, geo.ey, geo.ux, geo.uy);
        }
        ctx!.stroke();

        ctx!.beginPath();
        for (let i = 0; i < arrows.length; i += 4) {
          const [ex, ey, ux, uy] = [arrows[i], arrows[i + 1], arrows[i + 2], arrows[i + 3]];
          const bx = ex - ux * ARROW_SIZE;
          const by = ey - uy * ARROW_SIZE;
          ctx!.moveTo(ex, ey);
          ctx!.lineTo(bx - uy * 3.5, by + ux * 3.5);
          ctx!.lineTo(bx + uy * 3.5, by - ux * 3.5);
        }
        ctx!.fill();
      };

      if (active) edgePass(false, 0.05);
      edgePass(true, active ? 0.8 : 0.6);

      // Relation labels only when zoomed in, or for the hovered node's edges.
      if (k >= LABEL_ZOOM || hover) {
        ctx!.globalAlpha = 1;
        ctx!.font = '9px ui-sans-serif, system-ui, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.lineJoin = 'round';
        ctx!.lineWidth = 3;
        ctx!.strokeStyle = '#ffffff';
        ctx!.fillStyle = '#64748b';
        for (const l of links) {
          if (!edgeActive(l) || (!hover && focusKeep && !edgeActive(l))) continue;
          shape(l);
          const mx = geo.loop ? geo.sx : 0.25 * geo.sx + 0.5 * geo.cx + 0.25 * geo.tx;
          const my = geo.loop ? geo.sy - 26 : 0.25 * geo.sy + 0.5 * geo.cy + 0.25 * geo.ty;
          if (!inView(mx, my)) continue;
          ctx!.strokeText(l.relation, mx, my - 3);
          ctx!.fillText(l.relation, mx, my - 3);
        }
      }

      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        if (!inView(nx, ny)) continue;
        const isMatch = focusMatches.has(n.id);
        ctx!.globalAlpha = nodeActive(n) ? 1 : 0.1;
        ctx!.beginPath();
        ctx!.arc(nx, ny, NODE_RADIUS, 0, Math.PI * 2);
        ctx!.fillStyle = n.color;
        ctx!.fill();
        ctx!.lineWidth = isMatch ? 3 : 1.5;
        ctx!.strokeStyle = isMatch ? '#0f172a' : '#ffffff';
        ctx!.stroke();
      }

      ctx!.font = '11px ui-sans-serif, system-ui, sans-serif';
      ctx!.textAlign = 'left';
      ctx!.lineJoin = 'round';
      ctx!.lineWidth = 3;
      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        if (!inView(nx, ny) || !nodeActive(n)) continue;
        const show =
          k >= LABEL_ZOOM || n.degree >= HUB_DEGREE || focusMatches.has(n.id) || n.id === hover;
        if (!show) continue;
        ctx!.globalAlpha = 1;
        ctx!.strokeStyle = '#ffffff';
        ctx!.fillStyle = '#0f172a';
        ctx!.strokeText(n.label, nx + NODE_RADIUS + 4, ny + 4);
        ctx!.fillText(n.label, nx + NODE_RADIUS + 4, ny + 4);
      }
      ctx!.globalAlpha = 1;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
      schedule();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const fitTransform = () => {
      const pad = 40;
      const W = canvas.clientWidth || width;
      const H = canvas.clientHeight || height;
      if (!nodes.length) return d3.zoomIdentity;
      // Fit the bulk of the graph so a few stray nodes don't shrink the view.
      const xs = nodes.map((n) => n.x ?? 0).sort(d3.ascending);
      const ys = nodes.map((n) => n.y ?? 0).sort(d3.ascending);
      const minX = d3.quantile(xs, 0.03) ?? 0;
      const maxX = d3.quantile(xs, 0.97) ?? 0;
      const minY = d3.quantile(ys, 0.03) ?? 0;
      const maxY = d3.quantile(ys, 0.97) ?? 0;
      const k = Math.min(
        (W - pad * 2) / (maxX - minX || 1),
        (H - pad * 2) / (maxY - minY || 1),
        1.5,
      );
      return d3.zoomIdentity
        .translate(W / 2 - (k * (minX + maxX)) / 2, H / 2 - (k * (minY + maxY)) / 2)
        .scale(k);
    };

    const selection = d3.select(canvas);

    const nodeAt = (px: number, py: number) => {
      const [gx, gy] = transform.invert([px, py]);
      return simulation.find(gx, gy, NODE_RADIUS + 2);
    };

    const drag = d3
      .drag<HTMLCanvasElement, unknown, DragSubject | undefined>()
      .container(canvas)
      .subject((event) => {
        const node = nodeAt(event.x, event.y);
        return node
          ? { x: transform.applyX(node.x ?? 0), y: transform.applyY(node.y ?? 0), node }
          : undefined;
      })
      .on('start', (event) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.node.fx = transform.invertX(event.x);
        event.subject.node.fy = transform.invertY(event.y);
      })
      .on('drag', (event) => {
        event.subject.node.fx = transform.invertX(event.x);
        event.subject.node.fy = transform.invertY(event.y);
      })
      .on('end', (event) => {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.node.fx = null;
        event.subject.node.fy = null;
      });

    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.05, 8])
      .on('zoom', (event) => {
        transform = event.transform;
        schedule();
      });

    // Drag must be registered before zoom so grabbing a node stops the pan.
    selection.call(drag).call(zoom).on('dblclick.zoom', null);
    selection.call(zoom.transform, fitTransform());

    simulation.on('tick', schedule);

    selection
      .on('mousemove.kg', (event: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const node = nodeAt(px, py);
        canvas.style.cursor = node ? 'pointer' : '';
        if (!node) {
          if (hoverId) {
            hoverId = null;
            setTooltip(null);
            schedule();
          }
          return;
        }
        if (hoverId !== node.id) {
          hoverId = node.id;
          schedule();
        }
        setTooltip({
          x: px + 12,
          y: py + 12,
          lines: [
            `id: ${node.id}`,
            `label: ${node.label}`,
            `entity_type: ${node.entityType}`,
            `community: ${node.groupLabel}`,
            `aliases: ${node.aliases.join(', ')}`,
          ],
        });
      })
      .on('mouseleave.kg', () => {
        canvas.style.cursor = '';
        if (hoverId) {
          hoverId = null;
          schedule();
        }
        setTooltip(null);
      });

    resetRef.current = () => {
      focusKeep = null;
      focusMatches = new Set();
      selection.transition().duration(500).call(zoom.transform, fitTransform());
      schedule();
    };

    focusRef.current = (q: string) => {
      const needle = q.trim().toLowerCase();
      const matches = needle ? nodes.filter((n) => n.label.toLowerCase().includes(needle)) : [];
      if (!matches.length) {
        focusKeep = null;
        focusMatches = new Set();
        schedule();
        return;
      }

      const keep = new Set(matches.map((n) => n.id));
      links.forEach((l) => {
        const s = (l.source as SimNode).id;
        const t = (l.target as SimNode).id;
        if (keep.has(s) || keep.has(t)) {
          keep.add(s);
          keep.add(t);
        }
      });
      focusKeep = keep;
      focusMatches = new Set(matches.map((n) => n.id));

      const W = canvas.clientWidth || width;
      const H = canvas.clientHeight || height;
      const first = matches[0];
      selection
        .transition()
        .duration(600)
        .call(
          zoom.transform,
          d3.zoomIdentity
            .translate(W / 2, H / 2)
            .scale(2)
            .translate(-(first.x ?? 0), -(first.y ?? 0)),
        );
      schedule();
    };

    return () => {
      simulation.stop();
      selection.interrupt();
      selection.on('.zoom', null).on('.drag', null).on('.kg', null);
      resizeObserver.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [data, legend]);

  if (error) {
    return (
      <div className="admin-card">
        <h2 className="admin-card-title">Không thể hiển thị đồ thị</h2>
        <p className="admin-card-sub">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {data ? (
        <div className="kg-meta">
          <span>Nodes: <b>{data.nodes.length}</b></span>
          <span>Edges: <b>{data.links.length}</b></span>
          <span>Communities: <b>{legend.length}</b></span>
        </div>
      ) : null}

      <div className="kg-legend">
        {legend.map((g) => (
          <span key={g.id} className="kg-legend-item">
            <span className="kg-legend-dot" style={{ background: g.color }} />
            {g.label}
          </span>
        ))}
      </div>

      <form
        className="kg-toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          focusRef.current(query);
        }}
      >
        <input
          className="admin-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm nút theo nhãn..."
        />
        <button className="admin-btn" type="submit">Focus</button>
        <button
          className="admin-btn admin-btn-ghost"
          type="button"
          onClick={() => {
            setQuery('');
            resetRef.current();
          }}
        >
          Reset
        </button>
      </form>

      <div className="kg-canvas">
        <canvas ref={canvasRef} className="kg-surface" role="img" aria-label="Knowledge graph" />
        {!data ? <div className="kg-loading">Đang tải đồ thị…</div> : null}
        {tooltip ? (
          <div className="kg-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            {tooltip.lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
