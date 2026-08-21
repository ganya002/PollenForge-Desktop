export interface FilterableModel {
  id: string
  name?: string
  cost_per_1k?: number
  free?: boolean
}

export function isFreeModel(model: FilterableModel): boolean {
  if (model.free === true) return true
  if (model.free === false) return false
  if (typeof model.id === 'string' && /:free\b/i.test(model.id)) return true
  return Number(model.cost_per_1k || 0) === 0
}

export function visibleModels<T extends FilterableModel>(models: T[], freeOnly: boolean): T[] {
  if (!freeOnly) return models
  return models.filter(isFreeModel)
}
