type ApiClient = {
  fetchUsers: () => Promise<unknown>
  fetchFloorplan: () => Promise<unknown>
  saveFloorplan: (data: unknown) => Promise<unknown>
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.body.appendChild(script)
  })
}

export async function ensureLegacyFloorplanLoaded(api: ApiClient) {
  if (window.legacyFloorplanLoaded) return

  window.API = {
    fetchUsers: () => api.fetchUsers(),
    fetchFloorplan: () => api.fetchFloorplan(),
    saveFloorplan: (data: unknown) => api.saveFloorplan(data)
  }

  await loadScript('/legacy/floorplan.js')

  window.legacyFloorplanLoaded = true
}
