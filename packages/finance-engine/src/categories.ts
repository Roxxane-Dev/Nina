/**
 * Canonical category slugs and their es-PE labels.
 * Stored rows may use Spanish names ('comida') or slugs ('food'); the engine
 * always works with the canonical slug so totals never split across aliases.
 */
export const CATEGORY_LABELS_ES: Record<string, string> = {
  food: 'Comida',
  transport: 'Transporte',
  home: 'Hogar',
  services: 'Servicios',
  health: 'Salud',
  education: 'Educación',
  entertainment: 'Entretenimiento',
  shopping: 'Compras',
  subscriptions: 'Suscripciones',
  debt: 'Deudas',
  salary: 'Sueldo',
  freelance: 'Ingresos extra',
  other: 'Otros',
}

/** Words a user may write (or that older rows contain) → canonical slug. */
const ALIASES: Record<string, string[]> = {
  food: ['food', 'comida', 'comidas', 'almuerzo', 'almuerzos', 'cena', 'desayuno', 'restaurante', 'restaurantes', 'mercado', 'supermercado', 'delivery', 'cafe', 'café', 'snacks', 'menu', 'menú'],
  transport: ['transport', 'transporte', 'taxi', 'taxis', 'uber', 'cabify', 'didi', 'pasaje', 'pasajes', 'bus', 'combi', 'metro', 'gasolina', 'combustible', 'estacionamiento'],
  home: ['home', 'hogar', 'casa', 'alquiler', 'renta', 'hogar/renta'],
  services: ['services', 'servicios', 'luz', 'agua', 'internet', 'gas', 'telefono', 'teléfono', 'celular', 'cable'],
  health: ['health', 'salud', 'farmacia', 'medicinas', 'doctor', 'clinica', 'clínica', 'seguro'],
  education: ['education', 'educacion', 'educación', 'curso', 'cursos', 'universidad', 'colegio', 'libros'],
  entertainment: ['entertainment', 'entretenimiento', 'ocio', 'cine', 'salidas', 'fiesta', 'bar', 'juegos'],
  shopping: ['shopping', 'compras', 'ropa', 'zapatillas', 'tienda'],
  subscriptions: ['subscriptions', 'subscription', 'suscripciones', 'suscripcion', 'suscripción', 'netflix', 'spotify', 'streaming'],
  debt: ['debt', 'deuda', 'deudas', 'prestamo', 'préstamo', 'tarjeta', 'cuota', 'cuotas'],
  salary: ['salary', 'sueldo', 'salario', 'quincena', 'planilla'],
  freelance: ['freelance', 'extra', 'ingresos extra', 'cachuelo', 'honorarios'],
  other: ['other', 'otros', 'otro', 'varios'],
}

const ALIAS_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(ALIASES).flatMap(([slug, words]) => words.map((w) => [fold(w), slug])),
)

function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
}

/** Maps any stored category value to its canonical slug ('other' if unknown). */
export function normalizeCategorySlug(raw: string | null | undefined): string {
  if (!raw) return 'other'
  return ALIAS_TO_SLUG[fold(raw)] ?? 'other'
}

export function categoryLabel(slug: string): string {
  return CATEGORY_LABELS_ES[slug] ?? CATEGORY_LABELS_ES.other
}

/** Finds the first expense category mentioned in a free-text question. */
export function detectCategoryInText(message: string): string | null {
  const words = fold(message).split(/[^a-zñ]+/).filter(Boolean)
  for (const w of words) {
    const slug = ALIAS_TO_SLUG[w]
    if (slug && slug !== 'other' && slug !== 'salary' && slug !== 'freelance') return slug
  }
  return null
}
