'use client';

import dagre from '@dagrejs/dagre';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import { Search } from 'lucide-react';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Concept, ConceptProgress, Relation } from '@/lib/types';

const NODE_W = 196;
const NODE_H = 58;
const CORE_LIMIT = 24;

type Direction = 'LR' | 'TB';
type ConceptNodeData = { concept: Concept; mastery?: ConceptProgress['mastery']; dim: boolean; focus: boolean; direction: Direction };

const KIND_COLOR: Record<Concept['kind'], string> = { topic: 'var(--topic)', concept: 'var(--concept)', detail: 'var(--detail)' };
const MASTERY: Record<ConceptProgress['mastery'], { color: string; label: string }> = {
  new: { color: 'var(--ink-3)', label: 'Not practised' },
  learning: { color: 'var(--warn)', label: 'Learning' },
  struggling: { color: 'var(--bad)', label: 'Struggling' },
  mastered: { color: 'var(--ok)', label: 'Mastered' },
};

const ConceptNode = memo(function ConceptNode({ data, selected }: NodeProps<Node<ConceptNodeData>>) {
  const { concept, mastery = 'new', dim, focus, direction } = data;
  const horizontal = direction === 'LR';
  return (
    <div
      className={`group relative flex h-[58px] w-[196px] cursor-pointer items-center gap-2.5 rounded-xl border bg-panel px-3 shadow-[0_1px_2px_rgb(0_0_0/0.06)] transition-all duration-200 ${
        selected ? 'border-accent ring-4 ring-accent/15' : focus ? 'border-accent/50' : 'border-line hover:border-ink-3'
      } ${dim ? 'opacity-25' : ''}`}
    >
      <Handle type="target" position={horizontal ? Position.Left : Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: KIND_COLOR[concept.kind] }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.8rem] font-semibold leading-tight text-ink" title={concept.name}>
          {concept.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[0.66rem] uppercase tracking-wide text-ink-3">
          {concept.kind}
          <span className="flex gap-px" aria-label={`importance ${concept.importance} of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="h-1 w-1 rounded-full" style={{ background: i < concept.importance ? KIND_COLOR[concept.kind] : 'var(--line)' }} />
            ))}
          </span>
        </div>
      </div>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-panel" style={{ background: MASTERY[mastery].color }} title={MASTERY[mastery].label} />
      <Handle type="source" position={horizontal ? Position.Right : Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-transparent" />
    </div>
  );
});

const nodeTypes = { concept: ConceptNode };

/** Draw direction: prerequisites flow forward; wholes point to their parts; concepts point to their examples. */
const drawn = (r: Relation) => (r.type === 'part_of' || r.type === 'example_of' ? { from: r.target, to: r.source } : { from: r.source, to: r.target });

const EDGE_STYLE: Record<Relation['type'], { stroke: string; dash?: string; width: number }> = {
  prerequisite_of: { stroke: 'var(--accent)', width: 1.6 },
  part_of: { stroke: 'var(--ink-3)', width: 1.3 },
  example_of: { stroke: 'var(--detail)', dash: '2 4', width: 1.3 },
  related_to: { stroke: 'var(--ink-3)', dash: '6 5', width: 1 },
};

export const RELATION_LABEL: Record<Relation['type'], string> = {
  prerequisite_of: 'prerequisite for',
  part_of: 'part of',
  example_of: 'example of',
  related_to: 'related to',
};

function layoutIn(direction: Direction, concepts: Concept[], relations: Relation[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph(direction === 'LR' ? { rankdir: 'LR', nodesep: 18, ranksep: 80, marginx: 20, marginy: 20 } : { rankdir: 'TB', nodesep: 26, ranksep: 56, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const c of concepts) g.setNode(c.id, { width: NODE_W, height: NODE_H });
  for (const r of relations) {
    const { from, to } = drawn(r);
    if (g.hasNode(from) && g.hasNode(to)) g.setEdge(from, to);
  }
  dagre.layout(g);
  const { width = 1, height = 1 } = g.graph();
  return { direction, width, height, positions: new Map(concepts.map((c) => [c.id, { x: g.node(c.id).x - NODE_W / 2, y: g.node(c.id).y - NODE_H / 2 }])) };
}

/** Lays the graph out both ways and keeps whichever direction can be shown at the larger zoom in the available space. */
function layout(concepts: Concept[], relations: Relation[], box: { w: number; h: number }) {
  const options = (['LR', 'TB'] as const).map((d) => layoutIn(d, concepts, relations));
  const zoom = (o: (typeof options)[number]) => Math.min(box.w / o.width, box.h / o.height);
  return zoom(options[1]) > zoom(options[0]) * 1.05 ? options[1] : options[0];
}

interface Props {
  concepts: Concept[];
  relations: Relation[];
  progress: Record<string, ConceptProgress>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

function Graph({ concepts: allConcepts, relations: allRelations, progress, selected, onSelect }: Props) {
  const flow = useReactFlow();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<'core' | 'all'>('core');
  const large = allConcepts.length > CORE_LIMIT;
  const q = query.trim().toLowerCase();
  // Large libraries open on their core concepts so labels stay readable; search and selection reveal the rest.
  const concepts = useMemo(() => {
    if (!large || scope === 'all') return allConcepts;
    const ranked = [...allConcepts].sort((a, b) => b.importance - a.importance || b.chunkIds.length - a.chunkIds.length);
    const keep = new Set(ranked.slice(0, CORE_LIMIT).map((c) => c.id));
    if (selected) keep.add(selected);
    if (q) for (const c of allConcepts) if (c.name.toLowerCase().includes(q)) keep.add(c.id);
    return allConcepts.filter((c) => keep.has(c.id));
  }, [allConcepts, large, scope, selected, q]);
  const relations = useMemo(() => {
    const ids = new Set(concepts.map((c) => c.id));
    return allRelations.filter((r) => ids.has(r.source) && ids.has(r.target));
  }, [concepts, allRelations]);
  const container = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 900, h: 700 });
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // Only re-layout on meaningful shape changes (e.g. rotating a phone), not on every pixel.
      setBox((b) => (Math.abs(b.w / b.h - width / Math.max(height, 1)) > 0.25 ? { w: width, h: Math.max(height, 1) } : b));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const { positions, direction } = useMemo(() => layout(concepts, relations, box), [concepts, relations, box]);

  const neighbours = useMemo(() => {
    if (!selected) return null;
    const set = new Set([selected]);
    for (const r of relations) {
      if (r.source === selected) set.add(r.target);
      if (r.target === selected) set.add(r.source);
    }
    return set;
  }, [selected, relations]);

  const matches = useMemo(() => {
    return q ? new Set(concepts.filter((c) => c.name.toLowerCase().includes(q)).map((c) => c.id)) : null;
  }, [q, concepts]);

  const nodes: Node<ConceptNodeData>[] = useMemo(
    () =>
      concepts.map((c) => ({
        id: c.id,
        type: 'concept',
        position: positions.get(c.id)!,
        selected: c.id === selected,
        data: { direction, concept: c, mastery: progress[c.id]?.mastery, dim: Boolean((neighbours && !neighbours.has(c.id)) || (matches && !matches.has(c.id))), focus: Boolean(matches?.has(c.id)) },
      })),
    [concepts, positions, direction, selected, progress, neighbours, matches],
  );

  const edges: Edge[] = useMemo(
    () =>
      relations.map((r) => {
        const { from, to } = drawn(r);
        const style = EDGE_STYLE[r.type];
        const active = selected && (r.source === selected || r.target === selected);
        const dim = selected && !active;
        return {
          id: r.id,
          source: from,
          target: to,
          type: 'default',
          animated: r.type === 'prerequisite_of' && Boolean(active),
          label: active ? r.label || RELATION_LABEL[r.type] : undefined,
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: style.stroke },
          style: { stroke: style.stroke, strokeWidth: active ? style.width + 0.8 : style.width, strokeDasharray: style.dash, opacity: dim ? 0.12 : 0.85 },
        };
      }),
    [relations, selected],
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => flow.fitView({ padding: 0.12, duration: 400, minZoom: 0.45 }));
    return () => cancelAnimationFrame(id);
  }, [concepts.length, relations.length, direction, flow]);

  useEffect(() => {
    if (!matches || matches.size === 0) return;
    flow.fitView({ nodes: [...matches].map((id) => ({ id })), padding: 0.6, duration: 350, maxZoom: 1.2 });
  }, [matches, flow]);

  return (
    <div ref={container} className="relative h-full w-full">
      <ReactFlow
        fitView
        fitViewOptions={{ padding: 0.12, minZoom: 0.45 }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelect(node.id === selected ? null : node.id)}
        onPaneClick={() => onSelect(null)}
        nodesDraggable
        nodesConnectable={false}
        edgesFocusable={false}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={22} size={1.2} color="var(--grid)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>

      <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2">
          <label className="flex h-9 w-60 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 shadow-sm">
            <Search className="h-4 w-4 text-ink-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Find among ${allConcepts.length} concepts`} className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-3" />
          </label>
          {large && (
            <div className="flex h-9 items-center rounded-lg border border-line bg-panel p-0.5 shadow-sm">
              {(['core', 'all'] as const).map((s) => (
                <button key={s} onClick={() => setScope(s)} className={`h-full rounded-md px-2.5 text-xs font-medium ${scope === s ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:text-ink-2'}`}>
                  {s === 'core' ? `Core ${CORE_LIMIT}` : `All ${allConcepts.length}`}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pointer-events-auto hidden flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line bg-panel/90 px-3 py-2 text-[0.7rem] text-ink-2 shadow-sm backdrop-blur md:flex">
          {(['topic', 'concept', 'detail'] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5 capitalize">
              <span className="h-2.5 w-1 rounded-full" style={{ background: KIND_COLOR[k] }} />
              {k}
            </span>
          ))}
          <span className="h-3 w-px bg-line" />
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="var(--accent)" strokeWidth="1.6" /></svg>prerequisite
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="var(--ink-3)" strokeWidth="1.3" /></svg>has part
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="var(--detail)" strokeWidth="1.3" strokeDasharray="2 4" /></svg>example
          </span>
          <span className="h-3 w-px bg-line" />
          {(['mastered', 'learning', 'struggling'] as const).map((m) => (
            <span key={m} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: MASTERY[m].color }} />
              {MASTERY[m].label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ConceptMap(props: Props) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  );
}
