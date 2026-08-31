"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Activity,
  Bell,
  Bot,
  Building2,
  Check,
  ChevronRight,
  CirclePause,
  Clock3,
  Copy,
  Fingerprint,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  X,
  Zap,
} from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"

type Permission = {
  id: string
  label: string
  detail: string
  enabled: boolean
  approval?: boolean
}

type TelegramUser = {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

type Agent = {
  id: string
  name: string
  organization: string
  model: string
  status: "active" | "paused"
  activity: string
  permissions: Permission[]
}

type RegistryAdministrator = {
  administrator_id: string
  telegram_id: number
  username?: string
  first_name: string
  last_name?: string
}

type RegistryOrganization = {
  organization_id: string
  name: string
}

type RegistryPermission = {
  permission_key: string
  mode: "allow" | "deny" | "approval"
  scope?: Record<string, unknown>
}

type RegistryAgent = {
  agent_id: string
  organization_id: string
  name: string
  model: string
  status: "active" | "paused"
  permissions?: RegistryPermission[]
}

type RegistryActionRequest = {
  request_id: string
  agent_id: string
  action: string
  requested_scope: Record<string, unknown>
  risk_score?: number
  status: "pending" | "approved" | "rejected" | "expired"
  requested_at: string
}

type RegistryAuditEvent = {
  event_id: string
  agent_id?: string
  event_type: string
  event_data: Record<string, unknown>
  created_at: string
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "")

const permissionCopy: Record<string, { label: string; detail: string }> = {
  read: { label: "Read public data", detail: "Search and analyze approved sources" },
  draft: { label: "Create drafts", detail: "Prepare content without publishing" },
  send: { label: "External messages", detail: "Send messages within the approved scope" },
  publish: { label: "Publish content", detail: "Publish to approved destinations" },
  accounts: { label: "Create identities", detail: "Accounts, profiles and credentials" },
  payments: { label: "Payments", detail: "Any transfer of funds" },
}

function mapRegistryAgent(agent: RegistryAgent): Agent {
  return {
    id: agent.agent_id,
    name: agent.name,
    organization: agent.organization_id,
    model: agent.model,
    status: agent.status,
    activity: "Synced now",
    permissions: (agent.permissions ?? []).map((permission) => ({
      id: permission.permission_key,
      label: permissionCopy[permission.permission_key]?.label ?? permission.permission_key,
      detail: permissionCopy[permission.permission_key]?.detail ?? "Custom permission boundary",
      enabled: permission.mode !== "deny",
      approval: permission.mode === "approval",
    })),
  }
}

function MiniMark() {
  return (
    <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-[#111c25] shadow-[0_0_30px_rgba(86,231,184,0.08)]">
      <div className="absolute inset-[7px] rotate-45 rounded-[7px] border border-[#56e7b8]/70" />
      <ShieldCheck className="relative size-[18px] text-[#7af2c9]" strokeWidth={1.8} />
    </div>
  )
}

function StatusPill({ status }: { status: "active" | "paused" }) {
  const active = status === "active"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${active ? "border-[#56e7b8]/20 bg-[#56e7b8]/10 text-[#7af2c9]" : "border-[#ffb463]/20 bg-[#ffb463]/10 text-[#ffbf78]"}`}>
      <span className={`size-1.5 rounded-full ${active ? "bg-[#56e7b8] shadow-[0_0_8px_#56e7b8]" : "bg-[#ffb463]"}`} />
      {active ? "Active" : "Paused"}
    </span>
  )
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [pendingRequests, setPendingRequests] = useState<RegistryActionRequest[]>([])
  const [auditEvents, setAuditEvents] = useState<RegistryAuditEvent[]>([])
  const [tab, setTab] = useState("overview")
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [administratorId, setAdministratorId] = useState("Connecting…")
  const [organizationName, setOrganizationName] = useState("Personal Registry")

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId]
  )

  const activeCount = agents.filter((agent) => agent.status === "active").length
  const administratorName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ")
    : "Telegram administrator"
  const administratorInitials = administratorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const telegramIdentity = telegramUser?.username
    ? `@${telegramUser.username}`
    : "@AIAdminRegistryBot"

  useEffect(() => {
    const telegram = (window as typeof window & {
      Telegram?: {
        WebApp?: {
          ready?: () => void
          expand?: () => void
          setHeaderColor?: (color: string) => void
          setBackgroundColor?: (color: string) => void
          initData?: string
          initDataUnsafe?: { user?: TelegramUser }
        }
      }
    }).Telegram?.WebApp
    if (telegram?.initDataUnsafe?.user) {
      // Used only to personalize this prototype. Authorization will use
      // server-side validation of signed initData when the bot token is added.
      setTelegramUser(telegram.initDataUnsafe.user)
    }
    telegram?.ready?.()
    telegram?.expand?.()
    telegram?.setHeaderColor?.("#071017")
    telegram?.setBackgroundColor?.("#071017")

    const initData = telegram?.initData
    if (!apiBaseUrl || !initData) return

    const abortController = new AbortController()
    const connectRegistry = async () => {
      try {
        const authenticationResponse = await fetch(`${apiBaseUrl}/api/auth/telegram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ init_data: initData }),
          signal: abortController.signal,
        })
        if (!authenticationResponse.ok) {
          throw new Error("Administrator authentication failed")
        }
        const authentication = await authenticationResponse.json() as {
          session_token: string
          administrator: RegistryAdministrator
        }
        setSessionToken(authentication.session_token)
        setAdministratorId(authentication.administrator.administrator_id)

        const authorization = { Authorization: `Bearer ${authentication.session_token}` }
        const [profileResponse, agentsResponse, requestsResponse, auditResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/me`, { headers: authorization, signal: abortController.signal }),
          fetch(`${apiBaseUrl}/api/agents`, { headers: authorization, signal: abortController.signal }),
          fetch(`${apiBaseUrl}/api/action-requests?status=pending`, { headers: authorization, signal: abortController.signal }),
          fetch(`${apiBaseUrl}/api/audit?limit=100`, { headers: authorization, signal: abortController.signal }),
        ])
        if (profileResponse.ok) {
          const profile = await profileResponse.json() as {
            organizations: RegistryOrganization[]
          }
          setOrganizationName(profile.organizations[0]?.name ?? "Personal Registry")
        }
        if (agentsResponse.ok) {
          const registry = await agentsResponse.json() as { agents: RegistryAgent[] }
          const liveAgents = registry.agents.map(mapRegistryAgent)
          setAgents(liveAgents)
          setSelectedAgentId(liveAgents[0]?.id ?? "")
        }
        if (requestsResponse.ok) {
          const registry = await requestsResponse.json() as { requests: RegistryActionRequest[] }
          setPendingRequests(registry.requests)
        }
        if (auditResponse.ok) {
          const registry = await auditResponse.json() as { events: RegistryAuditEvent[] }
          setAuditEvents(registry.events)
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          toast.error("Registry connection failed", {
            description: error instanceof Error ? error.message : "Please reopen the Mini App.",
          })
        }
      }
    }
    void connectRegistry()
    return () => abortController.abort()
  }, [])

  const togglePermission = async (permissionId: string, enabled: boolean) => {
    if (!selectedAgent) return
    const previousAgents = agents
    setAgents((current) => current.map((agent) => (
      agent.id === selectedAgent.id
        ? { ...agent, permissions: agent.permissions.map((permission) => permission.id === permissionId ? { ...permission, enabled } : permission) }
        : agent
    )))
    try {
      if (sessionToken && apiBaseUrl) {
        const currentPermission = selectedAgent.permissions.find((permission) => permission.id === permissionId)
        const response = await fetch(`${apiBaseUrl}/api/agents/${selectedAgent.id}/permissions/${permissionId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: enabled ? (currentPermission?.approval ? "approval" : "allow") : "deny",
            scope: {},
          }),
        })
        if (!response.ok) throw new Error("Permission update was rejected")
      }
      toast.success(enabled ? "Permission enabled" : "Permission revoked", {
        description: `${selectedAgent.name} · ${permissionId}`,
      })
    } catch (error) {
      setAgents(previousAgents)
      toast.error("Permission was not changed", {
        description: error instanceof Error ? error.message : "Try again.",
      })
    }
  }

  const updateAgentStatus = async (nextStatus: "active" | "paused") => {
    if (!selectedAgent) return
    const previousAgents = agents
    setAgents((current) => current.map((agent) => agent.id === selectedAgent.id ? { ...agent, status: nextStatus } : agent))
    try {
      if (sessionToken && apiBaseUrl) {
        const response = await fetch(`${apiBaseUrl}/api/agents/${selectedAgent.id}/status`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        })
        if (!response.ok) throw new Error("Status update was rejected")
      }
      toast[nextStatus === "paused" ? "warning" : "success"](
        nextStatus === "paused" ? "Agent paused" : "Agent restored",
        { description: nextStatus === "paused" ? "All pending mandates were revoked." : "Permission policy is active again." }
      )
    } catch (error) {
      setAgents(previousAgents)
      toast.error("Agent status was not changed", {
        description: error instanceof Error ? error.message : "Try again.",
      })
    }
  }

  const pauseAgent = () => void updateAgentStatus("paused")

  const restoreAgent = () => void updateAgentStatus("active")

  const resolveApproval = async (requestId: string, decision: "approved" | "rejected") => {
    if (!sessionToken || !apiBaseUrl) return
    try {
      const response = await fetch(`${apiBaseUrl}/api/action-requests/${requestId}/decision`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ decision }),
      })
      if (!response.ok) throw new Error("The decision was rejected by the registry")
      setPendingRequests((current) => current.filter((request) => request.request_id !== requestId))
      toast[decision === "approved" ? "success" : "error"](
        decision === "approved" ? "One-time mandate issued" : "Request rejected",
        { description: decision === "approved" ? "The signed mandate expires in 10 minutes." : "The agent cannot perform this action." }
      )
    } catch (error) {
      toast.error("Decision was not recorded", {
        description: error instanceof Error ? error.message : "Try again.",
      })
    }
  }

  const addAgent = async () => {
    if (!sessionToken || !apiBaseUrl) {
      toast.error("Registry is not connected")
      return
    }
    const name = window.prompt("Agent name")?.trim()
    if (!name) return
    const model = window.prompt("Model", "unspecified")?.trim() || "unspecified"
    try {
      const response = await fetch(`${apiBaseUrl}/api/agents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, model }),
      })
      if (!response.ok) throw new Error("Agent creation was rejected")
      const created = await response.json() as { agent: RegistryAgent; agent_key: string }
      const liveAgent = mapRegistryAgent(created.agent)
      setAgents((current) => [liveAgent, ...current])
      setSelectedAgentId(liveAgent.id)
      window.prompt("Agent API key — copy it now. It will not be shown again.", created.agent_key)
      toast.success("Agent created", { description: liveAgent.id })
    } catch (error) {
      toast.error("Agent was not created", {
        description: error instanceof Error ? error.message : "Try again.",
      })
    }
  }

  return (
    <main className="min-h-[100dvh] bg-[#071017] text-[#eef7f4]">
      <div className="security-grid pointer-events-none fixed inset-0 opacity-70" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col overflow-hidden border-x border-white/[0.06] bg-[#071017]/92 shadow-2xl">
        <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#071017]/90 px-5 pb-4 pt-[max(18px,env(safe-area-inset-top))] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MiniMark />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold tracking-[0.13em]">AI ADMIN</p>
                  <span className="rounded bg-[#7af2c9] px-1.5 py-0.5 text-[8px] font-black tracking-[0.12em] text-[#071017]">REGISTRY</span>
                </div>
                <p className="mt-1 text-[11px] text-[#778a88]">@AIAdminRegistryBot</p>
              </div>
            </div>
            <button aria-label="Notifications" className="relative flex size-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-[#b9c9c6] transition hover:bg-white/[0.07]">
              <Bell className="size-[18px]" />
              {pendingRequests.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-[#0b151d] bg-[#ff8d69]" />}
            </button>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <div className="flex-1 px-5 pb-28 pt-5">
            <TabsContent value="overview" className="space-y-5">
              <section className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(145deg,#12242b_0%,#0c171f_55%,#0a141b_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                <div className="absolute -right-16 -top-20 size-52 rounded-full bg-[#56e7b8]/[0.08] blur-3xl" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7e9490]">Administrator identity</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Fingerprint className="size-5 text-[#7af2c9]" />
                      <p className="font-mono text-[19px] font-semibold tracking-[0.05em]">{administratorId}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#56e7b8]/20 bg-[#56e7b8]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#7af2c9]">
                    <ShieldCheck className="size-3.5" /> Verified
                  </span>
                </div>
                <div className="relative mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-semibold">{administratorName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8ea09d]"><Building2 className="size-3.5" /> {organizationName}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(administratorId); toast.success("Administrator ID copied") }} className="flex size-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#9dafac] transition hover:text-white" aria-label="Copy administrator ID">
                    <Copy className="size-4" />
                  </button>
                </div>
              </section>

              <section className="grid grid-cols-3 gap-2.5">
                <article className="metric-card"><Bot className="size-4 text-[#7af2c9]" /><p className="mt-3 text-2xl font-semibold">{agents.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-[#718380]">Agents</p></article>
                <article className="metric-card"><Activity className="size-4 text-[#7af2c9]" /><p className="mt-3 text-2xl font-semibold">{activeCount}</p><p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-[#718380]">Active</p></article>
                <article className="metric-card"><ShieldAlert className={`size-4 ${pendingRequests.length > 0 ? "text-[#ffad6c]" : "text-[#7af2c9]"}`} /><p className="mt-3 text-2xl font-semibold">{pendingRequests.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-[#718380]">Pending</p></article>
              </section>

              {pendingRequests[0] ? (
                <section className="overflow-hidden rounded-[24px] border border-[#ff9d66]/20 bg-[#ff9d66]/[0.055]">
                  <div className="flex items-start gap-3 border-b border-[#ff9d66]/15 px-5 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#ff9d66]/10 text-[#ffad73]"><ShieldAlert className="size-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#ffb07a]">Approval required</p><span className="flex items-center gap-1 text-[10px] text-[#8b9b98]"><Clock3 className="size-3" /> now</span></div>
                      <h2 className="mt-2 text-base font-semibold leading-snug">{pendingRequests[0].action}</h2>
                      <p className="mt-1 text-xs text-[#8b9b98]">{agents.find((agent) => agent.id === pendingRequests[0].agent_id)?.name ?? "AI agent"} · {pendingRequests[0].agent_id}</p>
                    </div>
                  </div>
                  <div className="space-y-3 px-5 py-4 text-xs">
                    <div className="flex justify-between gap-4"><span className="text-[#778986]">Requested scope</span><span className="max-w-[65%] break-words text-right text-[#dbe8e5]">{Object.keys(pendingRequests[0].requested_scope).length ? JSON.stringify(pendingRequests[0].requested_scope) : "No additional scope"}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-[#778986]">Risk score</span><span className="text-right font-medium text-[#ffb07a]">{pendingRequests[0].risk_score == null ? "Not supplied" : `${Math.round(pendingRequests[0].risk_score * 100)}%`}</span></div>
                  </div>
                  <div className="grid grid-cols-[1fr_1.4fr] gap-2.5 px-5 pb-5">
                    <Button onClick={() => resolveApproval(pendingRequests[0].request_id, "rejected")} variant="outline" className="h-11 rounded-xl border-white/10 bg-white/[0.025] text-[#d7e4e1] hover:bg-white/[0.07] hover:text-white"><X className="size-4" /> Reject</Button>
                    <Button onClick={() => resolveApproval(pendingRequests[0].request_id, "approved")} className="h-11 rounded-xl bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6]"><Check className="size-4" /> Approve once</Button>
                  </div>
                </section>
              ) : (
                <section className="rounded-[24px] border border-[#56e7b8]/15 bg-[#56e7b8]/[0.045] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-[14px] bg-[#56e7b8]/10 text-[#7af2c9]"><ShieldCheck className="size-5" /></div>
                    <div><p className="font-semibold">No pending approvals</p><p className="mt-1 text-xs text-[#7f918e]">New agent requests will appear here.</p></div>
                  </div>
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">Your AI agents</h2><button onClick={addAgent} className="flex items-center gap-1 text-xs font-semibold text-[#7af2c9]"><Plus className="size-3.5" /> Add agent</button></div>
                <div className="space-y-2.5">
                  {agents.map((agent) => (
                    <button key={agent.id} onClick={() => { setSelectedAgentId(agent.id); setTab("agents") }} className="group flex w-full items-center gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.027] p-3.5 text-left transition hover:border-white/[0.12] hover:bg-white/[0.045]">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-[15px] border border-white/[0.07] bg-[#111e26] text-[#91a5a1] group-hover:text-[#7af2c9]"><Bot className="size-5" /></div>
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{agent.name}</p><StatusPill status={agent.status} /></div><p className="mt-1 truncate text-[11px] text-[#748683]">{agent.id} · {agent.model} · {agent.activity}</p></div>
                      <ChevronRight className="size-4 text-[#516360] transition group-hover:translate-x-0.5 group-hover:text-[#91a5a1]" />
                    </button>
                  ))}
                  {agents.length === 0 && <div className="rounded-[20px] border border-dashed border-white/[0.1] px-4 py-7 text-center"><Bot className="mx-auto size-5 text-[#738582]" /><p className="mt-2 text-sm font-medium">No agents registered</p><p className="mt-1 text-xs text-[#718481]">Add the first agent to issue a private API key.</p></div>}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="agents" className="space-y-5">
              {selectedAgent ? <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#718481]">Selected agent</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-[16px] border border-white/[0.08] bg-[#111e26] text-[#7af2c9]"><Bot className="size-6" /></div>
                  <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-semibold">{selectedAgent.name}</h1><p className="mt-1 font-mono text-[11px] text-[#778986]">{selectedAgent.id} · {selectedAgent.model}</p></div>
                  <StatusPill status={selectedAgent.status} />
                </div>
              </div>

              <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.027] p-4">
                <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-white/[0.045] text-[#93a6a2]"><Building2 className="size-4" /></div><div className="flex-1"><p className="text-[10px] uppercase tracking-[0.13em] text-[#697b78]">Organization</p><p className="mt-1 text-sm font-medium">{selectedAgent.organization}</p></div><span className="text-[10px] text-[#7af2c9]">VERIFIED</span></div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between"><div><h2 className="text-sm font-semibold">Permission boundary</h2><p className="mt-1 text-xs text-[#718481]">Every change is written to the audit trail.</p></div><LockKeyhole className="size-4 text-[#7af2c9]" /></div>
                <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.027]">
                  {selectedAgent.permissions.map((permission, index) => (
                    <div key={permission.id} className={`flex items-center gap-3 p-4 ${index !== 0 ? "border-t border-white/[0.06]" : ""}`}>
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium">{permission.label}</p>{permission.approval && <span className="rounded-md bg-[#ffae70]/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.1em] text-[#ffb77d]">Approval</span>}</div><p className="mt-1 text-[11px] leading-4 text-[#718481]">{permission.detail}</p></div>
                      <Switch checked={permission.enabled} onCheckedChange={(value) => togglePermission(permission.id, value)} aria-label={`Toggle ${permission.label}`} className="data-[state=checked]:bg-[#56e7b8]" />
                    </div>
                  ))}
                </div>
              </section>

              {selectedAgent.status === "active" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" className="h-12 w-full rounded-[16px] border-[#ff765f]/20 bg-[#ff765f]/[0.055] font-semibold text-[#ff9785] hover:bg-[#ff765f]/10 hover:text-[#ffad9e]"><CirclePause className="size-4" /> Emergency pause</Button></AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-[#0d1820] text-[#eef7f4]">
                    <AlertDialogHeader><AlertDialogMedia className="bg-[#ff765f]/10 text-[#ff8d78]"><ShieldAlert /></AlertDialogMedia><AlertDialogTitle>Pause {selectedAgent.name}?</AlertDialogTitle><AlertDialogDescription className="text-[#849693]">All active mandates will be revoked immediately. The agent will no longer receive valid authorization tokens.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.07] hover:text-white">Cancel</AlertDialogCancel><AlertDialogAction onClick={pauseAgent} variant="destructive">Pause agent</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={restoreAgent} className="h-12 w-full rounded-[16px] bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6]"><Zap className="size-4" /> Restore agent</Button>
              )}

              <section>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#718481]">Switch agent</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">{agents.map((agent) => <button key={agent.id} onClick={() => setSelectedAgentId(agent.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${selectedAgent.id === agent.id ? "border-[#56e7b8]/30 bg-[#56e7b8]/10 text-[#7af2c9]" : "border-white/[0.07] bg-white/[0.025] text-[#8fa09d]"}`}>{agent.name}</button>)}</div>
              </section>
              </> : <section className="rounded-[24px] border border-dashed border-white/[0.1] px-5 py-10 text-center"><Bot className="mx-auto size-6 text-[#738582]" /><h1 className="mt-3 text-lg font-semibold">No agents registered</h1><p className="mt-2 text-sm text-[#718481]">Create your first agent from the Home tab.</p><Button onClick={() => setTab("overview")} className="mt-5 bg-[#7af2c9] text-[#071017] hover:bg-[#94f7d6]">Back to Home</Button></section>}
            </TabsContent>

            <TabsContent value="audit" className="space-y-5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#718481]">Immutable record</p><h1 className="mt-2 text-2xl font-semibold">Audit trail</h1><p className="mt-2 text-sm leading-6 text-[#7f918e]">Every request, decision and permission change linked to a human administrator.</p></div>
              <div className="space-y-3">
                {auditEvents.map((event, index) => (
                  <article key={event.event_id} className="relative flex gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.027] p-4">
                    {index < auditEvents.length - 1 && <div className="absolute left-[33px] top-[52px] h-[28px] w-px bg-white/[0.08]" />}
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#56e7b8]/10 text-[#7af2c9]"><ScrollText className="size-4" /></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium capitalize">{event.event_type.replaceAll(".", " ")}</p><p className="mt-1 break-words text-[11px] text-[#718481]">{event.agent_id ? `${event.agent_id} · ` : ""}{Object.keys(event.event_data).length ? JSON.stringify(event.event_data) : administratorId}</p></div><span className="text-right text-[10px] text-[#596a67]">{new Date(event.created_at).toLocaleString()}</span>
                  </article>
                ))}
                {auditEvents.length === 0 && <div className="rounded-[20px] border border-dashed border-white/[0.1] px-4 py-7 text-center"><ScrollText className="mx-auto size-5 text-[#738582]" /><p className="mt-2 text-sm font-medium">No audit events yet</p></div>}
              </div>
              <div className="rounded-[20px] border border-dashed border-white/[0.1] px-4 py-5 text-center"><ScrollText className="mx-auto size-5 text-[#738582]" /><p className="mt-2 text-xs text-[#718481]">Loaded from the append-only backend audit log.</p></div>
            </TabsContent>

            <TabsContent value="profile" className="space-y-5">
              <div className="flex flex-col items-center py-4 text-center"><div className="relative flex size-20 items-center justify-center rounded-[27px] border border-[#56e7b8]/20 bg-[#56e7b8]/10 text-2xl font-semibold text-[#7af2c9]">{administratorInitials}<span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-4 border-[#071017] bg-[#56e7b8] text-[#071017]"><Check className="size-3.5" strokeWidth={3} /></span></div><h1 className="mt-4 text-xl font-semibold">{administratorName}</h1><p className="mt-1 font-mono text-xs text-[#7e908d]">{administratorId}</p><p className="mt-1 text-xs text-[#60726f]">{telegramIdentity}</p></div>
              <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.027]">
                {[
                  [Fingerprint, "Identity", telegramUser ? `${telegramIdentity} connected` : "Ready for Telegram"],
                  [Building2, "Organization", organizationName],
                  [ShieldCheck, "Operational record", "0 incidents"],
                  [KeyRound, "Second factor", "Not connected"],
                ].map(([Icon, label, value], index) => (
                  <button key={label as string} onClick={() => toast.info(label as string, { description: value as string })} className={`flex w-full items-center gap-3 p-4 text-left ${index !== 0 ? "border-t border-white/[0.06]" : ""}`}><div className="flex size-9 items-center justify-center rounded-xl bg-white/[0.045] text-[#8fa29e]"><Icon className="size-4" /></div><div className="flex-1"><p className="text-xs text-[#728481]">{label as string}</p><p className="mt-1 text-sm font-medium">{value as string}</p></div><ChevronRight className="size-4 text-[#50615e]" /></button>
                ))}
              </section>
              <div className="rounded-[22px] border border-[#56e7b8]/15 bg-[#56e7b8]/[0.045] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#7af2c9]" /><div><p className="text-sm font-medium">Trust is operational, not social.</p><p className="mt-1.5 text-xs leading-5 text-[#78908a]">Your record is calculated from verified response time, permission hygiene and incident handling — not popularity.</p></div></div></div>
              {!telegramUser && <Button asChild className="h-12 w-full rounded-[16px] bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6]"><a href="https://t.me/AIAdminRegistryBot?startapp=registry" target="_blank" rel="noreferrer"><Zap className="size-4" /> Open Telegram bot</a></Button>}
            </TabsContent>
          </div>

          <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[520px] -translate-x-1/2 border-t border-white/[0.07] bg-[#081219]/94 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
            <TabsList className="grid h-auto w-full grid-cols-4 bg-transparent p-0">
              {[
                ["overview", LayoutDashboard, "Home"],
                ["agents", Bot, "Agents"],
                ["audit", ScrollText, "Audit"],
                ["profile", UserRound, "Profile"],
              ].map(([value, Icon, label]) => (
                <TabsTrigger key={value as string} value={value as string} className="flex h-[54px] flex-col gap-1 rounded-xl bg-transparent text-[10px] text-[#61726f] shadow-none after:hidden data-[state=active]:bg-[#56e7b8]/[0.07] data-[state=active]:text-[#7af2c9] dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-[#56e7b8]/[0.07]"><Icon className="size-[18px]" />{label as string}</TabsTrigger>
              ))}
            </TabsList>
          </nav>
        </Tabs>
      </div>
      <Toaster position="top-center" />
    </main>
  )
}
