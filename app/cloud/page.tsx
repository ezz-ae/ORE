import { Cloud, FileText, FolderKanban, ShieldCheck } from "lucide-react"
import { CommandShell } from "@/src/components/command/CommandShell"
import { MetricCard } from "@/src/components/command/MetricCard"
import { files } from "@/src/data/files"

export default function CloudPage() {
  return (
    <CommandShell>
      <div className="fh-page">
        <section>
          <p className="fh-eyebrow">Freehold Market Cloud</p>
          <h1 className="fh-title">Campaign files, payment plans, briefs, and owner intake records in one operating layer.</h1>
          <p className="fh-copy">Files are indexed for the operating workflow. External object storage is only shown after credentials and permissions are connected.</p>
        </section>
        <section className="fh-grid four">
          <MetricCard icon={FileText} label="Indexed Files" value={String(files.length)} note="Internal file records" />
          <MetricCard icon={FolderKanban} label="Ready for Campaign" value={String(files.filter((file) => file.status === "Ready for campaign").length)} note="Usable by Ads Studio" />
          <MetricCard icon={Cloud} label="Storage" value="Local Index" note="No fake production storage" />
          <MetricCard icon={ShieldCheck} label="Access" value="Controlled" note="Company roles and file governance" />
        </section>
        <section className="fh-panel">
          <div className="fh-panel-header">
            <div>
              <h2 className="fh-panel-title">Market File Index</h2>
              <p className="fh-panel-copy">Internal records only. No external storage is claimed.</p>
            </div>
          </div>
          <div className="fh-table-wrap">
            <table className="fh-table">
              <thead>
                <tr><th>File</th><th>Type</th><th>Owner</th><th>Status</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}><td>{file.fileName}</td><td>{file.type}</td><td>{file.owner}</td><td>{file.status}</td><td>{file.updatedAt}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </CommandShell>
  )
}
