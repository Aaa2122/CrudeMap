/**
 * Feature flags — instant kill-switches for demos, no code changes needed.
 */
export const features = {
  showSankey: false,          // Sankey chart in country panel
  showWaterfall: true,        // Waterfall impact chart
  showCompareMode: false,     // Country comparison panel
  showTimeline: false,        // Scenario timeline (J+1/J+7/J+30/J+90)
  showShippingLanes: true,    // Container corridors layer available
  showFields: true,           // Oil & gas fields layer available
  showOverviewTab: true,      // System Overview dashboard tab
} as const

export type FeatureKey = keyof typeof features
