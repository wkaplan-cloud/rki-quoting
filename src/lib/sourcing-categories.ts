export type FieldType = 'text' | 'number' | 'select' | 'textarea'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  options?: string[]
  unit?: string
}

export const CATEGORIES = [
  { key: 'general',       label: 'General' },
  { key: 'furniture',     label: 'Furniture' },
  { key: 'woodwork',      label: 'Woodwork' },
  { key: 'stone_glass',   label: 'Stone & Glass' },
  { key: 'lighting',      label: 'Lighting' },
  { key: 'flooring',      label: 'Flooring' },
  { key: 'wall_finishes', label: 'Wall Finishes' },
  { key: 'cushions',      label: 'Cushions' },
  { key: 'accessories',   label: 'Accessories' },
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
    { key: 'wood_type',       label: 'Wood Type (legs / plinth)', type: 'text' },
    { key: 'colour_stain',    label: 'Colour / Stain',          type: 'text' },
    { key: 'back_cushion',    label: 'Back Cushion Details',    type: 'textarea' },
    { key: 'scatter_cushion', label: 'Scatter Cushion Details', type: 'textarea' },
  ],
  woodwork: [
    { key: 'overall_width',  label: 'Overall Width',            type: 'number', unit: 'mm' },
    { key: 'overall_height', label: 'Overall Height',           type: 'number', unit: 'mm' },
    { key: 'overall_depth',  label: 'Overall Depth',            type: 'number', unit: 'mm' },
    { key: 'wood_type',       label: 'Wood Type',               type: 'text' },
    { key: 'grain',           label: 'Grain',                   type: 'select', options: ['Straight', 'Knots', 'Any'] },
    { key: 'handle_type',     label: 'Handle / Opening',        type: 'select', options: ['Handle', 'Grip', 'Push to open', 'None'] },
    { key: 'internal_shelves', label: 'Internal Shelves',       type: 'text' },
    { key: 'led_lights',      label: 'LED Lights',              type: 'select', options: ['Yes', 'No'] },
    { key: 'stone_top',       label: 'Stone Top',               type: 'select', options: ['Yes', 'No'] },
    { key: 'stone_thickness', label: 'Stone Thickness',         type: 'number', unit: 'mm' },
    { key: 'drawer_height',   label: 'Drawer Height',           type: 'number', unit: 'mm' },
    { key: 'equipment_space', label: 'Equipment Space',         type: 'select', options: ['Yes', 'No'] },
    { key: 'equipment_size',  label: 'Equipment Size',          type: 'text' },
  ],
  stone_glass: [
    { key: 'stone_name',      label: 'Stone / Glass Name',      type: 'text' },
    { key: 'width',           label: 'Width',                   type: 'number', unit: 'mm' },
    { key: 'height',          label: 'Height',                  type: 'number', unit: 'mm' },
    { key: 'length',          label: 'Length',                  type: 'number', unit: 'mm' },
    { key: 'thickness',       label: 'Thickness',               type: 'number', unit: 'mm' },
    { key: 'match_type',      label: 'Match Type',              type: 'select', options: ['Bookmatch', 'Vein match', 'Random', 'N/A'] },
    { key: 'finish',          label: 'Finish',                  type: 'text' },
  ],
  lighting: [
    { key: 'fitting_type',    label: 'Fitting Type',            type: 'select', options: ['Pendant', 'Chandelier', 'Wall sconce', 'Floor lamp', 'Table lamp', 'Recessed', 'Track', 'Strip', 'Other'] },
    { key: 'installation',    label: 'Installation',            type: 'select', options: ['Surface', 'Suspended', 'Recessed', 'Freestanding'] },
    { key: 'finish',          label: 'Finish / Colour',         type: 'text' },
    { key: 'height',          label: 'Height',                  type: 'number', unit: 'mm' },
    { key: 'diameter',        label: 'Diameter / Width',        type: 'number', unit: 'mm' },
    { key: 'cable_length',    label: 'Cable / Drop',            type: 'number', unit: 'mm' },
    { key: 'voltage',         label: 'Voltage',                 type: 'select', options: ['220V', '12V', '24V'] },
    { key: 'ip_rating',       label: 'IP Rating',               type: 'text' },
    { key: 'dimmable',        label: 'Dimmable',                type: 'select', options: ['Yes', 'No'] },
    { key: 'bulb_type',       label: 'Bulb Type',               type: 'text' },
  ],
  flooring: [
    { key: 'material',        label: 'Material',                type: 'select', options: ['Timber', 'Engineered timber', 'Tile', 'Stone', 'Vinyl', 'Carpet', 'Concrete', 'Other'] },
    { key: 'board_width',     label: 'Board / Tile Width',      type: 'number', unit: 'mm' },
    { key: 'board_length',    label: 'Board / Tile Length',     type: 'number', unit: 'mm' },
    { key: 'thickness',       label: 'Thickness',               type: 'number', unit: 'mm' },
    { key: 'finish',          label: 'Finish',                  type: 'text' },
    { key: 'pattern',         label: 'Lay Pattern',             type: 'text' },
    { key: 'area',            label: 'Area',                    type: 'number', unit: 'm²' },
    { key: 'underlay',        label: 'Underlay Required',       type: 'select', options: ['Yes', 'No'] },
    { key: 'installation',    label: 'Installation Method',     type: 'text' },
  ],
  wall_finishes: [
    { key: 'material',        label: 'Material',                type: 'select', options: ['Paint', 'Wallpaper', 'Panelling', 'Tile', 'Stone', 'Plaster', 'Fabric', 'Other'] },
    { key: 'colour_pattern',  label: 'Colour / Pattern',        type: 'text' },
    { key: 'finish',          label: 'Finish',                  type: 'text' },
    { key: 'width',           label: 'Panel / Tile Width',      type: 'number', unit: 'mm' },
    { key: 'height',          label: 'Panel / Tile Height',     type: 'number', unit: 'mm' },
    { key: 'area',            label: 'Total Area',              type: 'number', unit: 'm²' },
    { key: 'notes',           label: 'Additional Notes',        type: 'textarea' },
  ],
  cushions: [
    { key: 'width',           label: 'Width',                   type: 'number', unit: 'mm' },
    { key: 'height',          label: 'Height',                  type: 'number', unit: 'mm' },
    { key: 'depth',           label: 'Depth / Thickness',       type: 'number', unit: 'mm' },
    { key: 'fill',            label: 'Fill',                    type: 'select', options: ['Feather', 'Duck down', 'Foam', 'Fibre', 'Mixed', 'Other'] },
    { key: 'cover_fabric',    label: 'Cover Fabric',            type: 'text' },
    { key: 'colour',          label: 'Colour',                  type: 'text' },
    { key: 'piping',          label: 'Piping / Trim',           type: 'select', options: ['None', 'Self-piped', 'Contrast piped', 'Flange', 'Other'] },
  ],
  accessories: [
    { key: 'type',            label: 'Type',                    type: 'text' },
    { key: 'material',        label: 'Material',                type: 'text' },
    { key: 'width',           label: 'Width',                   type: 'number', unit: 'mm' },
    { key: 'height',          label: 'Height',                  type: 'number', unit: 'mm' },
    { key: 'depth',           label: 'Depth',                   type: 'number', unit: 'mm' },
    { key: 'colour_finish',   label: 'Colour / Finish',         type: 'text' },
    { key: 'notes',           label: 'Additional Notes',        type: 'textarea' },
  ],
}

// True when a category already asks for its own sizes (Overall Width, Diameter,
// Board Length, Thickness…). The spec panel suppresses its generic
// Width/Depth/Height block for these, so a designer is never asked for the same
// measurement twice — and a supplier never receives two competing sets.
export function categoryCoversDimensions(key: string): boolean {
  const fields = CATEGORY_FIELDS[key as CategoryKey]
  return !!fields?.some(f => f.unit === 'mm')
}
