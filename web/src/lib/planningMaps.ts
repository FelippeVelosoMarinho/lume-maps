export const PLANNING_MAP_OPACITY = 0.35

const STORAGE_KEY = 'mr_show_planning_maps'

export function readShowPlanningMaps(): boolean {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) !== '0'
}

export function writeShowPlanningMaps(show: boolean) {
  localStorage.setItem(STORAGE_KEY, show ? '1' : '0')
}
