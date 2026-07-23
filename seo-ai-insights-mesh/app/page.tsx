export default function Page() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px", fontFamily: "system-ui, sans-serif", color: "#3d3d3a", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>SEO &amp; AI Insights, Mesh integration</h1>
      <p>
        This app renders inside the Uniform dashboard as a Mesh integration. There is nothing to see at
        the root URL, open it from Uniform instead:
      </p>
      <ul>
        <li><strong>Settings</strong>: install the integration in a project, then open its settings.</li>
        <li><strong>Dashboard</strong>: find “SEO &amp; AI Insights” under the project’s Tools menu.</li>
      </ul>
      <p style={{ fontSize: 14, color: "#73726c" }}>
        Locations served by this app: <code>/settings</code> and <code>/seo-dashboard</code>.
      </p>
    </main>
  )
}
