# Product Requirements Document (PRD)

Working title: Automation Workflow Observability (provider-agnostic)

Summary
- Build a provider-agnostic web application that gives users visibility into their automation workflows: overview of running workflows, flowchart visualization, execution status, endpoint uptime checks, and instance health. 
- MVP focuses on n8n (self-hosted or cloud) while designing an adapter pattern to support additional platforms later (Zapier, Make.com).

1. Problem Statement
Teams running automations across tools lack a single, actionable view to monitor reliability, debug failures, and understand performance. Each platform exposes partial data with differing models. Users need one place to see workflow health, investigate issues, and confirm endpoints and instances are healthy.

2. Goals (Objectives)
- Provide a unified, easy-to-understand view of automation health across providers.
- Reduce time to detect and resolve failed runs (MTTD/MTTR).
- Offer drill-down from aggregate metrics to per-execution detail.
- Visualize workflow structure (flowchart) to understand where issues occur.
- Check external endpoints and platform instance health from the same UI.

3. Non-Goals (for MVP)
- Full workflow editing/authoring or deployment.
- General-purpose BI/ELT data warehousing.
- Multi-tenant organization/RBAC beyond basic access control.
- Complex alerting/notifications (stretch for post-MVP).

4. Target Users and Personas

**Primary (MVP Focus):**
- **Automation Ops Engineer** (self-hosted n8n or mixed stack): Maintains critical automations; needs reliability monitoring, quick failure triage, and visual debugging through flowcharts.
- **Maker/Developer** (project owner, smaller teams): Owns several workflows; wants quick insight, step-level debugging, and performance tracking without enterprise complexity.

**Secondary (Post-MVP):**
- **Team Lead/Stakeholder**: Monitors uptime, success rate, SLA adherence, and needs executive dashboard views.
- **Multi-Platform Teams**: Users running n8n + Zapier + Make who need unified observability.

**User Type Adaptability** (inspired by competitive analysis):
- **Developer Mode**: Console-style logs, JSON viewers, technical details (Pipedream pattern)
- **Operations Mode**: Timeline views, incident correlation, audit trails (Tines pattern)
- **Executive Mode**: Summary cards, trend indicators, governance dashboards (Workato/Tray pattern)

5. Key Use Cases and User Journeys
- Monitor health: View success rate, failures, durations across time; filter by provider, workflow, status, time range.
- Debug failures: Find failed executions; inspect metadata and errors; identify problematic step/node in the flowchart.
- Validate endpoints: Periodically check key HTTP endpoints that workflows depend on; see uptime/latency.
- Instance health: Confirm platform instance connectivity and status (e.g., n8n self-hosted), including auth validity and version info.

6. Scope
6.1 MVP
- One provider adapter (n8n) behind a provider-agnostic domain model.
- Dashboard: Total executions, success rate, failed executions for a selectable time range.
- Executions: List/filter by status, workflow, time range; open execution details.
- Workflows: List workflows; show per-workflow stats snapshot; open flowchart view.
- Flowchart Viewer: Render workflow graph; highlight failed step if available from the provider.
- Endpoint Monitoring: Configure a small set of HTTP endpoint checks; record status/latency; display uptime summary.
- Instance Status: Connectivity check, auth validity, basic metadata (version, latency) for the active provider instance.
- Settings: Configure provider connection(s) securely; manage endpoint checks.
- Demo Mode: Support a demo dataset or read-only demo connection (e.g., n8n-demo) to explore features without real credentials.

6.2 Post-MVP (Future)
- Additional provider adapters (Zapier, Make.com).
- Trend charts (time-series) and duration percentiles (P95/P99) per workflow.
- Advanced query builder (Workato-inspired no-code analytics).
- Timeline execution views (Tines-inspired chronological display).
- Real-time streaming logs (Pipedream-inspired live monitoring).
- Multi-environment/workspace support (Tray.io-inspired isolation).
- Alerting/notifications (email/Slack) on failures or endpoint downtime.
- Export capabilities (CSV/JSON) for executions.
- Advanced filters (tags, labels), saved views, and cross-execution correlation.
- Role-based access control and team collaboration features.

6.3 Competitive Differentiation (Key Market Advantages)
- **Provider-Agnostic Architecture**: Unlike vendor-specific solutions, supports multiple platforms through unified adapters.
- **Visual Workflow Debugging**: Flowchart-based failure analysis not available in existing tools.
- **Integrated Infrastructure Monitoring**: Built-in endpoint checks + workflow observability in one tool.
- **Flexible User Experience**: Adaptable interface supporting developer, ops, and executive personas.
- **Self-Hosted + Cloud Ready**: Deployment flexibility not offered by SaaS-only competitors.

7. Functional Requirements
7.1 Provider Connectors (Adapter Interface)
- Authenticate: Manage credentials securely; validate connectivity.
- List Workflows: id, name, active, updatedAt (mapped to a common schema).
- Get Workflow Graph: Return a graph representation (nodes, edges, metadata) mapped to a common graph schema.
- List Executions: Pagination/cursor support; filter by workflow and status; return unified execution fields.
- Get Execution Detail: Metadata; provider-specific status and error info; timestamps; optional step-level results if available.
- Instance Health: Connectivity probe; latency; version; provider-specific health info.

7.2 Dashboard
**MVP Features:**
- **Executive Summary Cards** (industry standard): Total Executions, Success Rate, Failed Executions within a selected time range (24h, 7d, 30d).
- **Time Range Selector**: Quick filters with custom date picker option.
- **Quick Actions**: Direct links to Failed Executions, Critical Workflows, and Endpoint Status.
- **Instance Health Indicator**: Connection status and basic metadata display.

**UI Adaptability** (competitive advantage):
- **Default View**: Balanced interface suitable for ops engineers and makers.
- **Developer Mode Toggle**: Console-style logs, technical metrics, JSON data inspection.
- **Executive Mode Toggle**: High-level summaries, trend indicators, governance focus.

**Post-MVP Enhancements:**
- Simple trend indicators and sparkline charts.
- Customizable card layouts and saved dashboard views.

7.3 Executions
- Table with columns: status, startedAt, stoppedAt, workflowName, duration, provider.
- Filters: provider (default active), workflow, status, time range.
- Details view: key metadata and error synopsis; link to associated workflow and highlight node on flowchart if possible.

7.4 Workflows
- List of workflows with activity indicators (executions in range, failure count, success rate).
- Workflow detail: snapshot metrics, link to executions list filtered by workflow, View Flowchart.

7.5 Flowchart Viewer (Key Differentiator)
**Core Features:**
- **Provider-Agnostic Graph Rendering**: Unified visualization across n8n, Zapier, Make using standardized node/edge schema.
- **Failure Highlighting**: Visual indicators for failed nodes with error annotations and step-level context.
- **Interactive Node Inspection**: Click to view step properties, execution data, error messages, and timing information.
- **Execution Context Overlay**: Show execution path, data flow, and bottleneck identification.

**Advanced Features (Competitive Edge):**
- **Multi-Execution Comparison**: Overlay multiple execution paths to identify failure patterns.
- **Performance Visualization**: Node-level timing and performance metrics display.
- **Error Drill-Down**: Direct navigation from failed node to execution details and logs.

**Technical Requirements:**
- Support for different provider graph structures (DAG, sequential, conditional flows).
- Responsive layout that works on different screen sizes.
- Export capabilities (PNG, PDF) for documentation and incident reports.

7.6 Endpoint Monitoring
- Configuration: Add endpoints (name, URL, method, headers, interval, timeout, expected status range).
- Checks: Perform periodic HTTP requests from the server; store recent results in memory or lightweight storage.
- Display: Uptime percentage over selected period, last latency, last error reason.
- Manual recheck button.

7.7 Instance Status
- Connection probe to active provider instance (e.g., n8n base URL).
- Show version (if provided by API), auth validity, and round-trip latency.
- Basic guidance if misconfigured.

7.8 Settings
- Provider connections: Securely store credentials (server-only environment or secret store).
- Endpoint monitors: Create, edit, delete checks; enable/disable.
- Demo mode: Toggle to use demo data or demo instance if available.

8. Data Model (Provider-Agnostic)
- Provider: { id, type: "n8n" | "zapier" | "make", displayName }
- Workflow: { id, providerId, name, active, createdAt?, updatedAt? }
- Execution: { id, providerId, workflowId, status: success|failed|error|canceled|running|waiting, startedAt, stoppedAt?, durationMs?, errorMessage? }
- Graph: { nodes: [{ id, label, type, meta }], edges: [{ from, to, label?, meta }] }
- EndpointCheck: { id, name, url, method, headers?, intervalSec, timeoutMs, expectedStatus: [min,max] }
- EndpointResult: { checkId, timestamp, statusCode, latencyMs, ok, error? }

9. Integration Notes (Initial: n8n)
- API base: configurable (N8N_HOST). Auth via API key (X-N8N-API-KEY).
- Endpoints typically used: /api/v1/executions, /api/v1/workflows, and any available workflow read/graph endpoint.
- Map provider fields to domain model. Use server-side proxy routes to avoid exposing secrets to the browser.
- Zapier/Make (future): Define connectors that map their data structures (Zaps/Steps; Scenarios/Modules) into the same domain shape.

10. Non-Functional Requirements
- Security: Secrets never sent to the browser; stored server-side. Do not log secrets.
- Privacy: No telemetry by default; if enabled, aggregate only non-sensitive usage metrics with opt-out.
- Performance: Initial dashboard load under 2s with typical data; table pagination for large result sets.
- Reliability: Endpoint checks resilient to transient failures; backoff and timeouts.
- Accessibility: Keyboard navigation and basic ARIA for tables, dialogs, and the flowchart viewer.
- Browser support: Latest two versions of major browsers.

11. Telemetry and Analytics (Optional, opt-in)
- Track feature usage (view dashboard, open execution, render flowchart, add endpoint check) without storing sensitive payloads.
- Error tracking on the client and server with PII safe-guards.

12. Risks and Mitigations
- CORS and secret exposure: Always proxy provider API via server; never call with API key from client.
- Provider API variability: Encapsulate in adapters; version guard and capability flags.
- Data completeness: Some providers may not expose detailed node-level errors; surface gracefully.
- Rate limits: Respect provider limits; use pagination and intervals; document constraints.

13. Release Plan
- v0.1 (MVP): n8n adapter, Dashboard counters, Executions list+detail, Workflows list, Flowchart viewer (basic), Endpoint checks (basic), Instance status, Settings, Demo mode.
- v0.2 (Beta): Trend charts, duration percentiles, workflow detail metrics, improved flowchart annotations, CSV export.
- v1.0: Alerting, saved views, multi-provider support (Zapier, Make), improved a11y, team features.

14. Acceptance Criteria (MVP)
- With valid provider credentials, dashboard counters match provider data for selected time ranges.
- Executions page filters work; opening a failed execution shows error synopsis.
- Flowchart viewer renders and can highlight a failed node when data is available.
- Endpoint monitors can be created, run, and display uptime/latency summaries.
- Instance status shows connectivity and basic metadata; misconfiguration surfaces clear guidance.
- No provider secrets are exposed in client requests or logs.

15. Market Position and Competitive Landscape

**Direct Competitors (Provider-Specific Solutions):**
- Native platform analytics (n8n Cloud, Zapier insights, Make.com reports)
- Enterprise iPaaS monitoring (Workato Insights, Tray.io dashboards)
- Security automation platforms (Tines case management)

**Indirect Competitors (General Observability):**
- APM tools (Datadog, New Relic) with custom dashboards
- Log aggregation (ELK, Grafana) with manual setup
- Custom Prometheus + Grafana monitoring stacks

**Market Gaps We Address:**
1. **Cross-Platform Visibility**: No existing tool provides unified observability across n8n, Zapier, and Make.
2. **Visual Workflow Debugging**: Flowchart-based failure analysis is missing from current solutions.
3. **Integrated Infrastructure**: Combining endpoint monitoring with workflow observability.
4. **Self-Hosted Option**: Many enterprise teams prefer on-premises deployment.

**Competitive Advantages:**
- Provider-agnostic architecture from day one
- Visual debugging through flowcharts (unique differentiator)
- Integrated endpoint monitoring (not available elsewhere)
- Flexible deployment (self-hosted + cloud)
- Adaptable UI for different user personas

16. Open Questions
- Primary deployment targets (self-hosted vs. Vercel) and secret management approach for production.
- Do we need to support multiple provider instances concurrently in MVP?
- Preferred branding and final product name.
- Scope of demo mode: synthetic data only or shared read-only demo instance (e.g., n8n-demo)?
- Should we include workspace/environment isolation in MVP for enterprise appeal?
- What level of real-time capabilities should be included in MVP vs. post-MVP?

16. Glossary
- Provider: An automation platform (e.g., n8n, Zapier, Make.com).
- Adapter: Implementation that maps provider APIs to the app’s domain model.
- Flowchart: A visual representation of a workflow graph (nodes/edges) across providers.
