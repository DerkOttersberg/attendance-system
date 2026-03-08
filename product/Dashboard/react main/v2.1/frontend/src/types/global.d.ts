export {}

declare global {
  interface Window {
    API?: {
      fetchUsers: () => Promise<unknown>
      fetchFloorplan: () => Promise<unknown>
      saveFloorplan: (data: unknown) => Promise<unknown>
    }
    FloorplanAPI?: {
      getCanvas: () => HTMLElement | null
      getExportDay: () => string
      getDayLabel: (day: string) => string
      getExportLegend: () => unknown[]
    }
    State?: {
      allUsers?: unknown[]
    }
    legacyFloorplanLoaded?: boolean
  }
}
