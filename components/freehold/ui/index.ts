/**
 * Freehold Intelligence — product UI primitives.
 *
 * The shared building blocks every workspace page composes from, so screens
 * stay on one rhythm, scale and palette. All read from the design tokens in
 * globals.css (surface, line, gold, …) and are therefore re-skinnable.
 */
export { PageHeader } from './page-header'
export { StatCard, type StatDelta } from './stat-card'
export { EmptyState } from './empty-state'
export { Section } from './section'
export { Panel, PanelHeader } from './panel'
export { StatusPill, type StatusTone } from './status-pill'
export { Button, buttonClass, type ButtonVariant, type ButtonSize } from './button'
