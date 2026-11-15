import { LAB_EXPERIMENTS, LAB_EXPERIMENTS_BY_ID, LabExperimentId } from '../data/labExperimentsData';
import {
  ActionExecutionResult,
  AquaAiMode,
  AquaChatMessage,
  AquaExecutedActionBadge,
  AquaLanguage,
  AquaPendingConfirmation,
  ExhibitionState,
  RegisteredActionName,
} from '../types/exhibition';
import { ACTION_CATALOG } from './actionRegistry';
import { getAquaEducationalContext, getAquaStateSnapshot } from './aquaInterface';
import {
  buildSimulationStatusSummary,
  getKnowledgeText,
  matchScientificKnowledge,
} from './aquaKnowledgeBase';
import {
  computeLabComparison,
  computeSupplyDemandLabModel,
} from './labSimulationEngine';
import { MISSION_STAGES, evaluateMissionStage } from './missionEngine';
import { PRESENTATION_CHAPTERS } from './presentationEngine';
import { computeIntegratedWaterBalance } from './simulationEngine';

export interface ProposedAquaAction {
  actionName: RegisteredActionName;
  params: Record<string, unknown>;
}

export interface AquaBrainOutcome {
  replyText: string;
  spokenText: string;
  mode: AquaAiMode;
  reason: string | null;
  executedActions: AquaExecutedActionBadge[];
  pendingConfirmation: AquaPendingConfirmation | null;
  lastDiscussedTopic: string | null;
  lastModifiedParam: ExhibitionState['aqua']['lastModifiedParam'];
}

const DESTRUCTIVE_ACTIONS: Set<RegisteredActionName> = new Set([
  'reset_simulation',
  'reset_city',
  'reset_underground',
  'clear_aqua_history',
]);

function isAllowedAction(name: string): name is RegisteredActionName {
  return ACTION_CATALOG.some((c) => c.name === name);
}

function localizedReply(lang: AquaLanguage, en: string, ml: string, hi: string): string {
  if (lang === 'ml') return ml;
  if (lang === 'hi') return hi;
  return en;
}

function buildConfirmationPrompt(
  actionName: RegisteredActionName,
  lang: AquaLanguage
): string {
  if (actionName === 'clear_aqua_history') {
    return localizedReply(
      lang,
      'Are you sure you want to clear our current conversation history? Reply "confirm" or click Confirm below.',
      'ഈ സെഷനിലെ സംഭാഷണ ചരിത്രം മായ്ക്കണമോ? ദയവായി Confirm അമർത്തുക.',
      'क्या आप इस सत्र की बातचीत का इतिहास साफ़ करना चाहते हैं? कृपया Confirm दबाएँ।'
    );
  }
  return localizedReply(
    lang,
    `This will reset simulated exhibition parameters (${actionName.replace(/_/g, ' ')}). Confirm to proceed or cancel to keep current values.`,
    `ഇത് നിലവിലെ സിമുലേഷൻ മൂല്യങ്ങൾ പുനഃസജ്ജമാക്കും (${actionName.replace(/_/g, ' ')}). തുടരണമോ?`,
    `यह वर्तमान सिमुलेशन मान रीसेट कर देगा (${actionName.replace(/_/g, ' ')}). क्या आप सुनिश्चित हैं?`
  );
}

function formatParameterEffectExplanation(
  param: NonNullable<ExhibitionState['aqua']['lastModifiedParam']>,
  direction: 'increase' | 'decrease',
  state: ExhibitionState,
  lang: AquaLanguage
): string {
  const metrics = computeIntegratedWaterBalance(state);
  if (param === 'rainfall') {
    if (direction === 'increase') {
      return localizedReply(
        lang,
        `Increasing rainfall above ${state.city.rainfallIntensity} mm boosts surface reservoir inflow (${metrics.city.reservoirInflowMLd.toFixed(1)} ML/d), rainwater cistern yield, and aquifer recharge (${metrics.underground.rechargeRateMLd.toFixed(1)} ML/d)—raising the water table over time. (Simulated exhibition model.)`,
        `മഴ ${state.city.rainfallIntensity} mm-ൽ നിന്ന് വർദ്ധിപ്പിച്ചാൽ റിസർവോയർ വരവും ഭൂഗർഭജല റീചാർജും (${metrics.underground.rechargeRateMLd.toFixed(1)} ML/d) വർദ്ധിക്കുകയും ജലവിതാനം ഉയരുകയും ചെയ്യും.`,
        `वर्षा ${state.city.rainfallIntensity} mm से बढ़ाने पर जलाशय प्रवाह और भूजल पुनर्भरण (${metrics.underground.rechargeRateMLd.toFixed(1)} ML/d) बढ़ता है और जल स्तर ऊपर आता है।`
      );
    }
    return localizedReply(
      lang,
      `Decreasing rainfall below ${state.city.rainfallIntensity} mm reduces reservoir inflow and aquifer recharge, which can shift the underground balance negative if pumping stays high.`,
      `മഴ കുറയ്ക്കുമ്പോൾ അണക്കെട്ടിലേക്കുള്ള നീരൊഴുക്കും ഭൂഗർഭജല റീചാർജും കുറയുന്നു.`,
      `वर्षा कम करने से जलाशय में पानी और भूजल पुनर्भरण दोनों घट जाते हैं।`
    );
  }
  if (param === 'extraction') {
    return direction === 'increase'
      ? `Increasing groundwater extraction above ${state.city.groundwaterExtractionPct}% accelerates drawdown of the water table (currently ${state.underground.waterTableDepthM.toFixed(1)} m) and risks drying shallow neighborhood wells below 14 m.`
      : `Reducing groundwater extraction slows water-table decline and lets natural rainfall infiltration recover the aquifer balance (currently ${metrics.underground.netBalanceMLd.toFixed(1)} ML/d).`;
  }
  if (param === 'recycling') {
    return direction === 'increase'
      ? `Higher wastewater recycling (currently ${state.city.recyclingCapacityPct}%) substitutes reclaimed purple-pipe water for non-potable cooling and landscaping, lowering freshwater demand.`
      : `Lowering wastewater recycling increases reliance on surface reservoirs and borewells to meet ${metrics.city.effectiveDemandMLd.toFixed(1)} ML/d demand.`;
  }
  return direction === 'increase'
    ? `Raising demand increases municipal drawdown (${metrics.city.effectiveDemandMLd.toFixed(1)} ML/d), lowering net resilience (${metrics.city.cityResilienceScore}/100) unless supply or recycling rises.`
    : `Lowering demand immediately eases pressure on reservoirs, treatment plants, and aquifers.`;
}

function resolveEntityOrRegionQuery(
  lower: string
): { action: RegisteredActionName; params: Record<string, unknown>; topic: string } | null {
  // Earth regions
  const regionMatches: Array<[string[], string, string]> = [
    [['kerala', 'കേരള', 'केरल'], 'kerala', 'Kerala'],
    [['india', 'bharat', 'ഇന്ത്യ', 'भारत'], 'india', 'India'],
    [['himalaya', 'glacier', 'third pole'], 'himalayas', 'Himalayan Glaciers'],
    [['ganga', 'brahmaputra'], 'ganga-brahmaputra', 'Ganga–Brahmaputra Basin'],
    [['indian ocean', 'arabian sea'], 'indian-ocean', 'Indian Ocean'],
    [['pacific'], 'pacific-ocean', 'Pacific Ocean'],
    [['atlantic'], 'atlantic-ocean', 'Atlantic Ocean'],
    [['amazon'], 'amazon', 'Amazon River Basin'],
    [['nile'], 'nile', 'Nile River Basin'],
    [['baikal'], 'baikal', 'Lake Baikal'],
    [['great lakes'], 'great-lakes', 'North American Great Lakes'],
    [['greenland'], 'greenland', 'Greenland Ice Sheet'],
    [['antarctica'], 'antarctica', 'Antarctic Ice Sheet'],
  ];
  for (const [kws, id, label] of regionMatches) {
    if (kws.some((k) => lower.includes(k)) && !lower.includes('reservoir')) {
      return {
        action: 'select_country',
        params: { id, autoNavigate: true },
        topic: label,
      };
    }
  }

  // Smart City infrastructure & buildings
  if (lower.includes('treatment plant') || lower.includes('clarion')) {
    return {
      action: 'select_city_entity',
      params: { id: 'treatment-plant', autoNavigate: true },
      topic: 'Clarion Water Treatment Plant',
    };
  }
  if (lower.includes('reservoir') && !lower.includes('underground reservoir')) {
    return {
      action: 'select_reservoir',
      params: { autoNavigate: true },
      topic: 'Periyar Valley Smart Reservoir',
    };
  }
  if (lower.includes('recycling plant') || lower.includes('wastewater plant')) {
    return {
      action: 'select_city_entity',
      params: { id: 'recycling-plant', autoNavigate: true },
      topic: 'Closed-Loop Wastewater Recycling Plant',
    };
  }
  if (lower.includes('overhead tank') || lower.includes('water tower')) {
    return {
      action: 'select_city_entity',
      params: { id: 'overhead-tank', autoNavigate: true },
      topic: 'Elevated Hydraulic Pressure Tower',
    };
  }
  if (lower.includes('smart meter') || lower.includes('meter hub')) {
    return {
      action: 'select_city_entity',
      params: { id: 'smart-meter-hub', autoNavigate: true },
      topic: 'AMI Smart Water Meter & Sensor Hub',
    };
  }
  if (lower.includes('rainwater facility') || lower.includes('rainwater hub')) {
    return {
      action: 'select_city_entity',
      params: { id: 'rainwater-facility', autoNavigate: true },
      topic: 'Eco-Canopy Rainwater Harvesting Hub',
    };
  }
  if (lower.includes('aquaspire')) {
    return {
      action: 'select_building',
      params: { id: 'sky-tower-alpha', autoNavigate: true },
      topic: 'AquaSpire Mixed-Use Skyscraper',
    };
  }
  if (lower.includes('helios')) {
    return {
      action: 'select_building',
      params: { id: 'sky-tower-beta', autoNavigate: true },
      topic: 'Helios Civic & Research Tower',
    };
  }
  if (lower.includes('veridian')) {
    return {
      action: 'select_building',
      params: { id: 'res-district-west', autoNavigate: true },
      topic: 'Veridian Eco-Residences',
    };
  }
  if (lower.includes('harborview')) {
    return {
      action: 'select_building',
      params: { id: 'res-district-east', autoNavigate: true },
      topic: 'Harborview Apartments',
    };
  }
  if (lower.includes('distribution network') || lower.includes('water network')) {
    return {
      action: 'select_city_entity',
      params: { id: 'pipe-distribution', autoNavigate: true },
      topic: 'Urban Distribution Network',
    };
  }

  // Underground targets
  if (lower.includes('underground pipeline') || lower.includes('buried pipe')) {
    return {
      action: 'select_underground_entity',
      params: { id: 'pipe-distribution', autoNavigate: true },
      topic: 'Buried Municipal Water Pipeline',
    };
  }
  if (lower.includes('confined aquifer') || lower.includes('deep aquifer')) {
    return {
      action: 'select_aquifer',
      params: { id: 'layer-confined-aquifer', autoNavigate: true },
      topic: 'Confined Sandstone Aquifer',
    };
  }
  if (lower.includes('aquifer') && !lower.includes('how an aquifer works')) {
    return {
      action: 'select_aquifer',
      params: { id: 'layer-gravel', autoNavigate: true },
      topic: 'Unconfined Gravel Aquifer',
    };
  }
  if (lower.includes('groundwater flow') || lower.includes('water table')) {
    return {
      action: 'select_underground_entity',
      params: { id: 'water-table-plane', autoNavigate: true },
      topic: 'Dynamic Water Table',
    };
  }
  if (lower.includes('clay') || lower.includes('aquitard')) {
    return {
      action: 'select_soil_layer',
      params: { id: 'layer-clay', autoNavigate: true },
      topic: 'Dense Clay Aquitard',
    };
  }
  if (lower.includes('borewell')) {
    return {
      action: 'select_well',
      params: { id: 'borewell-central', autoNavigate: true },
      topic: 'AquaSpire Deep Borewell',
    };
  }
  if (lower.includes('shallow well') || lower.includes('open well')) {
    return {
      action: 'select_well',
      params: { id: 'well-shallow-west', autoNavigate: true },
      topic: 'Veridian Shallow Open Well',
    };
  }

  return null;
}

export interface DeterministicTurnPlan {
  matched: boolean;
  actions: ProposedAquaAction[];
  replyText: string;
  spokenText: string;
  requiresConfirmation?: { actionName: RegisteredActionName; params: Record<string, unknown>; prompt: string };
  topic?: string | null;
  modifiedParam?: ExhibitionState['aqua']['lastModifiedParam'];
}

export function resolveDeterministicTurn(
  input: string,
  state: ExhibitionState
): DeterministicTurnPlan {
  const lower = input.trim().toLowerCase();
  const lang = state.aqua.language;
  const eduCtx = getAquaEducationalContext(state);

  // 1. Selected object inspection ("What is this?", "Explain this building", etc.)
  if (
    lower.includes('what is this') ||
    lower.includes('explain this') ||
    lower.includes('about this') ||
    lower.includes('selected object') ||
    lower.includes('ഇത് എന്താണ്') ||
    lower.includes('यह क्या है')
  ) {
    if (eduCtx.selectionContext) {
      const sel = eduCtx.selectionContext;
      const connectedNote =
        sel.connectedSystems.length > 0
          ? ` Connected systems: ${sel.connectedSystems.join(', ')}.`
          : '';
      const text = `${sel.name}: ${sel.summary} ${sel.scienceNote}${connectedNote}`;
      return {
        matched: true,
        actions: [],
        replyText: text,
        spokenText: `${sel.name}. ${sel.summary} ${sel.scienceNote}`,
        topic: sel.name,
      };
    }
    return {
      matched: true,
      actions: [],
      replyText: localizedReply(
        lang,
        `No 3D object is currently selected in ${eduCtx.sceneTitle}. Click or point at any beacon, building, reservoir, pipe, or underground layer—or ask me to select one (for example, "Select the water treatment plant" or "Show Kerala").`,
        `${eduCtx.sceneTitle}-ൽ നിലവിൽ ഒരു ഒബ്‌ജക്റ്റും തിരഞ്ഞെടുത്തിട്ടില്ല. ദയവായി ഏതെങ്കിലും ബിൽഡിംഗിലോ ഭൂഗർഭ പാളിയിലോ ക്ലിക്ക് ചെയ്യുക അല്ലെങ്കിൽ എന്നോട് തിരഞ്ഞെടുക്കാൻ ആവശ്യപ്പെടുക.`,
        `${eduCtx.sceneTitle} में अभी कोई वस्तु चयनित नहीं है। कृपया किसी इमारत, जलाशय या परत पर क्लिक करें या मुझे चुनने के लिए कहें।`
      ),
      spokenText: `No object is currently selected in ${eduCtx.sceneTitle}. Click any object or ask me to select one.`,
    };
  }

  // 2. Destructive Reset Requests -> Gate with confirmation first
  if (lower.includes('clear chat') || lower.includes('clear conversation') || lower.includes('clear history')) {
    const prompt = buildConfirmationPrompt('clear_aqua_history', lang);
    return {
      matched: true,
      actions: [],
      replyText: prompt,
      spokenText: prompt,
      requiresConfirmation: {
        actionName: 'clear_aqua_history',
        params: { confirmed: true },
        prompt,
      },
    };
  }

  if (lower.includes('reset')) {
    if (lower.includes('camera') || lower.includes('view')) {
      return {
        matched: true,
        actions: [{ actionName: 'reset_camera', params: {} }],
        replyText: `Resetting the ${eduCtx.sceneTitle} camera to overview.`,
        spokenText: `Resetting camera to overview.`,
      };
    }
    const targetAction: RegisteredActionName = lower.includes('city')
      ? 'reset_city'
      : lower.includes('underground') || lower.includes('aquifer')
        ? 'reset_underground'
        : 'reset_simulation';
    const prompt = buildConfirmationPrompt(targetAction, lang);
    return {
      matched: true,
      actions: [],
      replyText: prompt,
      spokenText: prompt,
      requiresConfirmation: {
        actionName: targetAction,
        params: { confirmed: true },
        prompt,
      },
    };
  }

  // 3. Follow-up parameter adjustment ("What happens if I increase it?", "Increase it")
  if (
    (lower.includes('what happens if') || lower.includes('if i increase') || lower.includes('if i decrease')) &&
    (lower.includes(' it') || lower.includes('increase') || lower.includes('decrease') || lower.includes('reduce'))
  ) {
    const inferredParam =
      lower.includes('rain')
        ? 'rainfall'
        : lower.includes('extract') || lower.includes('pump') || lower.includes('groundwater')
          ? 'extraction'
          : lower.includes('recycl')
            ? 'recycling'
            : lower.includes('demand')
              ? 'demand'
              : state.aqua.lastModifiedParam ?? 'rainfall';
    const dir = lower.includes('decrease') || lower.includes('reduce') || lower.includes('lower')
      ? 'decrease'
      : 'increase';
    const explanation = formatParameterEffectExplanation(inferredParam, dir, state, lang);
    return {
      matched: true,
      actions: [],
      replyText: explanation,
      spokenText: explanation,
      topic: inferredParam,
      modifiedParam: inferredParam,
    };
  }

  // 4. Current simulation awareness / Save the city diagnosis
  if (
    lower.includes('what is happening') ||
    lower.includes('current simulation') ||
    lower.includes('current status') ||
    lower.includes('sim status')
  ) {
    const summary = buildSimulationStatusSummary(state, lang);
    return {
      matched: true,
      actions: [],
      replyText: summary,
      spokenText: summary,
      topic: 'Current Simulation Status',
    };
  }

  // 4b. Save the City Mission & Presentation Mode commands (before generic city advice)
  if (
    lower.includes('start save the city') ||
    lower.includes('start mission') ||
    lower.includes('open mission') ||
    lower.includes('play mission') ||
    lower.includes('save the city mission') ||
    lower.includes('water crisis mission')
  ) {
    const activeStage =
      MISSION_STAGES.find((s) => s.id === state.mission.activeStageId) ?? MISSION_STAGES[0];
    return {
      matched: true,
      actions: [{ actionName: 'start_mission', params: {} }],
      replyText: `Launched Save the City — Water Crisis Mission (${state.mission.difficulty} difficulty). Stage ${activeStage.number}/5: ${activeStage.title}. ${activeStage.subtitle}`,
      spokenText: `Save the City mission started. Stage ${activeStage.number}: ${activeStage.title}.`,
      topic: 'Save the City Mission',
    };
  }

  if (lower.includes('reset mission') || lower.includes('replay mission') || lower.includes('restart mission')) {
    return {
      matched: true,
      actions: [{ actionName: 'reset_mission', params: {} }],
      replyText: `Reset Save the City mission on ${state.mission.difficulty} difficulty. All 5 stages and crisis conditions are ready for a fresh run.`,
      spokenText: 'Save the City mission has been reset.',
      topic: 'Save the City Mission',
    };
  }

  if (
    lower.includes('why did my mission fail') ||
    lower.includes('mission fail') ||
    lower.includes('check mission') ||
    lower.includes('evaluate mission') ||
    lower.includes('evaluate my mission')
  ) {
    const stage =
      MISSION_STAGES.find((s) => s.id === state.mission.activeStageId) ?? MISSION_STAGES[0];
    const evalRes = evaluateMissionStage(
      stage.id,
      state.city,
      state.underground,
      state.mission
    );
    const shouldDispatchEval =
      lower.includes('evaluate') || lower.includes('submit') || lower.includes('check mission');
    return {
      matched: true,
      actions: shouldDispatchEval ? [{ actionName: 'evaluate_mission', params: { stageId: stage.id } }] : [],
      replyText: evalRes.passed
        ? `Mission ${stage.number} (${stage.title}) PASSED! ${evalRes.feedback}`
        : `Mission ${stage.number} (${stage.title}) needs action before passing: ${evalRes.unmetReasons.join('; ')}. Tip: ${stage.hint}`,
      spokenText: evalRes.passed ? `Mission ${stage.number} passed! ${evalRes.feedback}` : `Mission ${stage.number} unmet: ${evalRes.unmetReasons.join(', ')}.`,
      topic: stage.title,
    };
  }

  if (lower.includes('give me a hint') || lower.includes('mission hint') || lower === 'hint') {
    const stage =
      MISSION_STAGES.find((s) => s.id === state.mission.activeStageId) ?? MISSION_STAGES[0];
    return {
      matched: true,
      actions: [],
      replyText: `Commander Hint for Mission ${stage.number} (${stage.title}): ${stage.hint} Scientific principle: ${stage.sciencePrinciple}`,
      spokenText: `Hint for ${stage.title}: ${stage.hint}`,
      topic: stage.title,
    };
  }

  if (
    lower.includes('current mission') ||
    lower.includes('explain mission') ||
    lower.includes('mission briefing') ||
    lower.includes('my mission')
  ) {
    const stage =
      MISSION_STAGES.find((s) => s.id === state.mission.activeStageId) ?? MISSION_STAGES[0];
    const evalPreview = evaluateMissionStage(
      stage.id,
      state.city,
      state.underground,
      state.mission
    );
    const statusText = evalPreview.passed
      ? 'All stage targets are currently met—you can click or say "Evaluate mission" to claim your points.'
      : `Remaining checks: ${evalPreview.unmetReasons.join('; ')}.`;
    return {
      matched: true,
      actions: [],
      replyText: `Mission ${stage.number}/5 (${state.mission.difficulty}): ${stage.title}. ${stage.scenario} Objectives: ${stage.objectives.join(' | ')}. ${statusText}`,
      spokenText: `Mission ${stage.number}: ${stage.title}. ${statusText}`,
      topic: `Mission ${stage.number}: ${stage.title}`,
    };
  }

  if (lower.includes('show my score') || lower.includes('mission score') || lower.includes('my badge')) {
    const cleared = state.mission.completedStages.length;
    const badge =
      cleared >= 5
        ? 'Planet Protector'
        : cleared >= 3
          ? 'Sustainability Engineer'
          : cleared >= 1
            ? 'Water Guardian'
            : 'Water Explorer';
    const text = `Commander Score: ${state.mission.score} pts · Rank: ${badge} · Stages Cleared: ${cleared}/5 · Leaks Repaired: ${state.mission.leaksRepaired} · Simulated Water Saved: ${state.mission.waterSavedLitres.toLocaleString()} L.`;
    return {
      matched: true,
      actions: [],
      replyText: text,
      spokenText: text,
      topic: 'Mission Score & Rank',
    };
  }

  if (
    lower.includes('start presentation') ||
    lower.includes('presentation mode') ||
    lower.includes('exhibition mode') ||
    lower.includes('exhibition tour')
  ) {
    return {
      matched: true,
      actions: [{ actionName: 'start_presentation', params: {} }],
      replyText: `Started Guided Exhibition Presentation Mode (${PRESENTATION_CHAPTERS.length} chapters). Use "Next chapter", "Previous chapter", or "Exit presentation" anytime.`,
      spokenText: 'Starting Exhibition Presentation Mode.',
      topic: 'Exhibition Presentation Mode',
    };
  }

  if (lower.includes('next chapter') || lower.includes('next slide')) {
    const nextIdx = Math.min(
      PRESENTATION_CHAPTERS.length - 1,
      state.presentation.activeChapterIndex + 1
    );
    const ch = PRESENTATION_CHAPTERS[nextIdx];
    return {
      matched: true,
      actions: [{ actionName: 'next_chapter', params: {} }],
      replyText: `Advanced to Chapter ${ch.number + 1}/${PRESENTATION_CHAPTERS.length}: ${ch.title} — ${ch.subtitle}.`,
      spokenText: `Chapter ${ch.number + 1}: ${ch.title}.`,
      topic: ch.title,
    };
  }

  if (lower.includes('previous chapter') || lower.includes('prev chapter') || lower.includes('previous slide')) {
    const prevIdx = Math.max(0, state.presentation.activeChapterIndex - 1);
    const ch = PRESENTATION_CHAPTERS[prevIdx];
    return {
      matched: true,
      actions: [{ actionName: 'prev_chapter', params: {} }],
      replyText: `Returned to Chapter ${ch.number + 1}/${PRESENTATION_CHAPTERS.length}: ${ch.title}.`,
      spokenText: `Chapter ${ch.number + 1}: ${ch.title}.`,
      topic: ch.title,
    };
  }

  if (lower.includes('exit presentation') || lower.includes('stop presentation') || lower.includes('close presentation')) {
    return {
      matched: true,
      actions: [{ actionName: 'exit_presentation', params: {} }],
      replyText: 'Exited Exhibition Presentation Mode back to free interactive exploration.',
      spokenText: 'Exited presentation mode.',
      topic: 'Navigation',
    };
  }

  if (lower.includes('save this city') || lower.includes('save the city') || lower.includes('from water scarcity')) {
    const metrics = computeIntegratedWaterBalance(state);
    const tips: string[] = [];
    if (state.city.leak.active) {
      tips.push(`repair the active pipeline leak (${state.city.leak.severityLph.toLocaleString()} L/hr loss)`);
    }
    if (state.city.recyclingCapacityPct < 65) {
      tips.push(`boost wastewater recycling from ${state.city.recyclingCapacityPct}% toward 65–75%`);
    }
    if (state.city.demandMultiplier > 0.95) {
      tips.push(`reduce demand multiplier below 0.90× (currently ${state.city.demandMultiplier.toFixed(2)}×)`);
    }
    if (state.city.groundwaterExtractionPct > 45) {
      tips.push(`lower borewell extraction (${state.city.groundwaterExtractionPct}%) so the aquifer recovers`);
    }
    if (tips.length === 0) {
      tips.push('maintain rainwater harvesting and high wastewater reuse to sustain your positive net balance');
    }
    const text = `To strengthen city resilience (currently ${metrics.city.cityResilienceScore}/100, net balance ${metrics.city.netBalanceMLd >= 0 ? '+' : ''}${metrics.city.netBalanceMLd.toFixed(1)} ML/d), you should: ${tips.join('; ')}. Say "Start Save the City" to enter Mission Command or ask me to execute fixes live.`;
    return {
      matched: true,
      actions: [{ actionName: 'navigate_to_city', params: {} }],
      replyText: text,
      spokenText: text,
      topic: 'Smart City Water Resilience',
    };
  }

  // 5. Simulation Controls & Parameter Commands
  if (lower.includes('pipeline leak') || lower.includes('pipe leak') || lower.includes('the leak')) {
    if (lower.includes('repair') || lower.includes('fix') || lower.includes('stop') || lower.includes('seal')) {
      return {
        matched: true,
        actions: [{ actionName: 'repair_pipeline_leak', params: {} }],
        replyText: 'Pipeline leak sealed. Pressure and distribution efficiency are recovering across Smart City and Underground Water World.',
        spokenText: 'Pipeline leak repaired across Smart City and Underground Water World.',
      };
    }
    if (lower.includes('create') || lower.includes('simulate') || lower.includes('trigger') || lower.includes('start')) {
      const actions: ProposedAquaAction[] = [];
      if (state.currentScene !== 'city' && state.currentScene !== 'underground') {
        actions.push({ actionName: 'navigate_to_city', params: {} });
      }
      actions.push({
        actionName: 'create_pipeline_leak',
        params: { locationId: 'pipe-distribution', severityLph: 14500, openTab: true },
      });
      return {
        matched: true,
        actions,
        replyText:
          'Simulated a 14,500 L/hr trunk pipeline leak on the main distribution line. Notice wasted water volume climbing and system efficiency dropping across both Smart City and Underground views.',
        spokenText: 'Simulated a 14,500 litres per hour pipeline leak on the main distribution network.',
      };
    }
  }

  if (lower.includes('depleted') || lower.includes('depletion')) {
    const actions: ProposedAquaAction[] = [
      { actionName: 'navigate_to_underground', params: {} },
      { actionName: 'set_underground_demo_phase', params: { phase: 'falling-table' } },
      { actionName: 'set_underground_tab', params: { tab: 'depletion' } },
    ];
    return {
      matched: true,
      actions,
      replyText:
        'Switched Underground Water World to the Falling Water Table stage: over-pumping drops the simulated phreatic surface toward 20.5 m depth—causing shallow 14 m open wells to run dry while deep borewells draw down the confined aquifer.',
      spokenText:
        'Switched to Underground Water World showing groundwater depletion. The simulated water table falls toward 20.5 meters, drying shallow neighborhood wells.',
      topic: 'Groundwater Depletion',
    };
  }

  if (
    (lower.includes('start') || lower.includes('resume')) &&
    (lower.includes('simulation') || lower.includes('water cycle'))
  ) {
    return {
      matched: true,
      actions: [{ actionName: 'start_simulation', params: { simId: 'hydrology-live' } }],
      replyText: 'Live water cycle and hydrological simulation started across connected modules.',
      spokenText: 'Water simulation started.',
    };
  }

  if (lower.includes('pause') && lower.includes('simulation')) {
    return {
      matched: true,
      actions: [{ actionName: 'pause_simulation', params: {} }],
      replyText: 'Simulation paused. All sliders, 3D cameras, and inspection tools remain interactive.',
      spokenText: 'Simulation paused.',
    };
  }

  if (lower.includes('rainfall') || lower.includes('rain')) {
    const explicitNum = lower.match(/\b(\d{1,3})\s*(?:mm)?\b/);
    if (explicitNum) {
      const val = Math.min(120, Math.max(0, Number(explicitNum[1])));
      return {
        matched: true,
        actions: [{ actionName: 'set_rainfall', params: { value: val } }],
        replyText: `Rainfall intensity set to ${val} mm. Both Smart City reservoir inflow and Underground aquifer recharge update automatically.`,
        spokenText: `Rainfall set to ${val} millimetres.`,
        modifiedParam: 'rainfall',
      };
    }
    if (lower.includes('increase') || lower.includes('raise') || lower.includes('more') || lower.includes('boost')) {
      const next = Math.min(120, state.city.rainfallIntensity + 25);
      return {
        matched: true,
        actions: [{ actionName: 'set_rainfall', params: { value: next } }],
        replyText: `Increased rainfall from ${state.city.rainfallIntensity} mm to ${next} mm, boosting surface inflow and subsurface aquifer recharge.`,
        spokenText: `Rainfall increased to ${next} millimetres.`,
        modifiedParam: 'rainfall',
      };
    }
    if (lower.includes('decrease') || lower.includes('reduce') || lower.includes('less') || lower.includes('lower')) {
      const next = Math.max(5, state.city.rainfallIntensity - 20);
      return {
        matched: true,
        actions: [{ actionName: 'set_rainfall', params: { value: next } }],
        replyText: `Reduced rainfall from ${state.city.rainfallIntensity} mm to ${next} mm. Observe reservoir inflow and aquifer recharge dropping.`,
        spokenText: `Rainfall reduced to ${next} millimetres.`,
        modifiedParam: 'rainfall',
      };
    }
  }

  if (lower.includes('groundwater extraction') || lower.includes('pumping')) {
    const explicitNum = lower.match(/\b(\d{1,2})\s*%?\b/);
    if (explicitNum && (lower.includes('set') || lower.includes('to '))) {
      const pct = Math.min(95, Math.max(5, Number(explicitNum[1])));
      return {
        matched: true,
        actions: [{ actionName: 'set_groundwater_extraction', params: { pct } }],
        replyText: `Groundwater extraction set to ${pct}% across Smart City and Underground borewells.`,
        spokenText: `Groundwater extraction set to ${pct} percent.`,
        modifiedParam: 'extraction',
      };
    }
    if (lower.includes('reduce') || lower.includes('decrease') || lower.includes('lower') || lower.includes('cut')) {
      const next = Math.max(10, state.city.groundwaterExtractionPct - 18);
      return {
        matched: true,
        actions: [{ actionName: 'set_groundwater_extraction', params: { pct: next } }],
        replyText: `Reduced groundwater extraction from ${state.city.groundwaterExtractionPct}% to ${next}%, relieving pressure on the aquifer water table.`,
        spokenText: `Groundwater extraction reduced to ${next} percent.`,
        modifiedParam: 'extraction',
      };
    }
    if (lower.includes('increase') || lower.includes('raise') || lower.includes('more')) {
      const next = Math.min(90, state.city.groundwaterExtractionPct + 20);
      return {
        matched: true,
        actions: [{ actionName: 'set_groundwater_extraction', params: { pct: next } }],
        replyText: `Increased groundwater extraction to ${next}%. Watch the Underground water table respond to heavier pumping.`,
        spokenText: `Groundwater extraction increased to ${next} percent.`,
        modifiedParam: 'extraction',
      };
    }
  }

  // 5b. Phase 7 Science Lab Before/After Comparison, Baselines, Deficit & Lab Parameters
  if (
    lower.includes('compare') &&
    (lower.includes('before') || lower.includes('after') || lower.includes('result') || lower.includes('baseline'))
  ) {
    const cmp = computeLabComparison(state.lab.activeExperiment, state);
    return {
      matched: true,
      actions: [],
      replyText: cmp.summaryText,
      spokenText: cmp.summaryText,
      topic: `Before vs After (${LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment].shortTitle})`,
    };
  }

  if (lower.includes('capture baseline') || lower.includes('save baseline') || lower.includes('snapshot before')) {
    return {
      matched: true,
      actions: [{ actionName: 'capture_lab_baseline', params: { label: 'AQUA Captured Baseline' } }],
      replyText: `Captured current ${LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment].shortTitle} outputs as your "Before" reference snapshot. Adjust any parameters now and ask me to "Compare the results before and after".`,
      spokenText: `Captured baseline snapshot for ${LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment].shortTitle}.`,
      topic: 'Lab Baseline Snapshot',
    };
  }

  if (lower.includes('water deficit') || lower.includes('supply deficit') || lower.includes('supply and demand deficit')) {
    const sd = computeSupplyDemandLabModel(state.lab, state.city);
    const balLabel =
      sd.netSurplusOrDeficitMLd >= 0
        ? `surplus of +${sd.netSurplusOrDeficitMLd.toFixed(1)} ML/d`
        : `deficit of ${Math.abs(sd.netSurplusOrDeficitMLd).toFixed(1)} ML/d (~${sd.daysOfBuffer} days reservoir buffer)`;
    return {
      matched: true,
      actions: [
        { actionName: 'navigate_to_lab', params: {} },
        { actionName: 'select_lab_experiment', params: { experimentId: 'supply-demand', autoNavigate: true } },
      ],
      replyText: `Opened the Supply & Demand experiment: ${sd.population.toLocaleString()} residents demand ${sd.totalEndDemandMLd.toFixed(1)} ML/d (${sd.perCapitaLpd} L/person/day + industry/commerce) plus ${sd.distributionLossMLd.toFixed(1)} ML/d network loss, against ${sd.availableSupplyMLd.toFixed(1)} ML/d available supply — yielding a ${balLabel}.`,
      spokenText: `Showing Supply and Demand balance with a ${balLabel}.`,
      topic: 'Water Supply and Demand',
    };
  }

  if (lower.includes('learn the science') || lower.includes('science explanation')) {
    const exp = LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment];
    const actions: ProposedAquaAction[] = [];
    if (state.currentScene !== 'lab' && state.currentScene !== 'simulations') {
      actions.push({ actionName: 'navigate_to_lab', params: {} });
    }
    actions.push({ actionName: 'toggle_lab_learn_panel', params: { open: true } });
    return {
      matched: true,
      actions,
      replyText: `${exp.title}: ${exp.principle} Key formula: ${exp.formulaDisplay}. ${exp.safetyNotice ?? exp.disclaimer}`,
      spokenText: `${exp.title}. ${exp.principle}`,
      topic: exp.title,
    };
  }

  if (
    (lower.includes('activate') || lower.includes('increase') || lower.includes('boost') || lower.includes('set') || lower.includes('enable')) &&
    (lower.includes('recycling') || lower.includes('wastewater'))
  ) {
    const numMatch = lower.match(/\b(\d{1,2})\s*%?\b/);
    const targetPct = numMatch
      ? Math.min(85, Math.max(0, Number(numMatch[1])))
      : Math.max(state.city.recyclingCapacityPct, 72);
    return {
      matched: true,
      actions: [{ actionName: 'set_recycling_rate', params: { value: targetPct } }],
      replyText: `Wastewater recycling activated at ${targetPct}%, reclaiming purple-pipe water across Future Smart City and Science Lab Station 08.`,
      spokenText: `Wastewater recycling set to ${targetPct} percent.`,
      modifiedParam: 'recycling',
    };
  }

  // Direct numeric parameter setters for Science Lab
  const labParamPatterns: Array<[RegExp, string, string]> = [
    [/(?:salinity)\D{0,12}(\d{2})/, 'salinityGpl', 'g/L'],
    [/(?:feed pressure|ro pressure|desalination pressure)\D{0,12}(\d{2})/, 'feedPressureBar', 'bar'],
    [/(?:recovery rate|membrane recovery)\D{0,12}(\d{2})/, 'recoveryRatePct', '%'],
    [/(?:turbidity)\D{0,12}(\d{2,3})/, 'initialTurbidityNtu', 'NTU'],
    [/(?:temperature|temp)\D{0,12}(\d{2})/, 'temperatureC', '°C'],
    [/(?:solar intensity|sunlight)\D{0,12}(\d{2,3})/, 'solarIntensityPct', '%'],
    [/(?:roof area)\D{0,12}(\d{2,4})/, 'roofAreaM2', 'm²'],
  ];
  for (const [rx, paramKey, unit] of labParamPatterns) {
    const m = lower.match(rx);
    if (m) {
      const val = Number(m[1]);
      const ensureScene: ProposedAquaAction[] =
        state.currentScene === 'lab' || state.currentScene === 'simulations'
          ? []
          : [{ actionName: 'navigate_to_lab', params: {} }];
      return {
        matched: true,
        actions: [...ensureScene, { actionName: 'set_lab_param', params: { key: paramKey, value: val } }],
        replyText: `Updated ${paramKey} to ${val} ${unit} in AQUA Science Lab.`,
        spokenText: `Set ${paramKey} to ${val} ${unit}.`,
      };
    }
  }

  // Open any of the 8 Science Lab experiments via voice/text
  const labExpTriggers: Array<[string[], LabExperimentId]> = [
    [['water cycle experiment', 'water cycle simulation', 'water cycle station', 'open water cycle', 'start water cycle'], 'water-cycle'],
    [['rainwater harvesting experiment', 'rainwater harvesting simulation', 'open rainwater harvesting', 'rainwater calculator', 'rainwater lab'], 'rainwater-harvesting'],
    [['groundwater depletion experiment', 'groundwater depletion simulation', 'aquifer depletion', 'open groundwater depletion'], 'groundwater-depletion'],
    [['pipeline leakage experiment', 'pipeline leakage simulation', 'pipe leak experiment', 'open pipeline leakage'], 'pipeline-leakage'],
    [['water filtration', 'filtration bench', 'filtration experiment', 'open filtration', 'sand filter'], 'water-filtration'],
    [['desalination experiment', 'desalination simulation', 'reverse osmosis simulation', 'open desalination', 'start desalination'], 'desalination'],
    [['supply and demand', 'supply demand', 'open supply and demand'], 'supply-demand'],
    [['smart city water management', 'smart city management', 'integrated management experiment'], 'smart-city-management'],
  ];
  for (const [phrases, expId] of labExpTriggers) {
    if (phrases.some((p) => lower.includes(p))) {
      const meta = LAB_EXPERIMENTS_BY_ID[expId];
      const targetScene = state.currentScene === 'simulations' ? 'simulations' : 'lab';
      return {
        matched: true,
        actions: [
          { actionName: targetScene === 'simulations' ? 'navigate_to_simulations' : 'navigate_to_lab', params: {} },
          { actionName: 'select_lab_experiment', params: { experimentId: expId, autoNavigate: true } },
        ],
        replyText: `Opened Station ${meta.number}: ${meta.title}. ${meta.subtitle}.`,
        spokenText: `Opened the ${meta.shortTitle} experiment.`,
        topic: meta.title,
      };
    }
  }

  // Generic science lab / simulations navigation
  if (lower.includes('science lab') || lower.includes('water lab') || lower.includes('open lab')) {
    const activeExp = LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment];
    return {
      matched: true,
      actions: [{ actionName: 'navigate_to_lab', params: {} }],
      replyText: `Opened AQUA Science Lab (Module 04) featuring 8 interactive 3D water stations. Currently displaying Station ${activeExp.number}: ${activeExp.title}.`,
      spokenText: 'Welcome to the AQUA Science Lab.',
      topic: 'AQUA Science Lab',
    };
  }
  if (lower.includes('simulations') || lower.includes('water simulations')) {
    return {
      matched: true,
      actions: [{ actionName: 'navigate_to_simulations', params: {} }],
      replyText: `Opened Module 05: Eight Quantitative Water Simulations (${LAB_EXPERIMENTS.map((e) => e.shortTitle).join(', ')}). All equations sync live with the 3D Science Lab, Smart City, and Underground Water World.`,
      spokenText: 'Opened the Water Simulations workbench.',
      topic: 'Water Simulations',
    };
  }

  // 6. Specific Earth / City / Underground Entity Selections
  const entityPlan = resolveEntityOrRegionQuery(lower);
  if (
    entityPlan &&
    (lower.includes('show') ||
      lower.includes('select') ||
      lower.includes('zoom') ||
      lower.includes('focus') ||
      lower.includes('open') ||
      lower.includes('go to') ||
      lower.includes('take me'))
  ) {
    return {
      matched: true,
      actions: [{ actionName: entityPlan.action, params: entityPlan.params }],
      replyText: `Focused on ${entityPlan.topic}. You can continue orbiting or inspecting with mouse or hand gestures.`,
      spokenText: `Focused on ${entityPlan.topic}.`,
      topic: entityPlan.topic,
    };
  }

  // 7. Earth Overlays & Camera Controls
  if (lower.includes('water resources') || lower.includes('water availability')) {
    return {
      matched: true,
      actions: [
        { actionName: 'navigate_to_earth', params: {} },
        { actionName: 'set_earth_overlay', params: { overlay: 'water-availability' } },
      ],
      replyText: 'Earth Explorer opened with the Water Availability & Scarcity overlay.',
      spokenText: 'Showing global water resources on Earth Explorer.',
    };
  }
  if (lower.includes('show freshwater') || lower.includes('freshwater overlay')) {
    return {
      matched: true,
      actions: [
        { actionName: 'navigate_to_earth', params: {} },
        { actionName: 'set_earth_overlay', params: { overlay: 'freshwater' } },
      ],
      replyText: 'Switched Earth Explorer to the Freshwater Systems (2.5%) overlay.',
      spokenText: 'Showing Earth freshwater systems.',
    };
  }
  if (lower.includes('show saltwater') || lower.includes('ocean overlay')) {
    return {
      matched: true,
      actions: [
        { actionName: 'navigate_to_earth', params: {} },
        { actionName: 'set_earth_overlay', params: { overlay: 'saltwater' } },
      ],
      replyText: 'Switched Earth Explorer to the Saltwater Oceans (97.5%) overlay.',
      spokenText: 'Showing Earth saltwater oceans.',
    };
  }
  if (lower.includes('groundwater overlay') || lower.includes('show global groundwater')) {
    return {
      matched: true,
      actions: [
        { actionName: 'navigate_to_earth', params: {} },
        { actionName: 'set_earth_overlay', params: { overlay: 'groundwater' } },
      ],
      replyText: 'Switched Earth Explorer to the Global Groundwater & Aquifers (30.1%) overlay.',
      spokenText: 'Showing global groundwater basins.',
    };
  }
  if (lower.includes('rotate') && (lower.includes('earth') || lower.includes('globe') || lower.includes('scene'))) {
    const stop = lower.includes('stop') || lower.includes('pause');
    return {
      matched: true,
      actions: [{ actionName: 'rotate_scene', params: { value: !stop } }],
      replyText: stop ? 'Paused 3D scene rotation.' : 'Auto-rotating the 3D scene.',
      spokenText: stop ? 'Rotation paused.' : 'Rotating the 3D scene.',
    };
  }
  if (lower.includes('zoom in')) {
    return {
      matched: true,
      actions: [{ actionName: 'zoom_scene', params: { delta: -0.45 } }],
      replyText: 'Zoomed camera closer.',
      spokenText: 'Zoomed in.',
    };
  }
  if (lower.includes('zoom out')) {
    return {
      matched: true,
      actions: [{ actionName: 'zoom_scene', params: { delta: 0.45 } }],
      replyText: 'Zoomed camera outward.',
      spokenText: 'Zoomed out.',
    };
  }

  // 8. Scene Navigation Commands
  if (lower.includes('city\'s water supply') || lower.includes('city water supply') || lower.includes('smart city dashboard')) {
    return {
      matched: true,
      actions: [
        { actionName: 'navigate_to_city', params: {} },
        { actionName: 'set_city_tab', params: { tab: 'dashboard' } },
      ],
      replyText: 'Opened Future Smart City and displayed the live municipal water supply balance dashboard.',
      spokenText: 'Showing the Smart City water supply dashboard.',
    };
  }
  if (
    lower.includes('smart city') ||
    lower.includes('take me to the city') ||
    lower.includes('open city')
  ) {
    return {
      matched: true,
      actions: [{ actionName: 'navigate_to_city', params: {} }],
      replyText: 'Navigated to Module 02: Future Smart City.',
      spokenText: 'Welcome to the Future Smart City.',
    };
  }
  if (
    lower.includes('underground') ||
    lower.includes('below ground') ||
    lower.includes('subsurface')
  ) {
    return {
      matched: true,
      actions: [{ actionName: 'navigate_to_underground', params: {} }],
      replyText: 'Navigated to Module 03: Underground Water World.',
      spokenText: 'Entering Underground Water World.',
    };
  }
  if (
    lower.includes('earth explorer') ||
    lower.includes('show me earth') ||
    lower.includes('go to earth') ||
    lower.includes('back to earth')
  ) {
    return {
      matched: true,
      actions: [{ actionName: 'navigate_to_earth', params: {} }],
      replyText: 'Navigated to Module 01: Earth Water Explorer.',
      spokenText: 'Showing Earth Water Explorer.',
    };
  }

  // 9. Scientific Knowledge Q&A
  const kb = matchScientificKnowledge(lower, lang);
  if (kb) {
    const ans = getKnowledgeText(kb, lang);
    return {
      matched: true,
      actions: [],
      replyText: ans,
      spokenText: ans,
      topic: kb.topic,
    };
  }

  return {
    matched: false,
    actions: [],
    replyText: '',
    spokenText: '',
  };
}

function executeAllowedActions(
  proposed: ProposedAquaAction[],
  dispatchAction: (
    actionName: RegisteredActionName,
    params?: Record<string, unknown>
  ) => ActionExecutionResult
): {
  badges: AquaExecutedActionBadge[];
  pendingConfirmation: AquaPendingConfirmation | null;
} {
  const badges: AquaExecutedActionBadge[] = [];
  for (const item of proposed) {
    if (!isAllowedAction(item.actionName)) {
      badges.push({
        actionName: 'clear_selection',
        ok: false,
        message: `Blocked unallowlisted action "${String(item.actionName)}".`,
      });
      continue;
    }
    if (DESTRUCTIVE_ACTIONS.has(item.actionName) && item.params.confirmed !== true) {
      return {
        badges,
        pendingConfirmation: {
          id: `conf-${Date.now()}`,
          actionName: item.actionName,
          params: { ...item.params, confirmed: true },
          prompt: `Confirm ${item.actionName.replace(/_/g, ' ')}?`,
        },
      };
    }
    const res = dispatchAction(item.actionName, item.params);
    badges.push({
      actionName: item.actionName,
      ok: res.ok,
      message: res.message,
      updatedValue: res.updatedValue,
    });
  }
  return { badges, pendingConfirmation: null };
}

export async function runAquaTurn(
  rawInput: string,
  state: ExhibitionState,
  dispatchAction: (
    actionName: RegisteredActionName,
    params?: Record<string, unknown>
  ) => ActionExecutionResult
): Promise<AquaBrainOutcome> {
  const text = rawInput.trim();
  const lang = state.aqua.language;
  const lower = text.toLowerCase();

  // Handle pending destructive-action confirmation if active
  if (state.aqua.pendingConfirmation) {
    const pending = state.aqua.pendingConfirmation;
    if (/^(yes|confirm|proceed|ok|do it|reset|ശരി|हाँ|जी)$/i.test(lower)) {
      const res = dispatchAction(pending.actionName, { ...pending.params, confirmed: true });
      const msg = res.ok ? `Confirmed: ${res.message}` : `Could not complete: ${res.message}`;
      return {
        replyText: msg,
        spokenText: msg,
        mode: state.aqua.aiMode,
        reason: state.aqua.aiReason,
        executedActions: [
          {
            actionName: pending.actionName,
            ok: res.ok,
            message: res.message,
            updatedValue: res.updatedValue,
          },
        ],
        pendingConfirmation: null,
        lastDiscussedTopic: state.aqua.lastDiscussedTopic,
        lastModifiedParam: state.aqua.lastModifiedParam,
      };
    }
    if (/^(no|cancel|stop|abort|വേണ്ട|नहीं)$/i.test(lower)) {
      const msg = 'Reset cancelled. Your current simulation values remain unchanged.';
      return {
        replyText: msg,
        spokenText: msg,
        mode: state.aqua.aiMode,
        reason: state.aqua.aiReason,
        executedActions: [],
        pendingConfirmation: null,
        lastDiscussedTopic: state.aqua.lastDiscussedTopic,
        lastModifiedParam: state.aqua.lastModifiedParam,
      };
    }
  }

  // Run deterministic resolver first to validate commands & provide offline baseline
  const det = resolveDeterministicTurn(text, state);

  // If offline or server unreachable, still execute deterministic command / scientific knowledge
  const snapshot = getAquaStateSnapshot(state);
  const eduContext = getAquaEducationalContext(state);

  try {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 14000);
    const resp = await fetch('/api/aqua/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        message: text,
        language: lang,
        history: state.aqua.messages.slice(-8).map((m: AquaChatMessage) => ({
          role: m.role,
          text: m.text,
        })),
        contextSnapshot: snapshot,
        educationalContext: eduContext,
      }),
    });
    window.clearTimeout(timeoutId);

    const payload = (await resp.json()) as {
      ok?: boolean;
      mode?: AquaAiMode;
      reason?: string;
      errorMessage?: string;
      data?: {
        reply: string;
        spokenSummary: string;
        discussedTopic?: string | null;
        clarificationNeeded?: boolean;
        requiresConfirmation?: boolean;
        confirmationPrompt?: string | null;
        proposedActions?: Array<{
          actionName: string;
          paramsJson: string;
          rationale?: string;
        }>;
      };
    };

    if (payload.ok && payload.data) {
      const rawActions = payload.data.proposedActions ?? [];
      const parsedActions: ProposedAquaAction[] = [];

      for (const a of rawActions) {
        if (!isAllowedAction(a.actionName)) continue;
        let parsedParams: Record<string, unknown> = {};
        try {
          const obj = JSON.parse(a.paramsJson || '{}');
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            parsedParams = obj as Record<string, unknown>;
          }
        } catch {
          parsedParams = {};
        }
        parsedActions.push({ actionName: a.actionName, params: parsedParams });
      }

      // If Gemini didn't include a deterministic action for a crystal-clear UI command, merge deterministic action
      const finalActions = parsedActions.length > 0 ? parsedActions : det.actions;

      if (payload.data.requiresConfirmation && finalActions.length > 0) {
        const firstDestructive = finalActions.find((fa) => DESTRUCTIVE_ACTIONS.has(fa.actionName));
        if (firstDestructive) {
          const prompt =
            payload.data.confirmationPrompt ?? buildConfirmationPrompt(firstDestructive.actionName, lang);
          return {
            replyText: payload.data.reply,
            spokenText: payload.data.spokenSummary || payload.data.reply,
            mode: 'live',
            reason: null,
            executedActions: [],
            pendingConfirmation: {
              id: `conf-${Date.now()}`,
              actionName: firstDestructive.actionName,
              params: { ...firstDestructive.params, confirmed: true },
              prompt,
            },
            lastDiscussedTopic: payload.data.discussedTopic ?? state.aqua.lastDiscussedTopic,
            lastModifiedParam: det.modifiedParam ?? state.aqua.lastModifiedParam,
          };
        }
      }

      const exec = executeAllowedActions(finalActions, dispatchAction);
      return {
        replyText: payload.data.reply,
        spokenText: payload.data.spokenSummary || payload.data.reply,
        mode: 'live',
        reason: null,
        executedActions: exec.badges,
        pendingConfirmation: exec.pendingConfirmation,
        lastDiscussedTopic: payload.data.discussedTopic ?? det.topic ?? state.aqua.lastDiscussedTopic,
        lastModifiedParam: det.modifiedParam ?? state.aqua.lastModifiedParam,
      };
    }

    // Fallback to Offline Demo Mode when API key missing / quota / error
    const fallbackReason = payload.errorMessage ?? payload.reason ?? 'Offline Demo Mode active';
    if (det.matched) {
      if (det.requiresConfirmation) {
        return {
          replyText: det.replyText,
          spokenText: det.spokenText,
          mode: 'offline-demo',
          reason: fallbackReason,
          executedActions: [],
          pendingConfirmation: {
            id: `conf-${Date.now()}`,
            ...det.requiresConfirmation,
          },
          lastDiscussedTopic: det.topic ?? state.aqua.lastDiscussedTopic,
          lastModifiedParam: det.modifiedParam ?? state.aqua.lastModifiedParam,
        };
      }
      const exec = executeAllowedActions(det.actions, dispatchAction);
      return {
        replyText: det.replyText,
        spokenText: det.spokenText,
        mode: 'offline-demo',
        reason: fallbackReason,
        executedActions: exec.badges,
        pendingConfirmation: exec.pendingConfirmation,
        lastDiscussedTopic: det.topic ?? state.aqua.lastDiscussedTopic,
        lastModifiedParam: det.modifiedParam ?? state.aqua.lastModifiedParam,
      };
    }

    const clarification = localizedReply(
      lang,
      `I am currently in Offline Demo Mode (local rule-based engine). I didn't recognize a specific rule for "${text}". Try asking about groundwater, aquifers, rainwater harvesting, desalination, pipeline leaks, or give a command like "Show Kerala", "Take me to the smart city", or "Create a pipeline leak".`,
      `ഞാൻ ഇപ്പോൾ ഓഫ്‌ലൈൻ ഡെമോ മോഡിലാണ്. ഭൂഗർഭജലം, മഴവെള്ള സംഭരണം, ഡീസാലിനേഷൻ എന്നിവയെക്കുറിച്ച് ചോദിക്കാം, അല്ലെങ്കിൽ "Show Kerala", "Take me to the smart city" പോലുള്ള കമാൻഡുകൾ നൽകാം.`,
      `मैं अभी ऑफ़लाइन डेमो मोड में हूँ। आप भूजल, जलभृत, वर्षा जल संचयन, विलवणीकरण के बारे में पूछ सकते हैं या "Show Kerala", "Take me to the smart city" जैसे कमांड दे सकते हैं।`
    );

    return {
      replyText: clarification,
      spokenText: clarification,
      mode: 'offline-demo',
      reason: fallbackReason,
      executedActions: [],
      pendingConfirmation: null,
      lastDiscussedTopic: state.aqua.lastDiscussedTopic,
      lastModifiedParam: state.aqua.lastModifiedParam,
    };
  } catch {
    // Network / offline fallback
    if (det.matched) {
      if (det.requiresConfirmation) {
        return {
          replyText: det.replyText,
          spokenText: det.spokenText,
          mode: 'offline-demo',
          reason: 'Network unavailable — running Offline Demo Mode locally.',
          executedActions: [],
          pendingConfirmation: {
            id: `conf-${Date.now()}`,
            ...det.requiresConfirmation,
          },
          lastDiscussedTopic: det.topic ?? state.aqua.lastDiscussedTopic,
          lastModifiedParam: det.modifiedParam ?? state.aqua.lastModifiedParam,
        };
      }
      const exec = executeAllowedActions(det.actions, dispatchAction);
      return {
        replyText: det.replyText,
        spokenText: det.spokenText,
        mode: 'offline-demo',
        reason: 'Network unavailable — running Offline Demo Mode locally.',
        executedActions: exec.badges,
        pendingConfirmation: exec.pendingConfirmation,
        lastDiscussedTopic: det.topic ?? state.aqua.lastDiscussedTopic,
        lastModifiedParam: det.modifiedParam ?? state.aqua.lastModifiedParam,
      };
    }

    const offlineHelp = localizedReply(
      lang,
      'Backend AI service is unreachable right now, so I am running locally in Offline Demo Mode. You can still ask core water-science questions and run Earth, Smart City, Underground, and simulation commands.',
      'സെർവറുമായി ബന്ധപ്പെടാൻ കഴിയാത്തതിനാൽ ഓഫ്‌ലൈൻ ഡെമോ മോഡിൽ പ്രവർത്തിക്കുന്നു. പ്രധാന ജലശാസ്ത്ര ചോദ്യങ്ങളും വെബ്സൈറ്റ് കമാൻഡുകളും ഇപ്പോഴും പ്രവർത്തിക്കും.',
      'AI सर्वर से संपर्क नहीं हो पा रहा है, इसलिए मैं स्थानीय ऑफ़लाइन डेमो मोड में काम कर रही हूँ। आप जल-विज्ञान के प्रश्न पूछ सकते हैं और सभी दृश्य कमांड चला सकते हैं।'
    );

    return {
      replyText: offlineHelp,
      spokenText: offlineHelp,
      mode: 'offline-demo',
      reason: 'Network unavailable — running Offline Demo Mode locally.',
      executedActions: [],
      pendingConfirmation: null,
      lastDiscussedTopic: state.aqua.lastDiscussedTopic,
      lastModifiedParam: state.aqua.lastModifiedParam,
    };
  }
}
