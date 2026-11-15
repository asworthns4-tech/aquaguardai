import { EARTH_REGIONS } from '../data/earthWaterData';
import { LAB_EXPERIMENTS } from '../data/labExperimentsData';
import { CITY_ENTITIES } from '../data/smartCityData';
import { UNDERGROUND_ENTITIES } from '../data/undergroundData';
import { SceneId, SelectedObjectInfo } from '../types/exhibition';

export interface RegisteredObjectEntry {
  internalId: string;
  canonicalId: string;
  scene: SceneId;
  type: SelectedObjectInfo['type'];
  name: string;
  aliases: string[];
  educationalSummary: string;
  connectedIds: string[];
}

export const WELL_CANONICAL_ENTRIES: RegisteredObjectEntry[] = [
  {
    internalId: 'well-shallow-west',
    canonicalId: 'underground.well.01',
    scene: 'underground',
    type: 'well',
    name: 'Veridian Shallow Open Well',
    aliases: ['shallow well', 'open well', 'veridian well', 'well 1'],
    educationalSummary:
      '14 m shallow open well tapping the upper unconfined gravel aquifer serving Veridian Eco-Residences.',
    connectedIds: ['city.building.03', 'underground.aquifer.01'],
  },
  {
    internalId: 'borewell-central',
    canonicalId: 'underground.well.02',
    scene: 'underground',
    type: 'well',
    name: 'AquaSpire Deep Borewell',
    aliases: ['deep borewell', 'central borewell', 'aquaspire borewell', 'borewell'],
    educationalSummary:
      '34 m cased deep borewell penetrating the clay aquitard into the deep confined sandstone aquifer.',
    connectedIds: ['city.building.01', 'underground.aquifer.02'],
  },
  {
    internalId: 'borewell-east',
    canonicalId: 'underground.well.03',
    scene: 'underground',
    type: 'well',
    name: 'Harborview Municipal Borewell',
    aliases: ['harborview borewell', 'east borewell', 'well 3'],
    educationalSummary:
      '29 m municipal borewell supplying Harborview Apartments when surface distribution pressure drops.',
    connectedIds: ['city.building.04', 'underground.aquifer.02'],
  },
];

const CITY_CANONICAL_MAP: Record<string, { canonicalId: string; aliases: string[]; connectedIds: string[] }> = {
  'city-reservoir': {
    canonicalId: 'city.reservoir.01',
    aliases: ['reservoir', 'periyar reservoir', 'dam', 'surface reservoir'],
    connectedIds: ['earth.kerala', 'underground.aquifer.03', 'city.pipeline.01'],
  },
  'treatment-plant': {
    canonicalId: 'city.treatment.01',
    aliases: ['treatment plant', 'water treatment', 'clarion'],
    connectedIds: ['city.reservoir.01', 'city.pipeline.02'],
  },
  'overhead-tank': {
    canonicalId: 'city.tank.01',
    aliases: ['overhead tank', 'water tower', 'pressure tower'],
    connectedIds: ['city.pipeline.02', 'city.building.01'],
  },
  'recycling-plant': {
    canonicalId: 'city.recycling.01',
    aliases: ['recycling plant', 'wastewater plant', 'sewage treatment'],
    connectedIds: ['city.pipeline.03', 'city.building.05'],
  },
  'rainwater-facility': {
    canonicalId: 'city.rainwater.01',
    aliases: ['rainwater facility', 'rainwater hub', 'harvesting hub'],
    connectedIds: ['earth.kerala', 'underground.layer.01', 'underground.aquifer.01'],
  },
  'smart-meter-hub': {
    canonicalId: 'city.meter.01',
    aliases: ['smart meter', 'meter hub', 'telemetry'],
    connectedIds: ['city.pipeline.02'],
  },
  'sky-tower-alpha': {
    canonicalId: 'city.building.01',
    aliases: ['aquaspire', 'skyscraper 1', 'tower alpha', 'building 1'],
    connectedIds: ['city.pipeline.02', 'underground.well.02'],
  },
  'sky-tower-beta': {
    canonicalId: 'city.building.02',
    aliases: ['helios', 'skyscraper 2', 'tower beta', 'building 2'],
    connectedIds: ['city.pipeline.02'],
  },
  'res-district-west': {
    canonicalId: 'city.building.03',
    aliases: ['veridian', 'west residential', 'residential west', 'building 3'],
    connectedIds: ['city.pipeline.02', 'underground.well.01'],
  },
  'res-district-east': {
    canonicalId: 'city.building.04',
    aliases: ['harborview', 'east residential', 'apartments', 'building 4'],
    connectedIds: ['city.pipeline.02', 'underground.well.03'],
  },
  'industrial-tech-park': {
    canonicalId: 'city.building.05',
    aliases: ['tech park', 'cleantech', 'industrial campus', 'building 5'],
    connectedIds: ['city.recycling.01'],
  },
  'pipe-intake': {
    canonicalId: 'city.pipeline.01',
    aliases: ['intake pipe', 'raw water line'],
    connectedIds: ['city.reservoir.01', 'city.treatment.01'],
  },
  'pipe-distribution': {
    canonicalId: 'city.pipeline.02',
    aliases: ['distribution line', 'main pipeline', 'water pipe', 'pipeline'],
    connectedIds: ['underground.pipeline.01', 'city.building.01', 'city.building.03'],
  },
  'pipe-wastewater': {
    canonicalId: 'city.pipeline.03',
    aliases: ['wastewater pipe', 'purple pipe', 'reuse line'],
    connectedIds: ['city.recycling.01'],
  },
};

const UNDERGROUND_CANONICAL_MAP: Record<
  string,
  { canonicalId: string; aliases: string[]; connectedIds: string[] }
> = {
  'layer-surface': {
    canonicalId: 'underground.layer.01',
    aliases: ['ground surface', 'surface'],
    connectedIds: ['city.rainwater.01'],
  },
  'layer-topsoil': {
    canonicalId: 'underground.layer.02',
    aliases: ['topsoil', 'vadose zone', 'soil'],
    connectedIds: ['city.building.03'],
  },
  'layer-sand': {
    canonicalId: 'underground.layer.03',
    aliases: ['sand layer', 'sand'],
    connectedIds: ['city.rainwater.01'],
  },
  'layer-gravel': {
    canonicalId: 'underground.aquifer.01',
    aliases: ['unconfined aquifer', 'gravel layer', 'shallow aquifer', 'aquifer 1'],
    connectedIds: ['underground.well.01', 'city.building.03'],
  },
  'water-table-plane': {
    canonicalId: 'underground.water_table.01',
    aliases: ['water table', 'phreatic surface'],
    connectedIds: ['city.reservoir.01', 'underground.well.01'],
  },
  'layer-clay': {
    canonicalId: 'underground.layer.04',
    aliases: ['clay layer', 'aquitard', 'impermeable clay'],
    connectedIds: ['underground.aquifer.02'],
  },
  'layer-confined-aquifer': {
    canonicalId: 'underground.aquifer.02',
    aliases: ['confined aquifer', 'sandstone aquifer', 'deep aquifer', 'aquifer 2'],
    connectedIds: ['underground.well.02', 'underground.well.03', 'city.building.01'],
  },
  'underground-reservoir': {
    canonicalId: 'underground.aquifer.03',
    aliases: ['underground reservoir', 'subsurface vault', 'karst pocket'],
    connectedIds: ['city.reservoir.01'],
  },
  'layer-bedrock': {
    canonicalId: 'underground.layer.05',
    aliases: ['bedrock', 'impermeable rock'],
    connectedIds: [],
  },
  'pipe-distribution': {
    canonicalId: 'underground.pipeline.01',
    aliases: ['underground pipeline', 'buried pipe', 'subsurface pipe'],
    connectedIds: ['city.pipeline.02', 'city.building.01', 'city.building.04'],
  },
};

export const OBJECT_REGISTRY: RegisteredObjectEntry[] = [
  ...EARTH_REGIONS.map((region): RegisteredObjectEntry => ({
    internalId: region.id,
    canonicalId: `earth.${region.id.replace(/-/g, '_')}`,
    scene: 'earth',
    type: region.category,
    name: region.name,
    aliases: [region.id, region.name.toLowerCase()],
    educationalSummary: region.summary,
    connectedIds:
      region.id === 'kerala'
        ? ['city.reservoir.01', 'city.rainwater.01', 'underground.well.01']
        : region.id === 'india' || region.id === 'ganga-brahmaputra'
          ? ['city.reservoir.01', 'underground.aquifer.01', 'underground.aquifer.02']
          : [],
  })),
  ...CITY_ENTITIES.map((ent): RegisteredObjectEntry => {
    const meta = CITY_CANONICAL_MAP[ent.id] ?? {
      canonicalId: `city.${ent.id.replace(/-/g, '_')}`,
      aliases: [],
      connectedIds: [],
    };
    return {
      internalId: ent.id,
      canonicalId: meta.canonicalId,
      scene: 'city',
      type: ent.category,
      name: ent.name,
      aliases: [ent.id, ent.name.toLowerCase(), ...meta.aliases],
      educationalSummary: ent.summary,
      connectedIds: meta.connectedIds,
    };
  }),
  ...UNDERGROUND_ENTITIES.map((ent): RegisteredObjectEntry => {
    const meta = UNDERGROUND_CANONICAL_MAP[ent.id] ?? {
      canonicalId: `underground.${ent.id.replace(/-/g, '_')}`,
      aliases: [],
      connectedIds: [],
    };
    const mappedType: SelectedObjectInfo['type'] =
      ent.category === 'water-table'
        ? 'water-table'
        : ent.category === 'aquifer'
          ? 'aquifer'
          : ent.category === 'pipeline'
            ? 'pipeline'
            : 'stratum';
    return {
      internalId: ent.id,
      canonicalId: meta.canonicalId,
      scene: 'underground',
      type: mappedType,
      name: ent.name,
      aliases: [ent.id, ent.name.toLowerCase(), ...meta.aliases],
      educationalSummary: ent.summary,
      connectedIds: meta.connectedIds,
    };
  }),
  ...WELL_CANONICAL_ENTRIES,
  ...LAB_EXPERIMENTS.map((exp): RegisteredObjectEntry => ({
    internalId: exp.id,
    canonicalId: `lab.station.${exp.id.replace(/-/g, '_')}`,
    scene: 'lab',
    type: 'lab-station',
    name: exp.title,
    aliases: [exp.id, exp.shortTitle.toLowerCase(), exp.title.toLowerCase()],
    educationalSummary: exp.principle,
    connectedIds:
      exp.id === 'groundwater-depletion'
        ? ['underground.aquifer.01', 'underground.well.01']
        : exp.id === 'pipeline-leakage'
          ? ['city.pipeline.02', 'underground.pipeline.01']
          : exp.id === 'rainwater-harvesting'
            ? ['city.rainwater.01', 'earth.kerala']
            : exp.id === 'smart-city-management'
              ? ['city.reservoir.01', 'city.recycling.01', 'underground.water_table.01']
              : [],
  })),
  ...LAB_EXPERIMENTS.flatMap((exp) =>
    exp.equipmentNodes.map(
      (node): RegisteredObjectEntry => ({
        internalId: node.id,
        canonicalId: `lab.equip.${node.id.replace(/-/g, '_')}`,
        scene: 'lab',
        type: 'lab-equipment',
        name: node.name,
        aliases: [node.id, node.name.toLowerCase(), node.role.toLowerCase()],
        educationalSummary: `${node.role}: ${node.scienceDetail}`,
        connectedIds: [`lab.station.${exp.id.replace(/-/g, '_')}`],
      })
    )
  ),
];

export function resolveRegisteredObject(
  queryIdOrAlias: string,
  preferredScene?: SceneId
): RegisteredObjectEntry | null {
  const normalized = queryIdOrAlias.trim().toLowerCase();
  if (!normalized) return null;

  const matches = OBJECT_REGISTRY.filter(
    (entry) =>
      entry.canonicalId.toLowerCase() === normalized ||
      entry.internalId.toLowerCase() === normalized ||
      entry.aliases.some((a) => a.toLowerCase() === normalized)
  );

  if (matches.length === 0) {
    // Fallback partial alias lookup
    const partial = OBJECT_REGISTRY.filter(
      (entry) =>
        (!preferredScene || entry.scene === preferredScene) &&
        (entry.name.toLowerCase().includes(normalized) ||
          entry.aliases.some((a) => a.toLowerCase().includes(normalized)))
    );
    return partial[0] ?? null;
  }

  if (preferredScene) {
    const sceneMatch = matches.find((m) => m.scene === preferredScene);
    if (sceneMatch) return sceneMatch;
  }
  return matches[0];
}

export function toSelectedObjectInfo(entry: RegisteredObjectEntry): SelectedObjectInfo {
  return {
    id: entry.internalId,
    canonicalId: entry.canonicalId,
    type: entry.type,
    name: entry.name,
    regionId: entry.scene === 'earth' ? entry.internalId : undefined,
  };
}

export function getCanonicalIdForInternal(internalId: string, scene?: SceneId): string | undefined {
  const entry = resolveRegisteredObject(internalId, scene);
  return entry?.canonicalId;
}
