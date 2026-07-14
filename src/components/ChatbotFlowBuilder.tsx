import React, { useState, useEffect } from 'react';
import { ChatbotFlow, ChatbotNode, ChatbotNodeType } from '../types';
import { Plus, Check, Settings, Trash2, ArrowUpRight, HelpCircle, Bot, AlertCircle, Save, Sliders, Layout, Network, RefreshCw } from 'lucide-react';

interface ChatbotFlowBuilderProps {
  initialFlow: ChatbotFlow;
  botEnabled?: boolean;
  onSaveFlow: (updatedFlow: ChatbotFlow) => void | Promise<void>;
}

export default function ChatbotFlowBuilder({ initialFlow, botEnabled = false, onSaveFlow }: ChatbotFlowBuilderProps) {
  const [activeFlow, setActiveFlow] = useState<ChatbotFlow>(initialFlow);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('node-start');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setActiveFlow(initialFlow);
    setSelectedNodeId(initialFlow.nodes[0]?.id || 'node-start');
  }, [initialFlow]);
  
  // Drag and coordinate offsets simulation state
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const activeNode = activeFlow.nodes.find(n => n.id === selectedNodeId) || activeFlow.nodes[0];

  const handleUpdateNodeConfig = (nodeId: string, updatedConfig: Partial<ChatbotNode['config']> & { title?: string }) => {
    const updatedNodes = activeFlow.nodes.map(n => {
      if (n.id === nodeId) {
        return {
          ...n,
          title: updatedConfig.title !== undefined ? updatedConfig.title : n.title,
          config: {
            ...n.config,
            ...updatedConfig
          }
        };
      }
      return n;
    });

    const updatedFlow = { ...activeFlow, nodes: updatedNodes };
    setActiveFlow(updatedFlow);
    onSaveFlow(updatedFlow);
  };

  const handleAddNode = (type: ChatbotNodeType) => {
    const defaultTitles: Record<ChatbotNodeType, string> = {
      START: 'New Message Trigger',
      MESSAGE: 'Send Text Prompt',
      CHOICE: 'Offer Buttons Menu',
      CONDITION: 'Conditional Rule Check',
      HANDOFF: 'Escalate to Sales',
      END: 'End Bot Conversation'
    };

    const newId = `node-${Date.now()}`;
    const newNode: ChatbotNode = {
      id: newId,
      type,
      title: defaultTitles[type],
      position: {
        x: activeFlow.nodes.length * 40 + 100,
        y: activeFlow.nodes.length * 30 + 100
      },
      config: {
        messageText: 'Auto reply text goes here...',
        choices: type === 'CHOICE' ? [{ label: 'Option 1', nextNodeId: 'node-game-flow' }] : undefined,
        routingStrategy: type === 'HANDOFF' ? 'round-robin' : undefined
      }
    };

    const updatedNodes = [...activeFlow.nodes, newNode];
    
    // Create an edge from the currently selected node to the new node to make drawing logical
    const newEdge = {
      id: `edge-${Date.now()}`,
      sourceId: selectedNodeId,
      targetId: newId,
      sourceHandle: type === 'CHOICE' ? 'Option 1' : undefined
    };

    const updatedFlow = {
      ...activeFlow,
      nodes: updatedNodes,
      edges: [...activeFlow.edges, newEdge]
    };

    setActiveFlow(updatedFlow);
    setSelectedNodeId(newId);
    onSaveFlow(updatedFlow);
  };

  const handleDeleteNode = (nodeId: string) => {
    if (nodeId === 'node-start') {
      alert('Delete warning: The START node cannot be deleted as it registers incoming webhooks.');
      return;
    }

    const updatedNodes = activeFlow.nodes.filter(n => n.id !== nodeId);
    const updatedEdges = activeFlow.edges.filter(e => e.sourceId !== nodeId && e.targetId !== nodeId);

    const updatedFlow = {
      ...activeFlow,
      nodes: updatedNodes,
      edges: updatedEdges
    };

    setActiveFlow(updatedFlow);
    setSelectedNodeId('node-start'); // Fallback to start
    onSaveFlow(updatedFlow);
  };

  const getNodeColorClass = (type: ChatbotNodeType) => {
    switch (type) {
      case 'START': return 'bg-emerald-50 text-emerald-800 border-emerald-300';
      case 'MESSAGE': return 'bg-blue-50 text-blue-800 border-blue-300';
      case 'CHOICE': return 'bg-indigo-50 text-indigo-800 border-indigo-300';
      case 'CONDITION': return 'bg-yellow-50 text-yellow-805 border-yellow-300';
      case 'HANDOFF': return 'bg-orange-50 text-orange-800 border-orange-300';
      case 'END': return 'bg-rose-50 text-rose-800 border-rose-300';
      default: return 'bg-slate-50 text-slate-800 border-slate-300';
    }
  };

  // Helper code to return bezier points from source node coordinates to target node coordinates
  const calculateCurvePath = (sourceNode: ChatbotNode, targetNode: ChatbotNode) => {
    // Basic approximate handle offsets
    const startX = sourceNode.position.x + panOffset.x + 190; // right edge of card
    const startY = sourceNode.position.y + panOffset.y + 40;  // half level of card
    const endX = targetNode.position.x + panOffset.x;         // left edge of target
    const endY = targetNode.position.y + panOffset.y + 40;

    const controlX = startX + (endX - startX) / 2;

    return `M ${startX} ${startY} C ${controlX} ${startY}, ${controlX} ${endY}, ${endX} ${endY}`;
  };

  return (
    <div className="space-y-6" id="chatbot-builder-root">
      
      {/* Module Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-slate-900 flex items-center gap-2">
            No-Code Chatbot Flow Designer
            <span className="text-[10px] font-mono font-semibold bg-emerald-150 text-emerald-800 px-2 py-0.5 rounded uppercase">
              Core Engine v2
            </span>
          </h1>
          <p className="text-xs text-slate-500">
            Define conversational branching, reply quick-buttons menus, and automate human escalations parameters.
          </p>
        </div>

        {/* Node creation quick selections */}
        <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-100 p-1 rounded-xl border border-slate-200">
          <span className="text-[10px] uppercase font-bold text-slate-400 font-mono px-2">Spawn:</span>
          <button
            onClick={() => handleAddNode('MESSAGE')}
            className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-1 rounded-lg border border-slate-205 transition-all text-[11px]"
          >
            💬 Reply prompt
          </button>
          <button
            onClick={() => handleAddNode('CHOICE')}
            className="bg-white hover:bg-slate-50 text-slate-700 px-3 py-1 rounded-lg border border-slate-205 transition-all text-[11px]"
          >
            🔘 Options
          </button>
          <button
            onClick={() => handleAddNode('HANDOFF')}
            className="bg-white hover:bg-rose-50 text-orange-700 px-3 py-1 rounded-lg border border-orange-100 transition-all text-[11px]"
          >
            👥 Support Handoff
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-[calc(100vh-160px)]">
        
        {/* INTERACTIVE FLOW CANVAS AREA (3 COLS) */}
        <div className="xl:col-span-3 bg-slate-50 border border-slate-150 rounded-2xl relative overflow-hidden h-full flex flex-col justify-between shadow-inner custom-canvas-pattern select-none">
          
          {/* Top Canvas Help info banner */}
          <div className="p-3 bg-white/95 backdrop-blur-xs border-b border-slate-150 text-[11px] text-slate-655 flex justify-between items-center z-10 font-medium">
            <span className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Bot className="w-4 h-4 text-emerald-500" />
              Viewing Chatbot Flow: {activeFlow.name}
            </span>
            <span className="text-slate-400">
              💡 Tip: Click any node to open its config inspector slide-out
            </span>
          </div>

          {/* Interactive Nodes workspace map */}
          <div className="flex-1 relative cursor-grab active:cursor-grabbing overflow-auto p-4 select-none">
            
            {/* SVG LINK DIRECTIONS BOARD */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                </marker>
              </defs>

              {activeFlow.edges.map(edge => {
                const srcNode = activeFlow.nodes.find(n => n.id === edge.sourceId);
                const tgtNode = activeFlow.nodes.find(n => n.id === edge.targetId);
                
                if (!srcNode || !tgtNode) return null;

                return (
                  <g key={edge.id}>
                    <path
                      d={calculateCurvePath(srcNode, tgtNode)}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeWidth="2"
                      strokeDasharray="1"
                      markerEnd="url(#arrow)"
                      className="transition-all"
                    />
                    {/* If choice type and has source label, add mini-bubble */}
                    {edge.sourceHandle && (
                      <foreignObject
                        x={(srcNode.position.x + tgtNode.position.x) / 2 + panOffset.x + 50}
                        y={(srcNode.position.y + tgtNode.position.y) / 2 + panOffset.y + 20}
                        width="80"
                        height="20"
                        className="overflow-visible"
                      >
                        <span className="bg-slate-900 text-white font-mono text-[8px] font-semibold px-1.5 py-0.5 rounded border border-slate-750 block truncate text-center shadow-xs">
                          {edge.sourceHandle}
                        </span>
                      </foreignObject>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* NODES LIST CARDS OVERLAY */}
            {activeFlow.nodes.map(node => {
              const isSelected = node.id === selectedNodeId;
              return (
                <div
                  key={node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                  }}
                  style={{
                    left: `${node.position.x + panOffset.x}px`,
                    top: `${node.position.y + panOffset.y}px`,
                  }}
                  className={`absolute w-[190px] border rounded-xl bg-white p-3 shadow-xs hover:shadow-md cursor-pointer transition-all z-10 ${isSelected ? 'ring-2 ring-urja-primary scale-102 border-urja-primary' : 'border-slate-205'}`}
                >
                  {/* Node Type badge banner */}
                  <div className="flex justify-between items-center mb-1.5">
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono ${getNodeColorClass(node.type)}`}>
                      {node.type}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">ID: {node.id.substring(5, 9)}</span>
                  </div>

                  {/* Title */}
                  <h4 className="text-xs font-semibold text-slate-850 truncate">{node.title}</h4>

                  {/* Message body preview text snippet */}
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-1 italic font-normal">
                    {node.config.messageText || 'Click to set text prompts...'}
                  </p>

                  {/* If choice menu options indicator */}
                  {node.config.choices && node.config.choices.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                      {node.config.choices.map((ch, idx) => (
                        <span key={idx} className="bg-slate-100 text-[8px] font-medium text-slate-600 px-1.5 py-0.5 rounded font-mono truncate max-w-[80px]">
                          🔘 {ch.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Simple drag handle instructions placeholder */}
                  <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-slate-350 border border-white rounded-full z-20 hover:scale-150 transition-all cursor-crosshair flex items-center justify-center text-[6px] text-white font-bold" title="Bezier Link Out">
                    +
                  </div>
                </div>
              );
            })}

          </div>

          {/* Bottom active controller row with flowchart metrics */}
          <div className="p-3 bg-white border-t border-slate-150 text-[10px] text-slate-450 font-mono flex flex-wrap gap-4 items-center justify-between z-10">
            <div className="flex gap-4">
              <span>● Nodes total: <span className="font-semibold text-slate-800">{activeFlow.nodes.length} cards</span></span>
              <span>● Connector edges: <span className="font-semibold text-slate-800">{activeFlow.edges.length} paths</span></span>
            </div>
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${botEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              {botEnabled ? 'Bot enabled — flow runs on incoming WhatsApp messages' : 'Bot disabled — enable in Settings → WhatsApp API'}
            </span>
          </div>

        </div>

        {/* RIGHT SIDEBAR INSPECTOR CARD (1 COL) */}
        <div className="bg-white rounded-2xl border border-slate-150 p-5 flex flex-col justify-between h-full shadow-xs text-xs">
          
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-405 font-mono flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-teal-650" />
                Node Properties Config
              </span>
              <h3 className="text-sm font-bold text-slate-800 mt-1">{activeNode?.title || 'Unknown Card'}</h3>
            </div>

            {activeNode ? (
              <div className="space-y-4">
                
                {/* Node Title input */}
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-655 font-mono text-[10.5px]">Title Label (Internal)</label>
                  <input
                    type="text"
                    value={activeNode.title}
                    onChange={e => handleUpdateNodeConfig(activeNode.id, { title: e.target.value })}
                    className="w-full text-xs p-2.5 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500"
                  />
                </div>

                {/* Node prompt content editor */}
                <div className="space-y-1">
                  <label className="block font-semibold text-slate-655 font-mono text-[10.5px]">WhatsApp Message Text Prompts</label>
                  <textarea
                    value={activeNode.config.messageText || ''}
                    onChange={e => handleUpdateNodeConfig(activeNode.id, { messageText: e.target.value })}
                    rows={6}
                    placeholder="This prompt is delivered to the customer inbox on trigger hit..."
                    className="w-full font-sans text-xs p-2.5 border border-slate-205 rounded-xl focus:outline-none focus:border-teal-500 placeholder-slate-400 bg-slate-50 leading-relaxed"
                  />
                </div>

                {/* Additional node properties according to Type */}
                {activeNode.type === 'CHOICE' && (
                  <div className="space-y-2.5 bg-slate-50 p-3 rounded-xl border border-slate-150">
                    <span className="block text-[9px] font-bold text-slate-400 font-mono tracking-wider uppercase">Interactive Reply Buttons</span>
                    {activeNode.config.choices?.map((ch, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={ch.label}
                          onChange={e => {
                            const updatedChoices = [...(activeNode.config.choices || [])];
                            updatedChoices[idx] = { ...ch, label: e.target.value };
                            handleUpdateNodeConfig(activeNode.id, { choices: updatedChoices });
                          }}
                          placeholder="Button label..."
                          className="flex-1 text-[11px] p-2 border border-slate-205 rounded-lg bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedChoices = (activeNode.config.choices || []).filter((_, i) => i !== idx);
                            handleUpdateNodeConfig(activeNode.id, { choices: updatedChoices });
                          }}
                          className="text-red-500 hover:text-red-700 font-bold"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const updatedChoices = [...(activeNode.config.choices || []), { label: 'New Option', nextNodeId: 'node-game-flow' }];
                        handleUpdateNodeConfig(activeNode.id, { choices: updatedChoices });
                      }}
                      className="bg-white hover:bg-slate-100 border border-slate-205 py-1 px-3.5 rounded-lg text-[10px] font-semibold text-slate-705 w-full text-center transition-all"
                    >
                      + Add Interactive Option
                    </button>
                  </div>
                )}

                {activeNode.type === 'HANDOFF' && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-2">
                    <span className="block text-[9px] font-bold text-slate-400 font-mono tracking-wider uppercase">Escalation Routing Rule</span>
                    <select
                      value={activeNode.config.routingStrategy || 'round-robin'}
                      onChange={e => handleUpdateNodeConfig(activeNode.id, { routingStrategy: e.target.value as any })}
                      className="w-full text-xs p-2 border border-slate-205 bg-white rounded-lg focus:outline-none"
                    >
                      <option value="round-robin">Round-Robin (Available representatives check)</option>
                      <option value="specific-agent">Transfer to specific Senior Account rep</option>
                    </select>
                  </div>
                )}

              </div>
            ) : (
              <p className="text-slate-400">Select card to inspect properties.</p>
            )}

          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3 shrink-0">
            {activeNode && activeNode.id !== 'node-start' && (
              <button
                type="button"
                onClick={() => handleDeleteNode(activeNode.id)}
                className="bg-red-50 hover:bg-red-105 border border-red-200 text-red-650 font-semibold p-2.5 rounded-xl w-full text-center transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" /> Delete Obsolete Node block
              </button>
            )}

            <button
              type="button"
              disabled={isSaving}
              onClick={async () => {
                setIsSaving(true);
                try {
                  await onSaveFlow({ ...activeFlow, isActive: true });
                  alert('Chatbot flow saved and activated.');
                } catch (err: any) {
                  alert(err.message || 'Failed to save flow');
                } finally {
                  setIsSaving(false);
                }
              }}
              className="bg-urja-primary hover:bg-urja-primary/95 text-white font-semibold p-3 rounded-xl w-full text-center transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-60"
            >
              <Save className="w-4 h-4" /> {isSaving ? 'Saving…' : 'Save & Activate Flow'}
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
