export type FieldType = 'text' | 'number' | 'select' | 'textarea'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  unit?: string
  placeholder?: string
}

export const CATEGORIES = [
  { key: 'general',    label: 'General' },
  { key: 'furniture',  label: 'Furniture' },
  { key: 'woodwork',   label: 'Woodwork' },
  { key: 'stone_glass', label: 'Stone & Glass' },
  { key: 'lighting',   label: 'Lighting' },
  { key: 'flooring',   label: 'Flooring' },
] as const

export type CategoryKey = typeof CATEGORIES[number]['key']

export const CATEGORY_FIELDS: Record<CategoryKey, FieldDef[]> = {
  general: [],
  furniture: [
    { key: 'overall_width',   label: 'Overall Width',           type: 'number', unit: 'mm' },
    { key: 'overall_height',  label: 'Overall Height',          type: 'number', unit: 'mm' },
    { key: 'overall_depth',   label: 'Overall Depth',           type: 'number', unit: 'mm' },
    { key: 'seat_width',      label: 'Seat Width',              type: 'number', unit: 'mm' },
    { key: 'seat_depth',      label: 'Seat Depth',              type: 'number', unit: 'mm' },
    { key: 'seat_height',     label: 'Seat Height',             type: 'number', unit: 'mm' },
    { key: 'leg_height',      label: 'Leg Height',              type: 'number', unit: 'mm' },
    { key: 'leg_thickness',   label: 'Leg Thickness',           type: 'number', unit: 'mm' },
    { key: 'arm_height',      label: 'Arm Height',              type: 'number', unit: 'mm' },
    { key: 'arm_thickness',   label: 'Arm Thickness',           type: 'number', unit: 'mm' },
    { key: 'back_height',     label: 'Back Height',             type: 'number', unit: 'mm' },
    { key: 'back_thickness',  label: 'Back Thickness',          type: 'number', unit: 'mm' },
    { key: 'wood_type',       label: 'Wood Type (legs / plinth)', type: 'text', placeholder: 'e.g. White Oak, Walnut' },
    { key: 'colour_stain',    label: 'Colour / Stain',          type: 'text',   placeholder: 'e.g. Natural, Ebony stain' },
    { key: 'back_cushion',    label: 'Back Cushion Details',    type: 'textarea', placeholder: 'Foam density, fill, cover fabric...' },
    { key: 'scatter_cushion', label: 'Scatter Cushion Details', type: 'textarea', placeholder: 'Size, fill, quantity...' },
  ],
  woodwork: [
    { key: 'wood_type',       label: 'Wood Type',               type: 'text',   placeholder: 'e.g. MDF, Birch Ply, Solid Oak' },
    { key: 'grain',           label: 'Grain',                   type: 'select', options: ['Straight', 'Knots', 'Any'] },
    { key: 'handle_type',     label: 'Handle / Opening',        type: 'select', options: ['Handle', 'Grip', 'Push to open', 'None'] },
    { key: 'internal_shelves', label: 'Internal Shelves',       type: 'text',   placeholder: 'e.g. 3 adjustable' },
    { key: 'led_lights',      label: 'LED Lights',              type: 'select', options: ['Yes', 'No'] },
    { key: 'stone_top',       label: 'Stone Top',               type: 'select', options: ['Yes', 'No'] },
    { key: 'stone_thickness', label: 'Stone Thickness',         type: 'number', unit: 'mm' },
    { key: 'drawer_height',   label: 'Drawer Height',           type: 'number', unit: 'mm' },
    { key: 'equipment_space', label: 'Equipment Space',         type: 'select', options: ['Yes', 'No'] },
    { key: 'equipment_size',  label: 'Equipment Size',          type: 'text',   placeholder: 'e.g. 65" TV, AV receiver' },
  ],
  stone_glass: [
    { key: 'stone_name',      label: 'Stone / Glass Name',      type: 'text',   placeholder: 'e.g. Calacatta Gold, Starphire' },
    { key: 'width',           label: 'Width',                   type: 'number', unit: 'mm' },
    { key: 'height',          label: 'Height',                  type: 'number', unit: 'mm' },
    { key: 'length',          label: 'Length',                  type: 'number', unit: 'mm' },
    { key: 'thickness',       label: 'Thickness',               type: 'number', unit: 'mm' },
    { key: 'match_type',      label: 'Match Type',              type: 'select', options: ['Bookmatch', 'Vein match', 'Random', 'N/A'] },
    { key: 'finish',          label: 'Finish',                  type: 'text',   placeholder: 'e.g. Honed, Polished, Brushed' },
  ],
  lighting: [
    { key: 'fitting_type',    label: 'Fitting Type',            type: 'select', options: ['Pendant', 'Chandelier', 'Wall sconce', 'Floor lamp', 'Table lamp', 'Recessed', 'Track', 'Strip', 'Other'] },
    { key: 'installation',    label: 'Installation',            type: 'select', options: ['Surface', 'Suspended', 'Recessed', 'Freestanding'] },
    { key: 'finish',          label: 'Finish / Colour',         type: 'text',   placeholder: 'e.g. Brushed brass, Matt black' },
    { key: 'height',          label: 'Height',                  type: 'number', unit: 'mm' },
    { key: 'diameter',        label: 'Diameter / Width',        type: 'number', unit: 'mm' },
    { key: 'cable_length',    label: 'Cable / Drop',            type: 'number', unit: 'mm' },
    { key: 'voltage',         label: 'Voltage',                 type: 'select', options: ['220V', '12V', '24V'] },
    { key: 'ip_rating',       label: 'IP Rating',               type: 'text',   placeholder: 'e.g. IP44, IP65' },
    { key: 'dimmable',        label: 'Dimmable',                type: 'select', options: ['Yes', 'No'] },
    { key: 'bulb_type',       label: 'Bulb Type',               type: 'text',   placeholder: 'e.g. GU10, E27, LED strip' },
  ],
  flooring: [
    { key: 'material',        label: 'Material',                type: 'select', options: ['Timber', 'Engineered timber', 'Tile', 'Stone', 'Vinyl', 'Carpet', 'Concrete', 'Other'] },
    { key: 'board_width',     label: 'Board / Tile Width',      type: 'number', unit: 'mm' },
    { key: 'board_length',    label: 'Board / Tile Length',     type: 'number', unit: 'mm' },
    { key: 'thickness',       label: 'Thickness',               type: 'number', unit: 'mm' },
    { key: 'finish',          label: 'Finish',                  type: 'text',   placeholder: 'e.g. Matt lacquer, Oiled, Polished' },
    { key: 'pattern',         label: 'Lay Pattern',             type: 'text',   placeholder: 'e.g. Herringbone, Straight, Diagonal' },
    { key: 'area',            label: 'Area',                    type: 'number', unit: 'm²' },
    { key: 'underlay',        label: 'Underlay Required',       type: 'select', options: ['Yes', 'No'] },
    { key: 'installation',    label: 'Installation Method',     type: 'text',   placeholder: 'e.g. Glue down, Floating, Nail down' },
  ],
}
