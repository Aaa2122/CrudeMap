/**
 * Feature flags — toggle features without code changes.
 * Future UI iterations can add/remove flags here.
 */
export const features = {
  showSankey: false,          // Sankey chart in country panel
  showInfraLayer: true,       // Infrastructure overlay on map
  showChokeLayer: true,       // Chokepoint overlay on map
  showWaterfall: true,        // Waterfall impact chart
  showCompareMode: false,     // Country comparison panel
  showTimeline: false,        // Scenario timeline (J+1/J+7/J+30/J+90)
} as const

export type FeatureKey = keyof typeof features
