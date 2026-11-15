import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  GeoAdminLevel,
  GeoDetailLevel,
  getAdminBoundaries,
  getCountriesLayer,
  getCountryProfile,
  getCoverageStats,
  getIslandsLayer,
  getMinorIslandsInBbox,
  getPlaces,
  searchGeography,
} from './server/geoService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = 'gemini-4-hydrogen';

function getConfiguredApiKey(): string | null {
  const raw = process.env.GEMINI_API_KEY?.trim();
  if (!raw || raw === 'MY_GEMINI_API_KEY' || raw === 'YOUR_GEMINI_API_KEY') {
    return null;
  }
  return raw;
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface IncomingHistoryItem {
  role: 'user' | 'aqua' | 'system';
  text: string;
}

interface IncomingChatPayload {
  message: string;
  language?: 'en' | 'ml' | 'hi';
  history?: IncomingHistoryItem[];
  contextSnapshot?: Record<string, unknown>;
  educationalContext?: Record<string, unknown>;
}

function sanitizeText(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

function buildAquaSystemInstruction(language: 'en' | 'ml' | 'hi'): string {
  const langLabel =
    language === 'ml'
      ? 'Malayalam (മലയാളം) — respond naturally in clear Malayalam script while keeping technical action names strictly in English JSON fields'
      : language === 'hi'
        ? 'Hindi (हिन्दी) — respond naturally in clear Devanagari Hindi while keeping technical action names strictly in English JSON fields'
        : 'English';

  return [
    'You are AQUA, the intelligent scientific guide and control-centre AI of "AquaGuard AI — The Living Planet".',
    `Primary response language: ${langLabel}.`,
    'Role & Scientific Rigor:',
    '- Explain water science clearly for students and exhibition visitors (water cycle, groundwater & aquifers, water scarcity, rainwater harvesting, desalination, filtration, wastewater treatment, water pollution, pipeline leakage, smart water management, sustainable cities, conservation, climate change).',
    '- Always use accurate scientific terminology and explicit physical units (mm, L, ML/d, L/hr, m, bar, %, PSU, kWh/m³).',
    '- Clearly distinguish real-world scientific reference facts from simulated exhibition model values in the live contextSnapshot.',
    '- NEVER invent live environmental sensor measurements or pretend simulated figures are live field telemetry.',
    '- When discussing simplified exhibition models, briefly note assumptions/limitations when relevant.',
    'Website Control & Allowlisted Actions:',
    '- You can control the real website ONLY by proposing actions from contextSnapshot.allowlistedActions.',
    '- Never output arbitrary JavaScript, shell commands, or invented action names.',
    '- Valid Earth region IDs: kerala, india, himalayas, ganga-brahmaputra, indian-ocean, pacific-ocean, atlantic-ocean, amazon, nile, baikal, great-lakes, greenland, antarctica.',
    '- Valid Earth overlays: water-availability, freshwater, saltwater, groundwater.',
    '- Valid Smart City entity IDs: city-reservoir, treatment-plant, overhead-tank, recycling-plant, rainwater-facility, smart-meter-hub, sky-tower-alpha, sky-tower-beta, res-district-west, res-district-east, industrial-tech-park, pipe-intake, pipe-distribution, pipe-wastewater.',
    '- Valid Underground IDs: layer-surface, layer-topsoil, layer-sand, layer-gravel, water-table-plane, layer-clay, layer-confined-aquifer, underground-reservoir, layer-bedrock, pipe-distribution, well-shallow-west, borewell-central, borewell-east.',
    '- Valid Underground demo phases: normal, over-extraction, falling-table, recharge, recovery.',
    '- Valid Science Lab experiment IDs (select_lab_experiment with {"experimentId":"...","autoNavigate":true}): water-cycle, rainwater-harvesting, groundwater-depletion, pipeline-leakage, water-filtration, desalination, supply-demand, smart-city-management.',
    '- Valid Science Lab parameters (set_lab_param with {"key":"...","value":number}): temperatureC, solarIntensityPct, cloudFormationRatePct, rainfallIntensity, rainfallMm, roofAreaM2, runoffCoeff, firstFlushMm, filterEfficiencyPct, tankCapacityLitres, groundwaterExtractionPct, groundwaterHorizonYears, pipelinePressureBar, leakOrificeMm, leakCount, supplyFlowLph, initialTurbidityNtu, flowRateLpm, filterConditionPct, sedimentationMin, carbonEfficiencyPct, salinityGpl, feedPressureBar, recoveryRatePct, feedVolumeM3, population, perCapitaLpd, industrialDemandMLd, commercialDemandMLd, availableSupplyMLd, distributionLossPct, recyclingCapacityPct.',
    '- Valid Mission actions: start_mission ({}), select_mission_stage ({"stageId":"drought-alert|stop-leaks|restore-groundwater|smart-city|save-city"}), set_mission_difficulty ({"difficulty":"easy|medium|hard"}), evaluate_mission ({"stageId":"..."}), reset_mission ({}).',
    '- Valid Presentation actions: start_presentation ({}), next_chapter ({}), prev_chapter ({}), jump_chapter ({"index":0..7}), exit_presentation ({}).',
    '- When explaining Water Filtration, always note that mechanical sand/gravel/carbon filtration alone does NOT remove dissolved salts or all pathogens without disinfection (UV/chlorination/boiling) and water testing.',
    '- You can inspect contextSnapshot.lab, contextSnapshot.mission, and contextSnapshot.presentation for live status.',
    '- Always use exact parameter keys: select_country/select_city_entity/select_aquifer/select_soil_layer/select_well/select_underground_entity use {"id":"...","autoNavigate":true}; set_earth_overlay uses {"overlay":"..."}; set_rainfall/set_water_demand/set_recycling_rate/set_reservoir_storage use {"value":number}; set_groundwater_extraction uses {"pct":number}; set_underground_demo_phase uses {"phase":"..."}; create_pipeline_leak uses {"locationId":"pipe-distribution","severityLph":14500}; set_city_tab/set_underground_tab use {"tab":"..."}.',
    '- Use autoNavigate: true on select_country, select_city_entity, select_reservoir, select_aquifer, select_soil_layer, select_well, select_underground_entity, select_lab_experiment when switching or focusing objects or experiments.',
    '- For potentially destructive reset actions (reset_simulation, reset_city, reset_underground, clear_aqua_history), set requiresConfirmation: true and provide confirmationPrompt instead of forcing an unconfirmed reset.',
    '- If the visitor asks "What is this?" or "What happens if I increase it?", inspect contextSnapshot.selectedObject, educationalContext.selectionContext, and recent values from contextSnapshot.',
    '- Set spokenSummary to a concise, natural, plain-text version without markdown asterisks, hashes, or code formatting so browser text-to-speech reads cleanly.',
  ].join('\n');
}

const AQUA_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: {
      type: Type.STRING,
      description: 'Clear, scientifically accurate exhibition response in the requested language.',
    },
    spokenSummary: {
      type: Type.STRING,
      description: 'Concise plain-text version for text-to-speech with no markdown symbols.',
    },
    discussedTopic: {
      type: Type.STRING,
      description: 'Short label for the water-science topic or simulation metric discussed.',
    },
    clarificationNeeded: {
      type: Type.BOOLEAN,
      description: 'True only if the request is too ambiguous to execute safely.',
    },
    requiresConfirmation: {
      type: Type.BOOLEAN,
      description: 'True if proposing a destructive reset or session-clear action awaiting user confirmation.',
    },
    confirmationPrompt: {
      type: Type.STRING,
      description: 'Short confirmation question when requiresConfirmation is true.',
    },
    proposedActions: {
      type: Type.ARRAY,
      description: 'Ordered allowlisted website actions to execute safely.',
      items: {
        type: Type.OBJECT,
        properties: {
          actionName: {
            type: Type.STRING,
            description: 'Exact action name from allowlistedActions.',
          },
          paramsJson: {
            type: Type.STRING,
            description: 'Valid JSON object string of parameters for the action, e.g. {"value": 85}.',
          },
          rationale: {
            type: Type.STRING,
            description: 'Brief explanation of why this action matches the user request.',
          },
        },
        required: ['actionName', 'paramsJson'],
      },
    },
  },
  required: ['reply', 'spokenSummary', 'proposedActions'],
};

function classifyGeminiError(err: unknown): {
  reason: 'QUOTA_EXCEEDED' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'API_ERROR';
  message: string;
} {
  const raw = err instanceof Error ? err.message : String(err ?? 'Unknown error');
  const lower = raw.toLowerCase();
  if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
    return {
      reason: 'QUOTA_EXCEEDED',
      message: 'Gemini API quota limit reached. Switched to Offline Demo Mode.',
    };
  }
  if (
    lower.includes('403') ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid')
  ) {
    return {
      reason: 'INVALID_KEY',
      message: 'Server Gemini API key is invalid or unauthorized. Using Offline Demo Mode.',
    };
  }
  if (
    lower.includes('fetch') ||
    lower.includes('network') ||
    lower.includes('enotfound') ||
    lower.includes('timeout') ||
    lower.includes('econnrefused')
  ) {
    return {
      reason: 'NETWORK_ERROR',
      message: 'Network connection to Gemini API unavailable. Switched to Offline Demo Mode.',
    };
  }
  return {
    reason: 'API_ERROR',
    message: 'Live Gemini AI temporarily unavailable. Using Offline Demo Mode.',
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '160kb' }));

  app.get('/api/aqua/status', (_req, res) => {
    const apiKey = getConfiguredApiKey();
    res.json({
      ok: true,
      liveAiAvailable: Boolean(apiKey),
      model: GEMINI_MODEL,
      mode: apiKey ? 'live' : 'offline-demo',
      reason: apiKey ? null : 'API_KEY_MISSING',
    });
  });

  // ---------------------------------------------------------------------------
  // Stage 2: Open Global Geography & Administrative Boundary API
  // ---------------------------------------------------------------------------
  app.get('/api/geo/countries', (req, res) => {
    const rawDetail = String(req.query.detail ?? '110m');
    const detail: GeoDetailLevel =
      rawDetail === '50m' || rawDetail === '10m' ? rawDetail : '110m';
    const features = getCountriesLayer(detail);
    res.json({
      ok: true,
      detail,
      count: features.length,
      features,
    });
  });

  app.get('/api/geo/country/:iso3', (req, res) => {
    const profile = getCountryProfile(req.params.iso3 ?? '');
    if (!profile) {
      res.status(404).json({ ok: false, error: 'Country or territory not found.' });
      return;
    }
    res.json({ ok: true, country: profile });
  });

  app.get('/api/geo/boundaries/:iso3/:level', async (req, res) => {
    const iso3 = String(req.params.iso3 ?? '').toUpperCase();
    const rawLevel = String(req.params.level ?? '').toUpperCase();
    if (rawLevel !== 'ADM1' && rawLevel !== 'ADM2' && rawLevel !== 'ADM3') {
      res.status(400).json({ ok: false, error: 'Level must be ADM1, ADM2, or ADM3.' });
      return;
    }
    const parentName =
      typeof req.query.parentName === 'string' && req.query.parentName.trim()
        ? req.query.parentName.trim()
        : undefined;
    const rawParentLevel =
      typeof req.query.parentLevel === 'string'
        ? req.query.parentLevel.toUpperCase()
        : undefined;
    const parentLevel: GeoAdminLevel | undefined =
      rawParentLevel === 'ADM1' || rawParentLevel === 'ADM2' ? rawParentLevel : undefined;

    let parentBbox: [number, number, number, number] | undefined;
    if (typeof req.query.parentBbox === 'string') {
      const nums = req.query.parentBbox.split(',').map(Number);
      if (nums.length === 4 && nums.every((n) => Number.isFinite(n))) {
        parentBbox = [nums[0], nums[1], nums[2], nums[3]];
      }
    }

    const result = await getAdminBoundaries(iso3, rawLevel as GeoAdminLevel, {
      parentName,
      parentLevel,
      parentBbox,
    });
    res.json({ ok: true, ...result });
  });

  app.get('/api/geo/places', (req, res) => {
    const iso2 = typeof req.query.iso2 === 'string' ? req.query.iso2 : undefined;
    const stateCode = typeof req.query.stateCode === 'string' ? req.query.stateCode : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 80;
    let bbox: [number, number, number, number] | undefined;
    if (
      req.query.minLon !== undefined &&
      req.query.minLat !== undefined &&
      req.query.maxLon !== undefined &&
      req.query.maxLat !== undefined
    ) {
      const vals = [
        Number(req.query.minLon),
        Number(req.query.minLat),
        Number(req.query.maxLon),
        Number(req.query.maxLat),
      ];
      if (vals.every((v) => Number.isFinite(v))) {
        bbox = [vals[0], vals[1], vals[2], vals[3]];
      }
    }
    const places = getPlaces({ iso2, stateCode, bbox, q, limit });
    res.json({ ok: true, count: places.length, places });
  });

  app.get('/api/geo/islands', async (req, res) => {
    const ocean = typeof req.query.ocean === 'string' ? req.query.ocean : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const features = await getIslandsLayer({ ocean, q });
    res.json({ ok: true, count: features.length, features });
  });

  app.get('/api/geo/minor-islands', async (req, res) => {
    const minLon = Number(req.query.minLon ?? -180);
    const minLat = Number(req.query.minLat ?? -90);
    const maxLon = Number(req.query.maxLon ?? 180);
    const maxLat = Number(req.query.maxLat ?? 90);
    const features = await getMinorIslandsInBbox([minLon, minLat, maxLon, maxLat]);
    res.json({ ok: true, count: features.length, features });
  });

  app.get('/api/geo/search', async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = req.query.limit ? Number(req.query.limit) : 16;
    const results = await searchGeography(q, limit);
    res.json({ ok: true, query: q, count: results.length, results });
  });

  app.get('/api/geo/coverage', (_req, res) => {
    const stats = getCoverageStats();
    res.json({ ok: true, coverage: stats });
  });

  app.post('/api/aqua/chat', async (req, res) => {
    const body = (req.body ?? {}) as Partial<IncomingChatPayload>;
    const message = sanitizeText(body.message, 1500);
    if (!message) {
      res.status(400).json({
        ok: false,
        mode: 'offline-demo',
        reason: 'VALIDATION_ERROR',
        errorMessage: 'Message must be a non-empty text string.',
      });
      return;
    }

    const language: 'en' | 'ml' | 'hi' =
      body.language === 'ml' || body.language === 'hi' ? body.language : 'en';

    const apiKey = getConfiguredApiKey();
    if (!apiKey) {
      res.status(200).json({
        ok: false,
        mode: 'offline-demo',
        reason: 'API_KEY_MISSING',
        errorMessage:
          'No live Gemini API key configured on the server. Running in Offline Demo Mode.',
      });
      return;
    }

    const safeHistory = Array.isArray(body.history)
      ? body.history
          .slice(-8)
          .map((item) => ({
            role: item.role === 'user' ? 'Visitor' : 'AQUA',
            text: sanitizeText(item.text, 500),
          }))
          .filter((item) => item.text.length > 0)
      : [];

    const contextPayload = {
      contextSnapshot: body.contextSnapshot ?? {},
      educationalContext: body.educationalContext ?? {},
      recentHistory: safeHistory,
      visitorMessage: message,
    };

    try {
      const ai = createGeminiClient(apiKey);
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: JSON.stringify(contextPayload),
        config: {
          systemInstruction: buildAquaSystemInstruction(language),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: AQUA_RESPONSE_SCHEMA,
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(200).json({
          ok: false,
          mode: 'offline-demo',
          reason: 'EMPTY_RESPONSE',
          errorMessage: 'Gemini returned an empty response. Falling back to Offline Demo Mode.',
        });
        return;
      }

      const parsed = JSON.parse(rawText) as {
        reply?: string;
        spokenSummary?: string;
        discussedTopic?: string;
        clarificationNeeded?: boolean;
        requiresConfirmation?: boolean;
        confirmationPrompt?: string;
        proposedActions?: Array<{
          actionName?: string;
          paramsJson?: string;
          rationale?: string;
        }>;
      };

      res.json({
        ok: true,
        mode: 'live',
        model: GEMINI_MODEL,
        data: {
          reply: sanitizeText(parsed.reply, 2200) || 'Here is the current exhibition update.',
          spokenSummary:
            sanitizeText(parsed.spokenSummary, 1000) ||
            sanitizeText(parsed.reply, 1000),
          discussedTopic: sanitizeText(parsed.discussedTopic, 80) || null,
          clarificationNeeded: Boolean(parsed.clarificationNeeded),
          requiresConfirmation: Boolean(parsed.requiresConfirmation),
          confirmationPrompt: sanitizeText(parsed.confirmationPrompt, 300) || null,
          proposedActions: Array.isArray(parsed.proposedActions)
            ? parsed.proposedActions.slice(0, 4)
            : [],
        },
      });
    } catch (err) {
      const classified = classifyGeminiError(err);
      res.status(200).json({
        ok: false,
        mode: 'offline-demo',
        reason: classified.reason,
        errorMessage: classified.message,
      });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) {
        next();
        return;
      }
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.use((req, res, next) => {
      if (req.originalUrl.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AquaGuard AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start AquaGuard AI server:', err);
  process.exit(1);
});
