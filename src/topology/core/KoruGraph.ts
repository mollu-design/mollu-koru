import type { KoruGraphData, KoruNodeData, KoruEdgeData } from '../types'

/**
 * 图数据根模型
 * 管理节点和连线的增删改查
 */
export class KoruGraph {
  private _nodes: Map<string, KoruNodeData> = new Map()
  private _edges: Map<string, KoruEdgeData> = new Map()

  constructor(data?: KoruGraphData) {
    if (data) {
      this.fromJSON(data)
    }
  }

  // ========== 节点操作 ==========

  getNode(id: string): KoruNodeData | undefined {
    return this._nodes.get(id)
  }

  getNodes(): KoruNodeData[] {
    return Array.from(this._nodes.values())
  }

  addNode(node: KoruNodeData): void {
    this._nodes.set(node.id, { ...node })
  }

  removeNode(id: string): boolean {
    // 同时移除关联的连线
    this._edges.forEach((edge, edgeId) => {
      if (edge.source === id || edge.target === id) {
        this._edges.delete(edgeId)
      }
    })
    return this._nodes.delete(id)
  }

  updateNode(id: string, data: Partial<KoruNodeData>): boolean {
    const node = this._nodes.get(id)
    if (!node) return false
    this._nodes.set(id, { ...node, ...data })
    return true
  }

  hasNode(id: string): boolean {
    return this._nodes.has(id)
  }

  // ========== 连线操作 ==========

  getEdge(id: string): KoruEdgeData | undefined {
    return this._edges.get(id)
  }

  getEdges(): KoruEdgeData[] {
    return Array.from(this._edges.values())
  }

  getNodeEdges(nodeId: string): KoruEdgeData[] {
    return this.getEdges().filter((e) => e.source === nodeId || e.target === nodeId)
  }

  addEdge(edge: KoruEdgeData): void {
    this._edges.set(edge.id, { ...edge })
  }

  removeEdge(id: string): boolean {
    return this._edges.delete(id)
  }

  updateEdge(id: string, data: Partial<KoruEdgeData>): boolean {
    const edge = this._edges.get(id)
    if (!edge) return false
    this._edges.set(id, { ...edge, ...data })
    return true
  }

  hasEdge(id: string): boolean {
    return this._edges.has(id)
  }

  // ========== 序列化 ==========

  toJSON(): KoruGraphData {
    return {
      nodes: this.getNodes(),
      edges: this.getEdges(),
    }
  }

  fromJSON(data: KoruGraphData): void {
    this._nodes.clear()
    this._edges.clear()
    data.nodes.forEach((n) => this.addNode(n))
    data.edges.forEach((e) => this.addEdge(e))
  }

  /** 清除所有数据 */
  clear(): void {
    this._nodes.clear()
    this._edges.clear()
  }

  /** 获取节点/连线数量 */
  get size() {
    return {
      nodes: this._nodes.size,
      edges: this._edges.size,
    }
  }
}
