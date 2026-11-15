import { AquaLanguage, ExhibitionState } from '../types/exhibition';
import { computeIntegratedWaterBalance } from './simulationEngine';

export interface KnowledgeEntry {
  id: string;
  topic: string;
  keywords: string[];
  answerEn: string;
  answerMl: string;
  answerHi: string;
  suggestedScene?: 'earth' | 'city' | 'underground';
}

export const WATER_SCIENCE_KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'groundwater-aquifer',
    topic: 'Groundwater & Aquifers',
    keywords: [
      'groundwater',
      'aquifer',
      'water table',
      'phreatic',
      'aquitard',
      'borewell',
      'ഭൂഗർഭജലം',
      'ഭൂഗർഭ',
      'भूजल',
      'जलभृत',
    ],
    answerEn:
      'Groundwater is water held underground inside pores and fractures of sand, gravel, and permeable rock. An aquifer is a saturated geological layer capable of storing and transmitting usable water—such as our unconfined gravel aquifer (9–18 m depth) or deep confined sandstone aquifer (23–34 m) protected beneath an impermeable clay aquitard. Real aquifer recharge rates range from millimeters to decimeters per year depending on soil hydraulic conductivity (from ~10⁻² m/s in gravel down to <10⁻⁸ m/s in clay).',
    answerMl:
      'മണൽ, ചരൽ, സുഷിരങ്ങളുള്ള പാറകൾ എന്നിവയുടെ വിടവുകളിൽ ഭൂമിക്കടിയിൽ സംഭരിക്കപ്പെടുന്ന ജലമാണ് ഭൂഗർഭജലം (Groundwater). ഉപയോഗയോഗ്യമായ അളവിൽ ജലം ശേഖരിച്ച് കടത്തിവിടുന്ന ഭൂഗർഭ പാളികളെ അക്വിഫറുകൾ (Aquifers) എന്ന് വിളിക്കുന്നു. ഭൂഗർഭ ജലവിതാനത്തിനും മുകളിൽ വായുവും ഈർപ്പവും കലർന്ന പാളിയും താഴെ പൂർണ്ണമായി ജലം നിറഞ്ഞ പാളിയും കാണപ്പെടുന്നു.',
    answerHi:
      'भूजल (Groundwater) मिट्टी, रेत, बजरी और पारगम्य चट्टानों के छिद्रों में जमीन के नीचे जमा पानी है। जो भूवैज्ञानिक परत उपयोगी मात्रा में पानी संग्रहित और प्रवाहित कर सके उसे जलभृत (Aquifer) कहते हैं—जैसे ऊपरी बजरी जलभृत और चिकनी मिट्टी की परत (Aquitard) के नीचे स्थित गहरा बलुआ पत्थर जलभृत।',
    suggestedScene: 'underground',
  },
  {
    id: 'surface-vs-groundwater',
    topic: 'Surface Water vs Groundwater',
    keywords: [
      'difference between surface',
      'surface water and groundwater',
      'surface vs groundwater',
      'ഉപരിതല ജലം',
      'सतही जल और भूजल',
    ],
    answerEn:
      'Surface water sits in rivers, lakes, and reservoirs (~1.2% of Earth’s freshwater) and responds rapidly to seasonal rain, droughts, and evaporation. Groundwater holds ~30.1% of Earth’s freshwater in subterranean pores with virtually zero evaporation loss, moving much slower (centimeters per day to meters per year) and acting as a critical drought buffer—though once depleted or polluted, recovery can take years to centuries.',
    answerMl:
      'നദികളിലും തടാകങ്ങളിലും അണക്കെട്ടുകളിലുമുള്ള ഉപരിതല ജലം മഴയോട് വേഗത്തിൽ പ്രതികരിക്കുകയും ബാഷ്പീകരണത്തിന് വിധേയമാകുകയും ചെയ്യുന്നു (ഭൂമിയിലെ ശുദ്ധജലത്തിന്റെ ~1.2%). എന്നാൽ ഭൂഗർഭജലം (~30.1%) ബാഷ്പീകരണം ഇല്ലാതെ ഭൂമിക്കടിയിൽ സംഭരിക്കപ്പെടുന്നതിനാൽ വരൾച്ചക്കാലത്ത് കരുതൽ ശേഖരമായി പ്രവർത്തിക്കുന്നു; പക്ഷേ ഇത് മലിനമായാലോ അമിതമായി ഊറ്റിയാലോ വീണ്ടെടുക്കാൻ വർഷങ്ങളെടുക്കും.',
    answerHi:
      'सतही जल नदियों, झीलों और जलाशयों में होता है (~1.2% मीठा पानी), जो बारिश के साथ तेजी से बदलता है और वाष्पीकरण से घटता है। भूजल (~30.1% मीठा पानी) भूमिगत छिद्रों में वाष्पीकरण के बिना सुरक्षित रहता है और सूखे में बफर का काम करता है, लेकिन इसके अति-दोहन या प्रदूषण की भरपाई में वर्षों से सदियां लग सकती हैं।',
  },
  {
    id: 'water-cycle',
    topic: 'Water Cycle',
    keywords: [
      'water cycle',
      'hydrologic cycle',
      'evaporation',
      'condensation',
      'precipitation',
      'infiltration',
      'ജലചക്രം',
      'जल चक्र',
    ],
    answerEn:
      'The hydrological cycle continuously moves Earth’s ~1.386 billion km³ of water via solar-powered evaporation (about 86% from oceans at ~35 g/L salinity), atmospheric moisture transport, condensation into clouds, precipitation as rain or snow, surface runoff in rivers, and infiltration into soil and groundwater aquifers—returning to the oceans to repeat.',
    answerMl:
      'സൂര്യതാപത്താൽ സമുദ്രങ്ങളിൽ നിന്നും ജലാശയങ്ങളിൽ നിന്നും ജലം നീരാവിയായി മാറുന്ന ബാഷ്പീകരണവും (Evaporation), മേഘങ്ങളായി മാറുന്ന സാന്ദ്രീകരണവും (Condensation), മഴയായി പെയ്യുന്നതും (Precipitation), മണ്ണിലേക്ക് ഊർന്നിറങ്ങുന്നതും (Infiltration), നദികളിലൂടെ ഒഴുകി തിരിച്ചെത്തുന്നതുമായ തുടർച്ചയായ പ്രക്രിയയാണ് ജലചക്രം.',
    answerHi:
      'जल चक्र सौर ऊर्जा से चलने वाली सतत प्रक्रिया है: महासागरों और सतह से वाष्पीकरण (लगभग 86% समुद्री वाष्पीकरण), संघनन से बादल बनना, वर्षा या हिमपात, नदियों में सतही बहाव, और मिट्टी के माध्यम से भूजल जलभृतों में रिसाव (Infiltration)।',
    suggestedScene: 'earth',
  },
  {
    id: 'water-scarcity',
    topic: 'Water Scarcity & Urban Stress',
    keywords: [
      'running out of water',
      'water scarcity',
      'water crisis',
      'shortage',
      'drought',
      'ജലക്ഷാമം',
      'जल संकट',
      'क्यों हो रही है पानी की कमी',
    ],
    answerEn:
      'Cities face water scarcity even in wet regions for four main reasons: (1) Only ~2.5% of Earth’s water is freshwater and <1% is accessible surface liquid; (2) Seasonal concentration (for example, Kerala receives ~3,000 mm/yr rainfall yet steep terrain causes ~40–50% rapid coastal runoff before dry summer months); (3) Aging distribution pipelines losing 20–40% as leaks; and (4) Impervious concrete paving blocking aquifer recharge while borewell pumping exceeds natural replenishment.',
    answerMl:
      'നഗരങ്ങളിൽ ജലക്ഷാമം ഉണ്ടാകാൻ പ്രധാന കാരണങ്ങൾ: ഭൂമിയിലെ ആകെ ജലത്തിന്റെ 2.5% മാത്രമാണ് ശുദ്ധജലം; കേരളം പോലുള്ള പ്രദേശങ്ങളിൽ ശക്തമായ മഴ ലഭിച്ചാലും ചെരിഞ്ഞ ഭൂപ്രകൃതി കാരണം വെള്ളം വേഗത്തിൽ ഒഴുകിപ്പോകുന്നു; പൈപ്പ് ചോർച്ചകളും കോൺക്രീറ്റ് പ്രതലങ്ങൾ കാരണം ഭൂഗർഭജല റീചാർജ് കുറയുന്നതും ക്ഷാമം വർദ്ധിപ്പിക്കുന്നു.',
    answerHi:
      'शहरों में जल संकट के मुख्य कारण हैं: पृथ्वी के कुल पानी का केवल ~2.5% मीठा पानी है, मौसमी वर्षा का असमान वितरण, पाइपलाइन रिसाव से 20–40% पानी की बर्बादी, और कंक्रीट शहरीकरण के कारण भूजल पुनर्भरण (Recharge) कम होना जबकि पंपिंग बढ़ती जा रही है।',
    suggestedScene: 'city',
  },
  {
    id: 'rainwater-harvesting',
    topic: 'Rainwater Harvesting',
    keywords: [
      'rainwater harvesting',
      'harvesting',
      'catchment',
      'cistern',
      'mazhapolima',
      'മഴവെള്ള',
      'മഴവെള്ള സംഭരണം',
      'वर्षा जल संचयन',
    ],
    answerEn:
      'Rainwater harvesting captures roof or catchment runoff via gutters, discards dusty first-flush water, filters it through sand and activated charcoal, and stores it in cisterns or directs overflow into recharge wells. The engineering equation is Yield (L) = Rainfall (mm) × Catchment Area (m²) × Runoff Coefficient (typically ~0.85 for metal/concrete roofs). For instance, 50 mm of rain on a 400 m² roof harvests 17,000 L.',
    answerMl:
      'മേൽക്കൂരകളിൽ വീഴുന്ന മഴവെള്ളം പാത്തികൾ വഴി ശേഖരിച്ച് ആദ്യത്തെ മഴയിലെ പൊടി നീക്കിയ ശേഷം (First-flush diverter) മണൽ-കരി ഫിൽട്ടറുകളിലൂടെ ശുദ്ധീകരിച്ച് ടാങ്കുകളിലോ കിണറുകളിലോ സംഭരിക്കുന്ന രീതിയാണ് മഴവെള്ള സംഭരണം. ശേഖരിക്കാവുന്ന ജലം (ലിറ്റർ) = മഴ (mm) × മേൽക്കൂരയുടെ വിസ്തീർണ്ണം (m²) × റൺഓഫ് ഗുണകം (~0.85).',
    answerHi:
      'वर्षा जल संचयन छत के पानी को नालियों, फर्स्ट-फ्लश फिल्टर और रेत-चारकोल फिल्टर से गुजारकर टैंक या रिचार्ज कुएं में जमा करता है। सूत्र: प्राप्त जल (लीटर) = वर्षा (mm) × छत का क्षेत्रफल (m²) × अपवाह गुणांक (~0.85)। जैसे 400 m² छत पर 50 mm बारिश से 17,000 लीटर जल मिल सकता है।',
    suggestedScene: 'city',
  },
  {
    id: 'pipeline-leakage',
    topic: 'Pipeline Leakage & Non-Revenue Water',
    keywords: [
      'pipeline leak',
      'pipe leak',
      'leakage',
      'burst',
      'non-revenue',
      'പൈപ്പ് ചോർച്ച',
      'पाइपलाइन रिसाव',
    ],
    answerEn:
      'When a pressurized municipal pipeline leaks, water escapes continuously underground in proportion to line pressure (in bar), wasting treated water, dropping hydraulic pressure for downstream homes, increasing pumping electricity, and risking groundwater contamination entry if pressure collapses below external soil water pressure. District smart meters and pressure-reducing valves isolate bursts rapidly.',
    answerMl:
      'സമ്മർദ്ദത്തിലുള്ള കുടിവെള്ള പൈപ്പുകളിൽ ചോർച്ചയുണ്ടായാൽ ശുദ്ധീകരിച്ച ജലം പാഴാകുന്നതിനൊപ്പം നഗരത്തിലെ ജലസമ്മർദ്ദം (bar) കുറയുകയും വൈദ്യുതി ഉപയോഗം കൂടുകയും ചെയ്യും. സ്മാർട്ട് വാട്ടർ മീറ്ററുകളും അക്കോസ്റ്റിക് സെൻസറുകളും ചോർച്ച വേഗത്തിൽ കണ്ടെത്താൻ സഹായിക്കുന്നു.',
    answerHi:
      'दबाव वाली पाइपलाइन में रिसाव होने पर उपचारित पानी बर्बाद होता है, नेटवर्क दबाव (bar) गिरता है, पंपिंग ऊर्जा बढ़ती है, और दबाव कम होने पर बाहरी दूषित पानी पाइप में घुसने का खतरा रहता है। स्मार्ट मीटर तुरंत रिसाव का पता लगाने में मदद करते हैं।',
    suggestedScene: 'city',
  },
  {
    id: 'desalination',
    topic: 'Desalination',
    keywords: [
      'desalination',
      'reverse osmosis',
      'brine',
      'seawater',
      'ഉപ്പുവെള്ളം',
      'विलवणीकरण',
    ],
    answerEn:
      'Desalination removes dissolved salts (~35,000 mg/L in seawater) mainly through Reverse Osmosis (RO), forcing seawater at 55–70 bar through semi-permeable membranes that block salt ions while passing freshwater molecules. Key limitations: high energy demand (~3.0–4.5 kWh/m³) and concentrated brine discharge that must be diffused carefully to protect coastal marine ecosystems.',
    answerMl:
      'കടൽജലത്തിലെ ലവണാംശം (~35 g/L) നീക്കം ചെയ്ത് ശുദ്ധജലമാക്കുന്ന പ്രക്രിയയാണ് ഡീസാലിനേഷൻ (Desalination). റിവേഴ്സ് ഓസ്മോസിസ് (RO) വഴി ഉയർന്ന മർദ്ദത്തിൽ (55–70 bar) മെംബ്രേനുകളിലൂടെ വെള്ളം കടത്തിവിടുന്നു. ഉയർന്ന വൈദ്യുതി ചെലവും (~3–4.5 kWh/m³) ബാക്കിവരുന്ന ഉപ്പ് കലർന്ന ബ്രൈൻ (Brine) സംസ്കരണവുമാണ് ഇതിന്റെ പ്രധാന വെല്ലുവിളികൾ.',
    answerHi:
      'विलवणीकरण (Desalination) मुख्यतः रिवर्स ऑस्मोसिस (RO) से ~35 g/L खारे समुद्री जल को 55–70 bar दबाव पर अर्ध-पारगम्य झिल्ली से गुजारकर मीठा बनाता है। इसकी सीमाएँ हैं: उच्च ऊर्जा खपत (~3.0–4.5 kWh/m³) और खारे ब्राइन का सुरक्षित समुद्री निपटान।',
    suggestedScene: 'earth',
  },
  {
    id: 'filtration-purification',
    topic: 'Filtration & Purification',
    keywords: [
      'filtration',
      'purification',
      'treatment plant',
      'coagulation',
      'flocculation',
      'uv disinfection',
      'ശുദ്ധീകരണം',
      'फिल्ट्रेशन',
      'शुद्धिकरण',
    ],
    answerEn:
      'Modern drinking-water treatment uses multi-barrier purification: (1) Screening debris; (2) Sedimentation & coagulation/flocculation; (3) Coarse gravel & fine silica sand filtration (removing suspended silt and turbidity); (4) Activated carbon adsorption (reducing organic taste and odor); and (5) UV or chlorination disinfection. Important safety limit: ordinary gravel, sand, and carbon filtration alone does NOT remove dissolved salts or guarantee the removal of bacteria and viruses—microbiological disinfection and water quality testing remain essential before drinking.',
    answerMl:
      'കുടിവെള്ള ശുദ്ധീകരണ ശാലകളിൽ സെഡിമെന്റേഷൻ, ചരൽ-മണൽ ഫിൽട്രേഷൻ, ആക്റ്റിവേറ്റഡ് കാർബൺ, അൾട്രാവയലറ്റ് (UV) അണുനശീകരണം എന്നീ ഘട്ടങ്ങളാണുള്ളത്. സാധാരണ മണൽ-കരി ഫിൽട്ടറുകൾ മാത്രം ഉപയോഗിക്കുന്നത് എല്ലാ രോഗാണുക്കളെയോ ലവണങ്ങളെയോ നീക്കം ചെയ്യില്ല; കുടിക്കുന്നതിന് മുമ്പ് അണുനശീകരണവും പരിശോധനയും ആവശ്യമാണ്.',
    answerHi:
      'पेयजल शुद्धिकरण में अवसादन (Sedimentation), बजरी-रेत फिल्ट्रेशन, सक्रिय कार्बन सोखने और UV/क्लोरीन कीटाणुशोधन के चरण होते हैं। ध्यान दें: सामान्य रेत-बजरी-कार्बन फिल्ट्रेशन अकेले घुले हुए नमक या सभी रोगाणुओं को नहीं हटाता; पीने से पहले कीटाणुशोधन और परीक्षण आवश्यक है।',
    suggestedScene: 'city',
  },
  {
    id: 'wastewater-treatment',
    topic: 'Wastewater Treatment & Recycling',
    keywords: [
      'wastewater',
      'recycling',
      'sewage',
      'greywater',
      'purple pipe',
      'മലിനജല',
      'अपशिष्ट जल',
    ],
    answerEn:
      'Urban wastewater recycling recovers up to 65–85% of domestic water through preliminary screening, primary settling, aerobic biological nutrient digestion, membrane ultrafiltration, and UV polishing. Dual "purple pipe" networks deliver reclaimed water for cooling towers, landscaping, and toilet flushing, sharply reducing freshwater extraction.',
    answerMl:
      'മലിനജല സംസ്കരണ ശാലകൾ പ്രാഥമിക അരിക്കൽ, ബയോളജിക്കൽ ട്രീറ്റ്മെന്റ്, അൾട്രാഫിൽട്രേഷൻ, UV ശുദ്ധീകരണം എന്നിവയിലൂടെ ജലം വീണ്ടെടുക്കുന്നു. പർപ്പിൾ പൈപ്പുകൾ വഴി ഈ ജലം പൂന്തോട്ടങ്ങളിലും കൂളിംഗ് ടവറുകളിലും പുനരുപയോഗിക്കാം.',
    answerHi:
      'अपशिष्ट जल पुनर्चक्रण (Wastewater Recycling) जैविक उपचार, अल्ट्राफिल्ट्रेशन और UV शोधन के बाद गैर-पेय उपयोग (बागवानी, कूलिंग टावर, फ्लशिंग) के लिए पर्पल पाइप के जरिए साफ पानी लौटाता है, जिससे ताजे पानी की मांग काफी घटती है।',
    suggestedScene: 'city',
  },
  {
    id: 'water-pollution',
    topic: 'Water Pollution & Contamination',
    keywords: [
      'pollution',
      'contamination',
      'plume',
      'nitrate',
      'leachate',
      'മലിനീകരണം',
      'जल प्रदूषण',
    ],
    answerEn:
      'Water pollution occurs from agricultural nitrate runoff, untreated domestic sewage, industrial solvents, or landfill leachate. Unlike fast-flowing rivers that dilute pollutants quickly, groundwater contamination forms slow-moving plumes in aquifers where low microbial oxygen and zero sunlight prevent rapid breakdown—making source prevention far more effective than remediation.',
    answerMl:
      'കാർഷിക രാസവളങ്ങൾ, സംസ്കരിക്കാത്ത മലിനജലം, വ്യാവസായിക മാലിന്യങ്ങൾ എന്നിവ ഭൂഗർഭജലത്തെ മലിനമാക്കുന്നു. ഭൂഗർഭജലത്തിന്റെ ഒഴുക്ക് വളരെ സാവധാനത്തിലായതിനാൽ മലിനീകരണം നീക്കം ചെയ്യാൻ പ്രയാസമാണ്; അതിനാൽ ഉറവിട സംരക്ഷണം അനിവാര്യമാണ്.',
    answerHi:
      'कृषि नाइट्रेट, अनुपचारित सीवेज, औद्योगिक रसायन और लैंडफिल रिसाव जल को प्रदूषित करते हैं। भूजल बहुत धीरे बहता है, इसलिए एक बार जलभृत प्रदूषित हो जाए तो उसकी सफाई बेहद कठिन होती है।',
    suggestedScene: 'underground',
  },
  {
    id: 'water-conservation',
    topic: 'Water Conservation & Demand Reduction',
    keywords: [
      'reduce water consumption',
      'conserve',
      'conservation',
      'save water',
      'sustainable city',
      'smart water management',
      'ജലസംരക്ഷണം',
      'जल संरक्षण',
    ],
    answerEn:
      'Reducing urban water consumption combines efficient fixtures (cutting baseline 135 L/person/day usage via aerators and dual-flush toilets), fixing hidden pipeline leaks with smart AMI meters, greywater & purple-pipe recycling, rooftop rainwater harvesting, and permeable green spaces that recharge aquifers instead of flooding storm drains.',
    answerMl:
      'ജല ഉപയോഗം കുറയ്ക്കാൻ സ്മാർട്ട് മീറ്ററുകൾ, കുറഞ്ഞ ഒഴുക്കുള്ള ടാപ്പുകൾ, പൈപ്പ് ചോർച്ച തടയൽ, ഗ്രേവാട്ടർ പുനരുപയോഗം, മഴവെള്ള സംഭരണം, മണ്ണിനെ ജലം ആഗിരണം ചെയ്യാൻ അനുവദിക്കുന്ന ഹരിത നഗര രൂപകൽപ്പന എന്നിവ സഹായിക്കുന്നു.',
    answerHi:
      'पानी की खपत कम करने के लिए कम-बहाव नल (135 L/व्यक्ति/दिन से घटाने), स्मार्ट मीटर से रिसाव रोकने, ग्रेवाटर पुनर्चक्रण, वर्षा जल संचयन और पारगम्य हरित पार्कों को अपनाना सबसे प्रभावी उपाय हैं।',
    suggestedScene: 'city',
  },
  {
    id: 'climate-change-water',
    topic: 'Climate Change & Water Resources',
    keywords: [
      'climate change',
      'glacier',
      'monsoon',
      'extreme',
      'കാലാവസ്ഥാ വ്യതിയാനം',
      'जलवायु परिवर्तन',
    ],
    answerEn:
      'Warming air holds ~7% more water vapor per °C (Clausius–Clapeyron relation), intensifying extreme cloudburst floods alongside longer dry heatwaves. Simultaneously, retreating glaciers (holding ~68.7% of Earth’s freshwater) shrink dry-season river inflows for over 1.3 billion people downstream of the Himalayas, making subsurface aquifer banking essential.',
    answerMl:
      'താപനില ഉയരുമ്പോൾ അന്തരീക്ഷത്തിൽ കൂടുതൽ നീരാവി തങ്ങിനിൽക്കുകയും പെട്ടെന്നുള്ള അതിവർഷവും നീണ്ട വരൾച്ചയും വർദ്ധിക്കുകയും ചെയ്യുന്നു. ഹിമാനി ഉരുകൽ നദികളിലെ വേനൽക്കാല നീരൊഴുക്കിനെ ബാധിക്കുന്നു.',
    answerHi:
      'जलवायु परिवर्तन से वायुमंडल में नमी की क्षमता बढ़ती है, जिससे अतिवृष्टि (बाढ़) और लंबे सूखे दोनों बढ़ते हैं। हिमनदों के पिघलने से गर्मियों में नदियों का प्रवाह घटता है, इसलिए भूमिगत जल संचयन अत्यंत आवश्यक हो जाता है।',
    suggestedScene: 'earth',
  },
];

export function matchScientificKnowledge(
  query: string,
  language: AquaLanguage
): KnowledgeEntry | null {
  const q = query.toLowerCase();
  let best: { entry: KnowledgeEntry; score: number } | null = null;
  for (const entry of WATER_SCIENCE_KNOWLEDGE) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(kw.toLowerCase())) {
        score += kw.length > 8 ? 3 : 2;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }
  if (!best) return null;
  void language;
  return best.entry;
}

export function getKnowledgeText(entry: KnowledgeEntry, language: AquaLanguage): string {
  if (language === 'ml') return entry.answerMl;
  if (language === 'hi') return entry.answerHi;
  return entry.answerEn;
}

export function buildSimulationStatusSummary(
  state: ExhibitionState,
  language: AquaLanguage
): string {
  const integrated = computeIntegratedWaterBalance(state);
  const { city, underground } = integrated;
  const sceneName =
    state.currentScene === 'earth'
      ? 'Earth Explorer'
      : state.currentScene === 'city'
        ? 'Future Smart City'
        : state.currentScene === 'underground'
          ? 'Underground Water World'
          : state.currentScene === 'lab'
            ? 'AQUA Science Lab'
            : state.currentScene === 'simulations'
              ? 'Water Simulations'
              : state.currentScene.toUpperCase();

  const leakText = state.city.leak.active
    ? `Active trunk leak on ${state.city.leak.locationId} (${state.city.leak.severityLph.toLocaleString()} L/hr)`
    : 'No active trunk burst';

  if (language === 'ml') {
    return `നിലവിലെ സജീവ ദൃശ്യം: ${sceneName} (സിമുലേഷൻ ${state.simulationParams.running ? 'പ്രവർത്തിക്കുന്നു' : 'താൽക്കാലികമായി നിർത്തി'}). സജീവ ലാബ് പരീക്ഷണം: ${state.lab.activeExperiment}. നഗരത്തിലെ ജല ലഭ്യത ${city.totalAvailableSupplyMLd.toFixed(1)} ML/d, ആവശ്യം ${city.effectiveDemandMLd.toFixed(1)} ML/d, മഴ ${state.city.rainfallIntensity} mm, റിസർവോയർ ${state.city.reservoirStoragePct}%, ഭൂഗർഭ ജലവിതാനം ${state.underground.waterTableDepthM.toFixed(1)} m ആഴത്തിൽ (അക്വിഫർ സംഭരണം ${underground.aquiferStoragePct}%). (${leakText}). ഇവ വിദ്യാഭ്യാസ സിമുലേഷൻ മൂല്യങ്ങളാണ്.`;
  }

  if (language === 'hi') {
    return `वर्तमान सक्रिय दृश्य: ${sceneName} (सिमुलेशन ${state.simulationParams.running ? 'चल रहा है' : 'रुका हुआ है'}). सक्रिय प्रयोग: ${state.lab.activeExperiment}. शहर की कुल जल आपूर्ति ${city.totalAvailableSupplyMLd.toFixed(1)} ML/d, मांग ${city.effectiveDemandMLd.toFixed(1)} ML/d, वर्षा ${state.city.rainfallIntensity} mm, जलाशय ${state.city.reservoirStoragePct}%, भूजल स्तर ${state.underground.waterTableDepthM.toFixed(1)} m गहराई (जलभृत भंडारण ${underground.aquiferStoragePct}%). (${leakText}). ये शैक्षिक सिमुलेशन मान हैं।`;
  }

  return `Active scene: ${sceneName} (active lab experiment: ${state.lab.activeExperiment}, simulation ${state.simulationParams.running ? `running at ${state.simulationParams.speed}×` : 'paused'}). Illustrative model telemetry: City supply ${city.totalAvailableSupplyMLd.toFixed(1)} ML/d vs. demand ${city.effectiveDemandMLd.toFixed(1)} ML/d (net ${city.netBalanceMLd >= 0 ? '+' : ''}${city.netBalanceMLd.toFixed(1)} ML/d), rainfall ${state.city.rainfallIntensity} mm, reservoir ${state.city.reservoirStoragePct}%, recycling ${state.city.recyclingCapacityPct}%, water table depth ${state.underground.waterTableDepthM.toFixed(1)} m (${underground.aquiferStoragePct}% aquifer storage, net ${underground.netBalanceMLd >= 0 ? '+' : ''}${underground.netBalanceMLd.toFixed(1)} ML/d). ${leakText}.`;
}
