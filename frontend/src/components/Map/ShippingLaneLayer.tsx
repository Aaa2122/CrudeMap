import { IconLayer, PathLayer, TextLayer } from '@deck.gl/layers'
import { TYPE_COLOR, getIcon } from './iconAtlas'
import { globeParams, pathVisibleOnGlobe, pointVisibleOnGlobe } from './globeCulling'
import { HIGHLIGHT, LABEL_HALO, LABEL_MUTED, NEUTRAL_MARK, withAlpha, type RGBA } from './mapTheme'

// Background traffic: neutral, very low alpha, hairline.
const LANE_COLOR: RGBA = withAlpha(NEUTRAL_MARK, 55)

interface Props {
  lanes: any | null
  ports: any | null
  showPorts: boolean
  showPortLabels: boolean
  globe: boolean
  cameraCenter: [number, number]
  onHover: (info: any) => void
}

/** Container shipping corridors (width = TEU volume) + major container ports. */
export function ShippingLaneLayer({ lanes, ports, showPorts, showPortLabels, globe, cameraCenter, onHover }: Props) {
  const layers: any[] = []

  if (lanes?.features?.length) {
    const laneData = lanes.features
      .filter((feature: any) => !globe || pathVisibleOnGlobe(feature.geometry.coordinates, cameraCenter))
      .map((feature: any) => ({
      path: feature.geometry.coordinates,
      name: feature.properties.name,
      teu: feature.properties.teu_m,
      width: 0.6 + Math.min(2.2, Math.log1p(feature.properties.teu_m) * 0.7),
      __tooltip: `${feature.properties.name}\nContainer corridor — ~${feature.properties.teu_m.toFixed(0)}M TEU/yr`,
    }))

    layers.push(
      new PathLayer({
        id: 'shipping-lanes',
        data: laneData,
        getPath: (d: any) => d.path,
        getColor: LANE_COLOR,
        getWidth: (d: any) => d.width,
        widthUnits: 'pixels',
        jointRounded: true,
        capRounded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: HIGHLIGHT,
        onHover,
        parameters: globeParams(globe) as any,
      }),
    )
  }

  if (showPorts && ports?.features?.length) {
    const portData = ports.features
      .filter((feature: any) => !globe || pointVisibleOnGlobe(feature.geometry.coordinates, cameraCenter))
      .map((feature: any) => ({
      position: feature.geometry.coordinates as [number, number],
      name: feature.properties.name,
      teu: feature.properties.teu_m,
      __tooltip: `${feature.properties.name}\nContainer port — ${feature.properties.teu_m.toFixed(1)}M TEU/yr (#${feature.properties.rank} worldwide)`,
    }))

    layers.push(
      new IconLayer({
        id: 'container-ports',
        data: portData,
        getPosition: (d: any) => d.position,
        getIcon: () => getIcon('container_port'),
        getSize: (d: any) => 10 + Math.min(5, Math.log1p(d.teu) * 1.3),
        getColor: TYPE_COLOR.container_port,
        sizeUnits: 'pixels',
        billboard: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 90],
        onHover,
        parameters: globeParams(globe) as any,
      }),
    )

    if (showPortLabels && !globe) {
      layers.push(
        new TextLayer({
          id: 'container-port-labels',
          data: portData.filter((d: any) => d.teu >= 12),
          getPosition: (d: any) => d.position,
          getText: (d: any) => d.name,
          getSize: 10,
          sizeUnits: 'pixels',
          fontFamily: 'Archivo, sans-serif',
          getTextAnchor: 'start',
          getAlignmentBaseline: 'center',
          getPixelOffset: [12, 0],
          getColor: LABEL_MUTED,
          outlineWidth: 2,
          outlineColor: LABEL_HALO,
          fontSettings: { sdf: true },
        characterSet: 'auto',
          billboard: true,
          pickable: false,
        }),
      )
    }
  }

  return layers
}
