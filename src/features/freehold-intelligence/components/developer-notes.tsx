export function DeveloperNotes({ title, notes }: { title: string; notes: string[] }) {
  return (
    <details className="mt-6 rounded-2xl border border-dashed border-[#D4AF37]/30 bg-[#D4AF37]/5 p-4 text-sm text-white/70">
      <summary className="cursor-pointer font-medium text-[#D4AF37]">Developer execution notes · {title}</summary>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        {notes.map((note) => <li key={note}>{note}</li>)}
      </ul>
    </details>
  )
}
