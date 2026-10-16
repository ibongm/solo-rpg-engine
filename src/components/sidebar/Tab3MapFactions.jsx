import { useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Castle, Skull, Tent, Home, Landmark, Navigation, Flame, Users } from 'lucide-react';
import { useGameStore } from '../../store/useGameStore.js';
import { travelTo } from '../../store/localActions.js';
import { formatDuration } from '../../engine/clockWeatherEngine.js';
import { BipolarMeter, Meter } from '../common/ui.jsx';

const NODE_ICON = { town: Castle, dungeon: Skull, camp: Tent, safehouse: Home, landmark: Landmark };

function PlaceNode({ data }) {
  const Icon = NODE_ICON[data.type] || Landmark;
  return (
    <div
      className={`flex min-w-[96px] max-w-[150px] items-center gap-1.5 rounded-theme border-theme px-2 py-1 text-[11px] shadow-theme ${
        data.current ? 'border-accent bg-accent text-accent-ink' : data.reachable ? 'border-accent-2 bg-surface text-ink' : data.discovered ? 'border-line bg-surface text-ink' : 'border-dashed border-line/60 bg-surface-2/70 text-muted'
      }`}
      title={data.description || data.label}
    >
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-semibold">{data.label}</span>
      {data.safehouse && <Home className="h-3 w-3 shrink-0" />}
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { place: PlaceNode };

export default function Tab3MapFactions() {
  const campaign = useGameStore((s) => s.campaign);
  const busy = useGameStore((s) => s.busy);
  const [selectedId, setSelectedId] = useState(null);
  const currentId = campaign.worldState.currentNodeId;
  const current = campaign.mapNodes.find((n) => n.id === currentId);
  const reachable = new Map((current?.connectedTo || []).map((c) => [c.targetNodeId, c.travelMinutes]));
  const safehouseId = campaign.worldState.safehouse?.nodeId;

  const { nodes, edges } = useMemo(() => {
    const visibleIds = new Set();
    for (const n of campaign.mapNodes) {
      if (n.discovered) {
        visibleIds.add(n.id);
        for (const c of n.connectedTo || []) visibleIds.add(c.targetNodeId);
      }
    }
    const nodesOut = campaign.mapNodes
      .filter((n) => visibleIds.has(n.id))
      .map((n) => ({
        id: n.id,
        type: 'place',
        position: n.position || { x: 0, y: 0 },
        data: {
          label: n.discovered ? n.label : `${n.label} (unexplored)`,
          type: n.type,
          description: n.description,
          discovered: n.discovered,
          current: n.id === currentId,
          reachable: reachable.has(n.id),
          safehouse: n.id === safehouseId,
        },
        draggable: false,
      }));
    const seen = new Set();
    const edgesOut = [];
    for (const n of campaign.mapNodes) {
      if (!visibleIds.has(n.id)) continue;
      for (const c of n.connectedTo || []) {
        if (!visibleIds.has(c.targetNodeId)) continue;
        const key = [n.id, c.targetNodeId].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        const fromCurrent = n.id === currentId || c.targetNodeId === currentId;
        edgesOut.push({
          id: key,
          source: n.id,
          target: c.targetNodeId,
          label: formatDuration(c.travelMinutes),
          animated: fromCurrent,
          style: { stroke: fromCurrent ? 'rgb(var(--c-accent))' : 'rgb(var(--c-border))', strokeWidth: fromCurrent ? 2 : 1.25 },
          labelStyle: { fill: 'rgb(var(--c-muted))', fontSize: 10, fontFamily: 'var(--font-mono)' },
          labelBgStyle: { fill: 'rgb(var(--c-surface))' },
        });
      }
    }
    return { nodes: nodesOut, edges: edgesOut };
  }, [campaign.mapNodes, currentId, safehouseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = campaign.mapNodes.find((n) => n.id === selectedId);
  const canTravel = selected && reachable.has(selected.id) && !campaign.combat?.inCombat && campaign.meta.status === 'active';

  return (
    <div className="space-y-5">
      <section>
        <h3 className="section-title mb-2">Node Map</h3>
        <div className="h-72 overflow-hidden rounded-theme border-theme border-line/40 bg-surface-2/40">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.3}
            maxZoom={1.75}
            nodesConnectable={false}
            nodesDraggable={false}
            elementsSelectable
            onNodeClick={(_, n) => setSelectedId(n.id)}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1} color="rgb(var(--c-border) / 0.35)" />
            <Controls showInteractive={false} position="bottom-right" />
          </ReactFlow>
        </div>
        {selected ? (
          <div className="card-inset mt-2 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <strong>{selected.label}</strong>
              <span className="pill capitalize">{selected.type}</span>
            </div>
            {selected.description && <p className="mt-1 text-xs text-muted">{selected.description}</p>}
            {selected.id === currentId ? (
              <p className="mt-2 text-xs text-accent">You are here.</p>
            ) : reachable.has(selected.id) ? (
              <button className="btn-primary mt-2 w-full" onClick={() => travelTo(selected.id)} disabled={!canTravel || busy}>
                <Navigation className="h-4 w-4" /> Travel ({formatDuration(reachable.get(selected.id))}) — advances the clock
              </button>
            ) : (
              <p className="mt-2 text-xs text-muted">No known route from here.</p>
            )}
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted">Click a highlighted node connected to your location to travel.</p>
        )}
      </section>

      <section>
        <h3 className="section-title mb-2 flex items-center gap-1.5">
          <Users className="h-4 w-4" /> Factions
        </h3>
        <div className="space-y-3">
          {campaign.factions.map((f) => (
            <div key={f.id} className="card-inset p-3">
              <div className="flex items-center justify-between">
                <strong className="text-sm">{f.name}</strong>
                <span className="pill text-[10px]">{f.status}</span>
              </div>
              <p className="mb-2 text-xs text-muted">{f.description}</p>
              <BipolarMeter value={f.reputation} label="Reputation" />
              <Meter
                className="mt-1.5"
                value={f.heat}
                max={100}
                label={
                  <span className="flex items-center gap-1">
                    <Flame className="h-3 w-3" /> Heat
                  </span>
                }
                colorClass={f.heat >= 70 ? 'bg-danger' : f.heat >= 40 ? 'bg-warning' : 'bg-accent-2'}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
