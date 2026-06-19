// Default price book items seeded for every new manufacturer account.
// All material/hardware items are supplier_quoted=true — prices fluctuate; user fills them in.
// Labour items have cost_price=null so the user enters their own rates.

type SeedItem = {
  item_type: 'material' | 'hardware' | 'labour'
  category: string
  name: string
  unit: string
  supplier_quoted: boolean
  apply_markup_default: boolean
  notes: string | null
}

const sq = true   // supplier_quoted shorthand
const nsq = false

export const MFG_SEED_ITEMS: SeedItem[] = [

  // ── Veneers ──────────────────────────────────────────────────────────────────
  ...['White Oak', 'Red Oak', 'Walnut', 'Mahogany', 'Beechwood', 'Maple', 'Saligna'].map(s => ({
    item_type: 'material' as const, category: 'boards',
    name: `Veneer — ${s}`, unit: 'sheet',
    supplier_quoted: sq, apply_markup_default: true, notes: null,
  })),

  // ── Solid Timber ─────────────────────────────────────────────────────────────
  ...['White Oak', 'Red Oak', 'Walnut', 'Mahogany', 'Beechwood', 'Maple', 'Saligna'].flatMap(s =>
    ['25mm', '38mm', '50mm'].map(t => ({
      item_type: 'material' as const, category: 'solid_timber',
      name: `Solid ${s} ${t}`, unit: 'sqm',
      supplier_quoted: sq, apply_markup_default: true, notes: 'Price per m²',
    }))
  ),

  // ── Backing Panels ───────────────────────────────────────────────────────────
  ...['White Oak', 'Red Oak', 'Walnut', 'Mahogany', 'Beechwood', 'Maple', 'Saligna'].map(s => ({
    item_type: 'material' as const, category: 'boards',
    name: `Backing Panel — ${s}`, unit: 'sheet',
    supplier_quoted: sq, apply_markup_default: true, notes: null,
  })),

  // ── MDF Sheets ───────────────────────────────────────────────────────────────
  ...['9mm', '12mm', '16mm', '18mm', '22mm', '30mm'].map(t => ({
    item_type: 'material' as const, category: 'boards',
    name: `MDF Sheet ${t}`, unit: 'sheet',
    supplier_quoted: sq, apply_markup_default: true, notes: null,
  })),

  // ── Melamine Boards — Standard ───────────────────────────────────────────────
  ...['White', 'Ivory', 'Light Grey', 'Anthracite', 'Black', 'Wenge', 'Oak', 'Walnut', 'Cherry'].map(c => ({
    item_type: 'material' as const, category: 'boards',
    name: `Melamine — ${c} (Standard)`, unit: 'sheet',
    supplier_quoted: sq, apply_markup_default: true, notes: null,
  })),

  // ── Melamine Boards — Supamatt ───────────────────────────────────────────────
  ...['White', 'Anthracite', 'Black', 'Cashmere'].map(c => ({
    item_type: 'material' as const, category: 'boards',
    name: `Melamine — ${c} (Supamatt)`, unit: 'sheet',
    supplier_quoted: sq, apply_markup_default: true, notes: 'Premium board',
  })),

  // ── Acrylic / Imported Boards ────────────────────────────────────────────────
  { item_type: 'material', category: 'acrylic_specialty', name: 'Acrylic Board — White (Niemann)', unit: 'sheet', supplier_quoted: sq, apply_markup_default: true, notes: 'Cut & edged' },
  { item_type: 'material', category: 'acrylic_specialty', name: 'Acrylic Board — Black (Niemann)', unit: 'sheet', supplier_quoted: sq, apply_markup_default: true, notes: 'Cut & edged' },
  { item_type: 'material', category: 'acrylic_specialty', name: 'Acrylic Board — Custom Colour (Niemann)', unit: 'sheet', supplier_quoted: sq, apply_markup_default: true, notes: 'Cut & edged, price on application' },

  // ── Hinges ───────────────────────────────────────────────────────────────────
  ...['Blum', 'Grass', 'Raeil', 'Haefele', 'Fit'].map(b => ({
    item_type: 'hardware' as const, category: 'hinges_rails',
    name: `Hinge — ${b} Standard`, unit: 'piece',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['Blum', 'Grass', 'Raeil'].map(b => ({
    item_type: 'hardware' as const, category: 'hinges_rails',
    name: `Hinge — ${b} Soft-Close`, unit: 'piece',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),

  // ── Drawer Slides ────────────────────────────────────────────────────────────
  ...['400mm', '450mm', '500mm', '550mm', '600mm'].map(l => ({
    item_type: 'hardware' as const, category: 'hinges_rails',
    name: `Drawer Slide — Blum Soft-Close ${l}`, unit: 'piece',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['400mm', '450mm', '500mm', '550mm', '600mm'].map(l => ({
    item_type: 'hardware' as const, category: 'hinges_rails',
    name: `Drawer Slide — Blum Touch-to-Open ${l}`, unit: 'piece',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['500mm', '600mm'].map(l => ({
    item_type: 'hardware' as const, category: 'hinges_rails',
    name: `Drawer Slide — Blum Full Extension Ball Bearing ${l}`, unit: 'piece',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['Grass', 'Haefele', 'Furnlock'].map(b => ({
    item_type: 'hardware' as const, category: 'hinges_rails',
    name: `Drawer Slide — ${b} Soft-Close 500mm`, unit: 'piece',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),

  // ── Specialised Hardware ─────────────────────────────────────────────────────
  ...[
    'Pocket Door System', 'Pull-Out Bin', 'Pull-Out Basket',
    'Drawer Inner — Cutlery Tray', 'Spice Rack Pull-Out',
    'Lazy Susan', 'Magic Corner',
  ].map(n => ({
    item_type: 'hardware' as const, category: 'handles_fittings',
    name: n, unit: 'piece',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),

  // ── Glass ────────────────────────────────────────────────────────────────────
  ...['4mm', '5mm', '6mm', '8mm', '10mm', '12mm', '15mm', '19mm'].map(t => ({
    item_type: 'hardware' as const, category: 'glass_mirrors',
    name: `Glass ${t} — Clear, Polished`, unit: 'sqm',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['6mm', '8mm', '10mm', '12mm'].map(t => ({
    item_type: 'hardware' as const, category: 'glass_mirrors',
    name: `Glass ${t} — Toughened`, unit: 'sqm',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['6mm', '8mm'].map(t => ({
    item_type: 'hardware' as const, category: 'glass_mirrors',
    name: `Glass ${t} — Tinted`, unit: 'sqm',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['6mm', '8mm'].map(t => ({
    item_type: 'hardware' as const, category: 'glass_mirrors',
    name: `Glass ${t} — Tinted & Toughened`, unit: 'sqm',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),

  // ── Mirror ───────────────────────────────────────────────────────────────────
  ...['3mm', '4mm', '5mm', '6mm'].map(t => ({
    item_type: 'hardware' as const, category: 'glass_mirrors',
    name: `Mirror ${t} — Clear, Cut & Polished`, unit: 'sqm',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),
  ...['4mm', '6mm'].map(t => ({
    item_type: 'hardware' as const, category: 'glass_mirrors',
    name: `Mirror ${t} — Tinted, Cut & Polished`, unit: 'sqm',
    supplier_quoted: sq, apply_markup_default: false, notes: null,
  })),

  // ── Finishing & Coatings ─────────────────────────────────────────────────────
  { item_type: 'material', category: 'boards', name: 'Jax Oleum', unit: 'litre', supplier_quoted: sq, apply_markup_default: true, notes: null },
  { item_type: 'material', category: 'boards', name: 'Duco — Matt', unit: 'litre', supplier_quoted: sq, apply_markup_default: true, notes: null },
  { item_type: 'material', category: 'boards', name: 'Duco — Satin', unit: 'litre', supplier_quoted: sq, apply_markup_default: true, notes: null },
  { item_type: 'material', category: 'boards', name: 'Duco — Gloss', unit: 'litre', supplier_quoted: sq, apply_markup_default: true, notes: 'Higher labour surcharge — very labour intensive' },
  { item_type: 'material', category: 'boards', name: 'Thinners', unit: 'litre', supplier_quoted: sq, apply_markup_default: true, notes: null },
  { item_type: 'material', category: 'boards', name: 'Primer', unit: 'litre', supplier_quoted: sq, apply_markup_default: true, notes: null },
  { item_type: 'hardware', category: 'handles_fittings', name: 'Sandpaper — Cut Sheet (Swiss)', unit: 'piece', supplier_quoted: nsq, apply_markup_default: true, notes: null },

  // ── Labour ───────────────────────────────────────────────────────────────────
  { item_type: 'labour', category: 'labour_services', name: 'Client Meeting & Site Measuring', unit: 'hour', supplier_quoted: nsq, apply_markup_default: false, notes: 'Set your hourly rate in Settings → Quote Defaults' },
  { item_type: 'labour', category: 'labour_services', name: 'Design & Drawing Work', unit: 'hour', supplier_quoted: nsq, apply_markup_default: false, notes: null },
  { item_type: 'labour', category: 'labour_services', name: 'Installation — Standard', unit: 'hour', supplier_quoted: nsq, apply_markup_default: false, notes: null },
  { item_type: 'labour', category: 'labour_services', name: 'Installation — Gloss Finish Surcharge', unit: 'hour', supplier_quoted: nsq, apply_markup_default: false, notes: 'Gloss is highly labour intensive — charge at a higher rate' },
  { item_type: 'labour', category: 'labour_services', name: 'Transport & Diesel', unit: 'piece', supplier_quoted: nsq, apply_markup_default: false, notes: 'Per trip cost' },
  { item_type: 'labour', category: 'labour_services', name: 'Workshop Overhead Rate', unit: 'hour', supplier_quoted: nsq, apply_markup_default: false, notes: 'Set this in Settings → Quote Defaults to ensure overheads are recovered on every job' },

] as SeedItem[]
