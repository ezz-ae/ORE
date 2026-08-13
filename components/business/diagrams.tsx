/**
 * Diagrams for the business site.
 *
 * Each one has to earn its place by showing a MECHANISM the prose would need a
 * paragraph to describe — an order of operations, a feedback path, a boundary.
 * Nothing here is decorative. All are inline SVG so they stay sharp, scale to
 * the column, and carry real text (readable, selectable, and translatable).
 *
 * The site is dark-only, so fixed colours are safe.
 */

const INK = '#0C0E11'
const LINE = 'rgba(255,255,255,0.14)'
const TXT = '#E8EAED'
const DIM = '#8A9099'
const GOLD = '#D4AF37'

function Arrow({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,1 L9,5 L0,9" fill="none" stroke={LINE} strokeWidth="1.4" />
      </marker>
      <marker id={`${id}-gold`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0,1 L9,5 L0,9" fill="none" stroke={GOLD} strokeWidth="1.4" />
      </marker>
    </defs>
  )
}

/**
 * The core claim of the whole system, drawn: work moves left to right, and the
 * result of a closed deal is fed back into who the next campaign targets.
 * Without the return path this is five disconnected tools; with it, it is one
 * system that gets better with use.
 */
export function SystemLoop({ className = '' }: { className?: string }) {
  const nodes = [
    { t: 'Inventory', s: 'Projects, units,\nprices, media' },
    { t: 'Landing page', s: 'One page per\nproperty' },
    { t: 'Campaign', s: 'Meta and Google,\nbudget-capped' },
    { t: 'Lead', s: 'Owned, timed,\nanswered' },
    { t: 'Deal', s: 'Won or lost,\nwith a reason' },
  ]
  return (
    <figure className={className}>
      <svg viewBox="0 0 1000 300" className="w-full" role="img" aria-label="Inventory becomes a landing page, then a campaign, which produces a lead, which becomes a deal. Closed deals are fed back into campaign targeting.">
        <Arrow id="loop-a" />
        {nodes.map((n, i) => {
          const x = 20 + i * 194
          return (
            <g key={n.t}>
              <rect x={x} y={54} width={166} height={84} fill={INK} stroke={LINE} />
              <text x={x + 16} y={84} fill={TXT} fontSize="15" fontFamily="Inter, system-ui, sans-serif" fontWeight="600">
                {n.t}
              </text>
              {n.s.split('\n').map((line, j) => (
                <text key={j} x={x + 16} y={106 + j * 15} fill={DIM} fontSize="11.5" fontFamily="Inter, system-ui, sans-serif">
                  {line}
                </text>
              ))}
              {i < nodes.length - 1 ? (
                <line x1={x + 166} y1={96} x2={x + 190} y2={96} stroke={LINE} strokeWidth="1.4" markerEnd="url(#loop-a)" />
              ) : null}
            </g>
          )
        })}

        {/* The return path — the reason this is a system and not a toolchain. */}
        <path
          d="M 883 138 L 883 210 Q 883 226 867 226 L 424 226 Q 408 226 408 210 L 408 142"
          fill="none"
          stroke={GOLD}
          strokeWidth="1.4"
          strokeDasharray="4 4"
          markerEnd="url(#loop-a-gold)"
        />
        <text x={645} y={252} fill={GOLD} fontSize="12" fontFamily="ui-monospace, SFMono-Regular, monospace" textAnchor="middle">
          closed deals rebuild who the next campaign targets
        </text>
      </svg>
    </figure>
  )
}

/**
 * Where a decision is allowed to be made. The point of the drawing is the
 * middle column: nothing reaches an ad account without passing a rule a person
 * wrote, and every outcome is written down.
 */
export function SpendAuthority({ className = '' }: { className?: string }) {
  return (
    <figure className={className}>
      <svg viewBox="0 0 1000 300" className="w-full" role="img" aria-label="A proposed budget change passes through the spend authority engine, which checks admin rules and returns approved, capped, or blocked. Every outcome is logged.">
        <Arrow id="spend-a" />

        <rect x={20} y={100} width={230} height={90} fill={INK} stroke={LINE} />
        <text x={38} y={130} fill={TXT} fontSize="15" fontFamily="Inter, system-ui, sans-serif" fontWeight="600">Proposal</text>
        <text x={38} y={152} fill={DIM} fontSize="11.5" fontFamily="Inter, system-ui, sans-serif">A person or the autopilot</text>
        <text x={38} y={168} fill={DIM} fontSize="11.5" fontFamily="Inter, system-ui, sans-serif">asks to move money.</text>

        <line x1={250} y1={145} x2={302} y2={145} stroke={LINE} strokeWidth="1.4" markerEnd="url(#spend-a)" />

        <rect x={310} y={70} width={250} height={150} fill={INK} stroke={GOLD} />
        <text x={330} y={100} fill={GOLD} fontSize="11" fontFamily="ui-monospace, SFMono-Regular, monospace" letterSpacing="1.4">RULES YOU WROTE</text>
        <text x={330} y={128} fill={TXT} fontSize="13" fontFamily="Inter, system-ui, sans-serif">Maximum per day</text>
        <text x={330} y={150} fill={TXT} fontSize="13" fontFamily="Inter, system-ui, sans-serif">Maximum per single move</text>
        <text x={330} y={172} fill={TXT} fontSize="13" fontFamily="Inter, system-ui, sans-serif">Minimum quality floor</text>
        <text x={330} y={200} fill={DIM} fontSize="11.5" fontFamily="Inter, system-ui, sans-serif">No rule written = nothing spends.</text>

        <line x1={560} y1={145} x2={612} y2={145} stroke={LINE} strokeWidth="1.4" markerEnd="url(#spend-a)" />

        {[
          { y: 62, t: 'Approved', s: 'Inside every limit.' },
          { y: 130, t: 'Capped', s: 'Reduced to the limit.' },
          { y: 198, t: 'Blocked', s: 'Refused, with the reason.' },
        ].map((o) => (
          <g key={o.t}>
            <rect x={620} y={o.y} width={230} height={56} fill={INK} stroke={LINE} />
            <text x={638} y={o.y + 24} fill={TXT} fontSize="13.5" fontFamily="Inter, system-ui, sans-serif" fontWeight="600">{o.t}</text>
            <text x={638} y={o.y + 42} fill={DIM} fontSize="11.5" fontFamily="Inter, system-ui, sans-serif">{o.s}</text>
          </g>
        ))}

        <path d="M 850 90 L 900 90 L 900 226 L 640 226" fill="none" stroke={LINE} strokeWidth="1.2" />
        <path d="M 850 158 L 900 158" fill="none" stroke={LINE} strokeWidth="1.2" />
        <path d="M 850 226 L 900 226" fill="none" stroke={LINE} strokeWidth="1.2" />
        <text x={636} y={252} fill={DIM} fontSize="11.5" fontFamily="ui-monospace, SFMono-Regular, monospace" textAnchor="start">
          every outcome written to Finance, in plain language
        </text>
      </svg>
    </figure>
  )
}

/**
 * Tenant isolation, drawn at the level a buyer actually asks about: "is my
 * data in the same place as another company's?"
 */
export function TenantIsolation({ className = '' }: { className?: string }) {
  return (
    <figure className={className}>
      <svg viewBox="0 0 1000 280" className="w-full" role="img" aria-label="Each company's address resolves to its own separate database schema. A shared read-only market catalogue sits underneath, available to all.">
        <Arrow id="iso-a" />
        {[
          { x: 20, host: 'alpha.entrestate.com', db: 'Alpha’s data' },
          { x: 350, host: 'beta.entrestate.com', db: 'Beta’s data' },
          { x: 680, host: 'gamma.entrestate.com', db: 'Gamma’s data' },
        ].map((c) => (
          <g key={c.host}>
            <rect x={c.x} y={20} width={300} height={46} fill={INK} stroke={LINE} />
            <text x={c.x + 18} y={48} fill={TXT} fontSize="13" fontFamily="ui-monospace, SFMono-Regular, monospace">{c.host}</text>
            <line x1={c.x + 150} y1={66} x2={c.x + 150} y2={96} stroke={LINE} strokeWidth="1.4" markerEnd="url(#iso-a)" />
            <rect x={c.x} y={100} width={300} height={62} fill={INK} stroke={LINE} />
            <text x={c.x + 18} y={126} fill={TXT} fontSize="13.5" fontFamily="Inter, system-ui, sans-serif" fontWeight="600">{c.db}</text>
            <text x={c.x + 18} y={146} fill={DIM} fontSize="11.5" fontFamily="Inter, system-ui, sans-serif">Separate schema. Own users, leads, deals.</text>
          </g>
        ))}
        <text x={500} y={192} fill={DIM} fontSize="11.5" fontFamily="ui-monospace, SFMono-Regular, monospace" textAnchor="middle">
          a query on one address cannot name a table in another
        </text>
        <rect x={20} y={210} width={960} height={54} fill={INK} stroke={GOLD} strokeDasharray="4 4" />
        <text x={38} y={234} fill={GOLD} fontSize="11" fontFamily="ui-monospace, SFMono-Regular, monospace" letterSpacing="1.4">SHARED, READ-ONLY</text>
        <text x={38} y={253} fill={DIM} fontSize="12" fontFamily="Inter, system-ui, sans-serif">
          Market reference: projects, areas, developers, transaction history. The same facts for everyone; nobody can write to it.
        </text>
      </svg>
    </figure>
  )
}
