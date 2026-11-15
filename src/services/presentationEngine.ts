export interface PresentationChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  sceneTarget: 'earth' | 'city' | 'underground' | 'lab' | 'simulations' | 'mission' | 'aqua' | 'exhibition';
  summary: string;
  keyPoints: string[];
  narrationScript: string;
  scienceNote: string;
}

export const PRESENTATION_CHAPTERS: PresentationChapter[] = [
  {
    id: 'intro',
    number: 0,
    title: 'AquaGuard AI — The Living Planet',
    subtitle: 'Exhibition Welcome & Planetary Vision',
    sceneTarget: 'earth',
    summary: 'Water is the defining resource of our living planet. AquaGuard AI unites planetary hydrology science, futuristic smart cities, underground aquifers, and AI-driven control.',
    keyPoints: [
      'Over 2 billion people experience high seasonal or chronic water stress.',
      'Climate change intensifies monsoon volatility and glacial retreat.',
      'AquaGuard AI empowers cities with interactive digital-twin intelligence.',
    ],
    narrationScript: 'Welcome to AquaGuard AI — The Living Planet. As global populations grow and climate patterns shift, water security becomes one of the defining challenges of our century. This interactive digital twin platform connects planetary hydrology with smart urban engineering.',
    scienceNote: 'Global water budget: 97.5% saline ocean, 2.5% freshwater, with less than 1% of freshwater readily accessible in rivers and lakes.',
  },
  {
    id: 'earth-explorer',
    number: 1,
    title: 'Explore Our Planet',
    subtitle: 'Global Water Distribution & Regional Hydrology',
    sceneTarget: 'earth',
    summary: 'Examines Earth as an interconnected blue sphere, highlighting ocean evaporation loops, Himalayan glacial reserves, and regional monsoon basins like Kerala and India.',
    keyPoints: [
      'Interactive 3D globe with custom water availability overlays.',
      'Detailed hydrological profiles for major river basins and aquifers.',
      'Real-time satellite elevation and regional climate context.',
    ],
    narrationScript: 'Chapter One: Explore Our Planet. Here we visualize Earth’s vast hydrologic cycle. Oceans evaporate moisture that powers monsoons, while glaciers feed major river systems. Visitors can select global beacons to examine local water stress levels in Kerala, India, and across continental basins.',
    scienceNote: 'Educational visualization built from USGS and India WRIS hydrological reference data.',
  },
  {
    id: 'smart-city',
    number: 2,
    title: 'The Future Smart City',
    subtitle: 'Urban Water Networks, Storage & Leak Management',
    sceneTarget: 'city',
    summary: 'Steps inside a detailed 3D sustainable smart city featuring overhead reservoirs, water treatment plants, smart metering, and purple-pipe wastewater recycling.',
    keyPoints: [
      'Selectable 3D city buildings and water infrastructure.',
      'Live demand, recycling, and reservoir storage controls.',
      'Pipeline pressure and non-revenue water leak simulation.',
    ],
    narrationScript: 'Chapter Two: The Future Smart City. Step into a sustainable urban water ecosystem. Here, smart sensors, automated treatment plants, and rainwater harvesting cisterns work in harmony to eliminate waste and secure continuous clean water for every resident.',
    scienceNote: 'Smart water distribution combines pressure-reduction zoning and ultrasonic AMI metering to cut non-revenue water losses.',
  },
  {
    id: 'underground-world',
    number: 3,
    title: 'The Underground Water World',
    subtitle: 'Geological Strata, Aquifers & Borewells',
    sceneTarget: 'underground',
    summary: 'A 3D cross-section revealing subterranean soil layers, unconfined gravel aquifers, clay aquitards, deep confined borewells, and recharge percolation pits.',
    keyPoints: [
      'Layered geological cutaway beneath the city.',
      'Water table drawdown versus managed artificial recharge.',
      'Interactive borewell pumping cones and contamination tracking.',
    ],
    narrationScript: 'Chapter Three: The Underground Water World. Beneath our streets lies an invisible network of aquifers holding thirty percent of Earth’s freshwater. This geological cutaway reveals how over-extraction drops the water table and why managed artificial recharge is essential.',
    scienceNote: 'Subsurface storage acts as a natural multi-year buffer during drought periods.',
  },
  {
    id: 'science-lab',
    number: 4,
    title: 'The Science Lab & Simulations',
    subtitle: 'Eight Equation-Driven Water Engineering Models',
    sceneTarget: 'lab',
    summary: 'Immersive clean-room laboratory featuring eight interactive stations: Water Cycle, Rainwater Harvesting, Groundwater Depletion, Pipeline Leakage, Filtration, Desalination RO, Supply/Demand, and Smart City Management.',
    keyPoints: [
      'Transparent physics and chemistry equations with live units.',
      'Before vs After baseline comparison snapshots.',
      'Rigorous scientific disclaimers and safety notices.',
    ],
    narrationScript: 'Chapter Four: The Science Lab. Visitors can experiment directly with eight quantitative water models—from reverse osmosis desalination and multi-stage sand filtration to exact rainwater catchment calculations and pipeline pressure hydraulics.',
    scienceNote: 'Mathematical models incorporate exact engineering formulas including Clausius-Clapeyron vapor scaling and Van ’t Hoff osmotic pressure.',
  },
  {
    id: 'meet-aqua',
    number: 5,
    title: 'Meet AQUA AI Assistant',
    subtitle: 'Intelligent Voice & Natural Gesture Control',
    sceneTarget: 'aqua',
    summary: 'Demonstrates AQUA, the intelligent AI control center, alongside webcam hand-gesture navigation that directly commands the application state.',
    keyPoints: [
      'Natural language voice and text command processing.',
      'Hand landmark tracking for hands-free exhibition navigation.',
      'Context-aware explanations and direct 3D scene control.',
    ],
    narrationScript: 'Chapter Five: Meet AQUA. AQUA is our intelligent AI control center. Visitors can speak naturally or use webcam hand gestures to rotate the globe, adjust simulation parameters, and explore water science without touching a mouse.',
    scienceNote: 'Powered by multimodal AI reasoning and MediaPipe browser vision models.',
  },
  {
    id: 'save-the-city',
    number: 6,
    title: 'Save the City Mission',
    subtitle: 'Interactive Sustainability Challenge & Scoring',
    sceneTarget: 'mission',
    summary: 'An immersive 5-stage game where visitors become Water Sustainability Commanders, resolving droughts, leaks, and aquifer depletion to achieve high sustainability scores.',
    keyPoints: [
      'Five progressive mission stages with difficulty levels.',
      'Transparent scoring based on water saved and leaks repaired.',
      'Immediate feedback and scientific learning explanations.',
    ],
    narrationScript: 'Chapter Six: Save the City. Put knowledge into practice! In this interactive mission challenge, visitors take command of the city during water emergencies, repairing leaks, balancing aquifers, and earning achievement badges.',
    scienceNote: 'Gamified resource management promotes active learning and systemic problem solving.',
  },
  {
    id: 'conclusion',
    number: 7,
    title: 'Every Drop Counts',
    subtitle: 'Sustainable Future & Conclusion',
    sceneTarget: 'earth',
    summary: 'Concludes the presentation with an inspiring vision of global water resilience and an invitation for visitors to explore freely.',
    keyPoints: [
      'Sustainable water stewardship secures our collective future.',
      'Every individual action and smart city policy matters.',
      'Open invitation to explore the exhibition freely.',
    ],
    narrationScript: 'Conclusion: Every Drop Counts. Water is life. By combining scientific understanding, smart urban engineering, and responsible AI stewardship, we can protect our living planet. Thank you for exploring AquaGuard AI — The Living Planet.',
    scienceNote: 'Sustainable Development Goal 6: Clean water and sanitation for all.',
  },
];
