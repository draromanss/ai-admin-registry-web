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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"

type Permission = {
  id: string
  label: string
  detail: string
  enabled: boolean
  approval?: boolean
}

type PermissionMode = "allow" | "deny" | "approval"

type AgentCredential = {
  agentId: string
  agentName: string
  agentKey: string
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

const permissionCatalog = ["read", "draft", "send", "publish", "accounts", "payments"] as const

const defaultPermissionModes = (): Record<string, PermissionMode> => ({
  read: "allow",
  draft: "allow",
  send: "approval",
  publish: "approval",
  accounts: "deny",
  payments: "deny",
})

type Language = "ru" | "en"

const permissionCopy: Record<Language, Record<string, { label: string; detail: string }>> = {
  ru: {
    read: { label: "Чтение открытых данных", detail: "Поиск и анализ разрешённых источников" },
    draft: { label: "Создание черновиков", detail: "Подготовка материалов без публикации" },
    send: { label: "Внешние сообщения", detail: "Отправка сообщений в разрешённых пределах" },
    publish: { label: "Публикация контента", detail: "Публикация в разрешённых каналах" },
    accounts: { label: "Создание профилей", detail: "Аккаунты, профили и учётные данные" },
    payments: { label: "Платежи", detail: "Любые переводы денежных средств" },
  },
  en: {
    read: { label: "Read public data", detail: "Search and analyze approved sources" },
    draft: { label: "Create drafts", detail: "Prepare content without publishing" },
    send: { label: "External messages", detail: "Send messages within the approved scope" },
    publish: { label: "Publish content", detail: "Publish to approved destinations" },
    accounts: { label: "Create identities", detail: "Accounts, profiles and credentials" },
    payments: { label: "Payments", detail: "Any transfer of funds" },
  },
}

const translations = {
  ru: {
    connecting: "Подключение…", personalRegistry: "Личный реестр", telegramAdministrator: "Администратор Telegram",
    active: "Активен", paused: "Приостановлен", syncedNow: "Синхронизирован",
    administratorIdentity: "Личность администратора", verified: "Подтверждён", copyAdministratorId: "Скопировать ID администратора", administratorIdCopied: "ID администратора скопирован",
    agents: "Агенты", activeAgents: "Активны", pending: "Ожидают", notifications: "Уведомления",
    approvalRequired: "Требуется подтверждение", now: "сейчас", aiAgent: "ИИ-агент", requestedScope: "Запрошенный доступ", noAdditionalScope: "Дополнительные ограничения не заданы", riskScore: "Уровень риска", notSupplied: "Не указан",
    reject: "Отклонить", approveOnce: "Одобрить один раз", noPendingApprovals: "Нет запросов на подтверждение", newRequestsAppear: "Новые запросы агентов появятся здесь.",
    yourAgents: "Ваши ИИ-агенты", addAgent: "Добавить агента", noAgents: "Агенты не зарегистрированы", addFirstAgent: "Добавьте первого агента, чтобы выпустить приватный API-ключ.",
    selectedAgent: "Выбранный агент", organization: "Организация", permissionBoundary: "Границы полномочий", everyChangeAudited: "Каждое изменение записывается в журнал аудита.", approval: "Подтверждение",
    emergencyPause: "Экстренно приостановить", pauseQuestion: "Приостановить агента", pauseDescription: "Все действующие мандаты будут немедленно отозваны. Агент перестанет получать действительные токены авторизации.", cancel: "Отмена", pauseAgent: "Приостановить агента", restoreAgent: "Возобновить работу", switchAgent: "Выбрать другого агента", createFirstFromHome: "Создайте первого агента на главной вкладке.", backHome: "На главную",
    immutableRecord: "Неизменяемая запись", auditTrail: "Журнал аудита", auditDescription: "Каждый запрос, решение и изменение полномочий связано с человеком-администратором.", noAuditEvents: "Событий аудита пока нет", auditLoaded: "Данные загружены из дополняемого журнала backend.",
    identity: "Личность", connected: "подключён", readyForTelegram: "Готов к Telegram", operationalRecord: "История работы", noIncidents: "0 инцидентов", secondFactor: "Второй фактор", notConnected: "Не подключён",
    trustTitle: "Доверие определяется действиями, а не популярностью.", trustDescription: "Репутация рассчитывается по скорости реакции, аккуратности в разрешениях и работе с инцидентами.", openTelegramBot: "Открыть Telegram-бота",
    home: "Главная", audit: "Аудит", profile: "Профиль",
    authFailed: "Не удалось подтвердить администратора", connectionFailed: "Не удалось подключиться к реестру", reopenApp: "Закройте и снова откройте Mini App.",
    permissionRejected: "Реестр отклонил изменение разрешения", permissionEnabled: "Разрешение включено", permissionRevoked: "Разрешение отозвано", permissionNotChanged: "Разрешение не изменено", tryAgain: "Попробуйте ещё раз.",
    statusRejected: "Реестр отклонил изменение статуса", agentPaused: "Агент приостановлен", agentRestored: "Работа агента возобновлена", mandatesRevoked: "Все ожидающие мандаты отозваны.", policyActive: "Политика разрешений снова активна.", statusNotChanged: "Статус агента не изменён",
    decisionRejected: "Реестр отклонил решение", mandateIssued: "Разовый мандат выпущен", requestRejected: "Запрос отклонён", mandateExpires: "Подписанный мандат действует 10 минут.", agentCannotAct: "Агент не сможет выполнить это действие.", decisionNotRecorded: "Решение не записано",
    registryNotConnected: "Реестр не подключён", agentName: "Название агента", model: "Модель", creationRejected: "Реестр отклонил создание агента", copyAgentKey: "API-ключ агента — скопируйте его сейчас. Повторно он показан не будет.", agentCreated: "Агент создан", agentNotCreated: "Агент не создан", customPermission: "Пользовательская граница полномочий", togglePermission: "Изменить разрешение",
    createAgentTitle: "Новый ИИ-агент", createAgentDescription: "Укажите имя, модель и стартовые границы полномочий.", agentNamePlaceholder: "Например, Client Hunter", modelPlaceholder: "Например, GPT-5.6", permissionsTitle: "Стартовые разрешения", allow: "Разрешить", approvalMode: "После подтверждения", deny: "Запретить", createAgent: "Создать агента", creatingAgent: "Создание…", close: "Закрыть",
    credentialsTitle: "Сохраните ключ агента", credentialsDescription: "Ключ показан только один раз. После закрытия этого окна восстановить его нельзя — можно только выпустить новый.", apiAddress: "Адрес API", agentId: "ID агента", agentKey: "Секретный API-ключ", copy: "Копировать", copied: "Скопировано", keepSecret: "Храните ключ только в секретах среды агента. Не вставляйте его в сайт, сообщения или публичный репозиторий.", integrationTitle: "Первый запрос агента", envHint: "Сохраните ключ в переменной AI_ADMIN_AGENT_KEY и выполните тестовый запрос:", keySaved: "Я сохранил ключ", rotateKey: "Выпустить новый ключ", rotateQuestion: "Выпустить новый ключ для", rotateDescription: "Предыдущий ключ сразу перестанет работать. Все интеграции агента потребуется обновить.", rotate: "Выпустить", keyRotated: "Новый ключ выпущен", keyRotationFailed: "Не удалось выпустить новый ключ", invalidAgentName: "Название должно содержать не менее двух символов.",
  },
  en: {
    connecting: "Connecting…", personalRegistry: "Personal Registry", telegramAdministrator: "Telegram administrator",
    active: "Active", paused: "Paused", syncedNow: "Synced now",
    administratorIdentity: "Administrator identity", verified: "Verified", copyAdministratorId: "Copy administrator ID", administratorIdCopied: "Administrator ID copied",
    agents: "Agents", activeAgents: "Active", pending: "Pending", notifications: "Notifications",
    approvalRequired: "Approval required", now: "now", aiAgent: "AI agent", requestedScope: "Requested scope", noAdditionalScope: "No additional scope", riskScore: "Risk score", notSupplied: "Not supplied",
    reject: "Reject", approveOnce: "Approve once", noPendingApprovals: "No pending approvals", newRequestsAppear: "New agent requests will appear here.",
    yourAgents: "Your AI agents", addAgent: "Add agent", noAgents: "No agents registered", addFirstAgent: "Add the first agent to issue a private API key.",
    selectedAgent: "Selected agent", organization: "Organization", permissionBoundary: "Permission boundary", everyChangeAudited: "Every change is written to the audit trail.", approval: "Approval",
    emergencyPause: "Emergency pause", pauseQuestion: "Pause agent", pauseDescription: "All active mandates will be revoked immediately. The agent will no longer receive valid authorization tokens.", cancel: "Cancel", pauseAgent: "Pause agent", restoreAgent: "Restore agent", switchAgent: "Switch agent", createFirstFromHome: "Create your first agent from the Home tab.", backHome: "Back to Home",
    immutableRecord: "Immutable record", auditTrail: "Audit trail", auditDescription: "Every request, decision and permission change linked to a human administrator.", noAuditEvents: "No audit events yet", auditLoaded: "Loaded from the append-only backend audit log.",
    identity: "Identity", connected: "connected", readyForTelegram: "Ready for Telegram", operationalRecord: "Operational record", noIncidents: "0 incidents", secondFactor: "Second factor", notConnected: "Not connected",
    trustTitle: "Trust is operational, not social.", trustDescription: "Your record is calculated from verified response time, permission hygiene and incident handling — not popularity.", openTelegramBot: "Open Telegram bot",
    home: "Home", audit: "Audit", profile: "Profile",
    authFailed: "Administrator authentication failed", connectionFailed: "Registry connection failed", reopenApp: "Please reopen the Mini App.",
    permissionRejected: "Permission update was rejected", permissionEnabled: "Permission enabled", permissionRevoked: "Permission revoked", permissionNotChanged: "Permission was not changed", tryAgain: "Try again.",
    statusRejected: "Status update was rejected", agentPaused: "Agent paused", agentRestored: "Agent restored", mandatesRevoked: "All pending mandates were revoked.", policyActive: "Permission policy is active again.", statusNotChanged: "Agent status was not changed",
    decisionRejected: "The decision was rejected by the registry", mandateIssued: "One-time mandate issued", requestRejected: "Request rejected", mandateExpires: "The signed mandate expires in 10 minutes.", agentCannotAct: "The agent cannot perform this action.", decisionNotRecorded: "Decision was not recorded",
    registryNotConnected: "Registry is not connected", agentName: "Agent name", model: "Model", creationRejected: "Agent creation was rejected", copyAgentKey: "Agent API key — copy it now. It will not be shown again.", agentCreated: "Agent created", agentNotCreated: "Agent was not created", customPermission: "Custom permission boundary", togglePermission: "Toggle permission",
    createAgentTitle: "New AI agent", createAgentDescription: "Set a name, model and initial permission boundary.", agentNamePlaceholder: "For example, Client Hunter", modelPlaceholder: "For example, GPT-5.6", permissionsTitle: "Initial permissions", allow: "Allow", approvalMode: "Require approval", deny: "Deny", createAgent: "Create agent", creatingAgent: "Creating…", close: "Close",
    credentialsTitle: "Save the agent key", credentialsDescription: "This key is shown only once. After closing this window it cannot be recovered; only replaced.", apiAddress: "API address", agentId: "Agent ID", agentKey: "Secret API key", copy: "Copy", copied: "Copied", keepSecret: "Store the key only in the agent runtime secrets. Never put it in a website, message or public repository.", integrationTitle: "First agent request", envHint: "Store the key as AI_ADMIN_AGENT_KEY and run this test request:", keySaved: "I saved the key", rotateKey: "Issue a new key", rotateQuestion: "Issue a new key for", rotateDescription: "The previous key will stop working immediately. Every agent integration must be updated.", rotate: "Issue key", keyRotated: "New key issued", keyRotationFailed: "Unable to issue a new key", invalidAgentName: "The name must contain at least two characters.",
  },
} as const

const auditEventNames: Record<Language, Record<string, string>> = {
  ru: {
    "administrator.registered": "Администратор зарегистрирован",
    "agent.created": "Агент создан",
    "agent.key_rotated": "Ключ агента заменён",
    "agent.active": "Работа агента возобновлена",
    "agent.paused": "Агент приостановлен",
    "permission.changed": "Разрешение изменено",
    "action.requested": "Запрошено действие",
    "action.approved": "Действие одобрено",
    "action.rejected": "Действие отклонено",
  },
  en: {
    "administrator.registered": "Administrator registered",
    "agent.created": "Agent created",
    "agent.key_rotated": "Agent key rotated",
    "agent.active": "Agent restored",
    "agent.paused": "Agent paused",
    "permission.changed": "Permission changed",
    "action.requested": "Action requested",
    "action.approved": "Action approved",
    "action.rejected": "Action rejected",
  },
}

function mapRegistryAgent(agent: RegistryAgent, language: Language): Agent {
  return {
    id: agent.agent_id,
    name: agent.name,
    organization: agent.organization_id,
    model: agent.model,
    status: agent.status,
    activity: translations[language].syncedNow,
    permissions: (agent.permissions ?? []).map((permission) => ({
      id: permission.permission_key,
      label: permissionCopy[language][permission.permission_key]?.label ?? permission.permission_key,
      detail: permissionCopy[language][permission.permission_key]?.detail ?? translations[language].customPermission,
      enabled: permission.mode !== "deny",
      approval: permission.mode === "approval",
    })),
  }
}

function getPermissionMode(permission: Permission | undefined): PermissionMode {
  if (!permission || !permission.enabled) return "deny"
  return permission.approval ? "approval" : "allow"
}

function MiniMark() {
  return (
    <div className="relative flex size-10 items-center justify-center overflow-hidden rounded-[14px] border border-white/10 bg-[#111c25] shadow-[0_0_30px_rgba(86,231,184,0.08)]">
      <div className="absolute inset-[7px] rotate-45 rounded-[7px] border border-[#56e7b8]/70" />
      <ShieldCheck className="relative size-[18px] text-[#7af2c9]" strokeWidth={1.8} />
    </div>
  )
}

function StatusPill({ status, language }: { status: "active" | "paused"; language: Language }) {
  const active = status === "active"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${active ? "border-[#56e7b8]/20 bg-[#56e7b8]/10 text-[#7af2c9]" : "border-[#ffb463]/20 bg-[#ffb463]/10 text-[#ffbf78]"}`}>
      <span className={`size-1.5 rounded-full ${active ? "bg-[#56e7b8] shadow-[0_0_8px_#56e7b8]" : "bg-[#ffb463]"}`} />
      {active ? translations[language].active : translations[language].paused}
    </span>
  )
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("ru")
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgentId, setSelectedAgentId] = useState("")
  const [pendingRequests, setPendingRequests] = useState<RegistryActionRequest[]>([])
  const [auditEvents, setAuditEvents] = useState<RegistryAuditEvent[]>([])
  const [tab, setTab] = useState("overview")
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [administratorId, setAdministratorId] = useState<string>(translations.ru.connecting)
  const [organizationName, setOrganizationName] = useState<string>(translations.ru.personalRegistry)
  const [agentFormOpen, setAgentFormOpen] = useState(false)
  const [agentName, setAgentName] = useState("")
  const [agentModel, setAgentModel] = useState("unspecified")
  const [agentPermissionModes, setAgentPermissionModes] = useState<Record<string, PermissionMode>>(defaultPermissionModes)
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)
  const [credential, setCredential] = useState<AgentCredential | null>(null)
  const tr = translations[language]

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? null,
    [agents, selectedAgentId]
  )

  const activeCount = agents.filter((agent) => agent.status === "active").length
  const administratorName = telegramUser
    ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(" ")
    : tr.telegramAdministrator
  const administratorInitials = administratorName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const telegramIdentity = telegramUser?.username
    ? `@${telegramUser.username}`
    : "@AIAdminRegistryBot"
  const curlExample = `curl -X POST '${apiBaseUrl}/api/agent/action-requests' \\
  -H 'Content-Type: application/json' \\
  -H 'X-Agent-Key: $AI_ADMIN_AGENT_KEY' \\
  -d '{"action":"send","scope":{"contacts":1},"risk_score":0.2}'`

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
      setTelegramUser(telegram.initDataUnsafe.user)
    }
    const savedLanguage = window.localStorage.getItem("ai-admin-language")
    const detectedLanguage: Language = savedLanguage === "ru" || savedLanguage === "en"
      ? savedLanguage
      : telegram?.initDataUnsafe?.user?.language_code?.toLowerCase().startsWith("ru") ? "ru" : "en"
    setLanguage(detectedLanguage)
    document.documentElement.lang = detectedLanguage
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
          throw new Error(translations[detectedLanguage].authFailed)
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
          setOrganizationName(profile.organizations[0]?.name ?? translations[detectedLanguage].personalRegistry)
        }
        if (agentsResponse.ok) {
          const registry = await agentsResponse.json() as { agents: RegistryAgent[] }
          const liveAgents = registry.agents.map((agent) => mapRegistryAgent(agent, detectedLanguage))
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
          toast.error(translations[detectedLanguage].connectionFailed, {
            description: error instanceof Error ? error.message : translations[detectedLanguage].reopenApp,
          })
        }
      }
    }
    void connectRegistry()
    return () => abortController.abort()
  }, [])

  useEffect(() => {
    if (!sessionToken || !apiBaseUrl) return

    let stopped = false
    const refreshRegistry = async () => {
      if (document.visibilityState === "hidden") return
      try {
        const authorization = { Authorization: `Bearer ${sessionToken}` }
        const [agentsResponse, requestsResponse, auditResponse] = await Promise.all([
          fetch(`${apiBaseUrl}/api/agents`, { headers: authorization }),
          fetch(`${apiBaseUrl}/api/action-requests?status=pending`, { headers: authorization }),
          fetch(`${apiBaseUrl}/api/audit?limit=100`, { headers: authorization }),
        ])
        if (stopped) return
        if (agentsResponse.ok) {
          const registry = await agentsResponse.json() as { agents: RegistryAgent[] }
          const liveAgents = registry.agents.map((agent) => mapRegistryAgent(agent, language))
          setAgents(liveAgents)
          setSelectedAgentId((current) => liveAgents.some((agent) => agent.id === current) ? current : liveAgents[0]?.id ?? "")
        }
        if (requestsResponse.ok) {
          const registry = await requestsResponse.json() as { requests: RegistryActionRequest[] }
          setPendingRequests(registry.requests)
        }
        if (auditResponse.ok) {
          const registry = await auditResponse.json() as { events: RegistryAuditEvent[] }
          setAuditEvents(registry.events)
        }
      } catch {
        // A transient refresh failure must not interrupt the administrator's work.
      }
    }

    const timer = window.setInterval(() => void refreshRegistry(), 10_000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshRegistry()
    }
    document.addEventListener("visibilitychange", refreshWhenVisible)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", refreshWhenVisible)
    }
  }, [sessionToken, language])

  const changeLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage)
    document.documentElement.lang = nextLanguage
    window.localStorage.setItem("ai-admin-language", nextLanguage)
    setAdministratorId((current) => current === translations.ru.connecting || current === translations.en.connecting ? translations[nextLanguage].connecting : current)
    setOrganizationName((current) => current === translations.ru.personalRegistry || current === translations.en.personalRegistry ? translations[nextLanguage].personalRegistry : current)
    setAgents((current) => current.map((agent) => ({
      ...agent,
      activity: translations[nextLanguage].syncedNow,
      permissions: agent.permissions.map((permission) => ({
        ...permission,
        label: permissionCopy[nextLanguage][permission.id]?.label ?? permission.id,
        detail: permissionCopy[nextLanguage][permission.id]?.detail ?? translations[nextLanguage].customPermission,
      })),
    })))
  }

  const updatePermissionMode = async (permissionId: string, mode: PermissionMode) => {
    if (!selectedAgent) return
    const previousAgents = agents
    setAgents((current) => current.map((agent) => (
      agent.id === selectedAgent.id
        ? {
          ...agent,
          permissions: [
            ...agent.permissions.filter((permission) => permission.id !== permissionId),
            {
              id: permissionId,
              label: permissionCopy[language][permissionId]?.label ?? permissionId,
              detail: permissionCopy[language][permissionId]?.detail ?? tr.customPermission,
              enabled: mode !== "deny",
              approval: mode === "approval",
            },
          ],
        }
        : agent
    )))
    try {
      if (sessionToken && apiBaseUrl) {
        const response = await fetch(`${apiBaseUrl}/api/agents/${selectedAgent.id}/permissions/${permissionId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode,
            scope: {},
          }),
        })
        if (!response.ok) throw new Error(tr.permissionRejected)
      }
      toast.success(mode === "deny" ? tr.permissionRevoked : tr.permissionEnabled, {
        description: `${selectedAgent.name} · ${permissionId}`,
      })
    } catch (error) {
      setAgents(previousAgents)
      toast.error(tr.permissionNotChanged, {
        description: error instanceof Error ? error.message : tr.tryAgain,
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
        if (!response.ok) throw new Error(tr.statusRejected)
      }
      toast[nextStatus === "paused" ? "warning" : "success"](
        nextStatus === "paused" ? tr.agentPaused : tr.agentRestored,
        { description: nextStatus === "paused" ? tr.mandatesRevoked : tr.policyActive }
      )
    } catch (error) {
      setAgents(previousAgents)
      toast.error(tr.statusNotChanged, {
        description: error instanceof Error ? error.message : tr.tryAgain,
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
      if (!response.ok) throw new Error(tr.decisionRejected)
      setPendingRequests((current) => current.filter((request) => request.request_id !== requestId))
      toast[decision === "approved" ? "success" : "error"](
        decision === "approved" ? tr.mandateIssued : tr.requestRejected,
        { description: decision === "approved" ? tr.mandateExpires : tr.agentCannotAct }
      )
    } catch (error) {
      toast.error(tr.decisionNotRecorded, {
        description: error instanceof Error ? error.message : tr.tryAgain,
      })
    }
  }

  const openAgentForm = () => {
    setAgentName("")
    setAgentModel("unspecified")
    setAgentPermissionModes(defaultPermissionModes())
    setAgentFormOpen(true)
  }

  const addAgent = async () => {
    if (!sessionToken || !apiBaseUrl) {
      toast.error(tr.registryNotConnected)
      return
    }
    const name = agentName.trim()
    if (name.length < 2) {
      toast.error(tr.invalidAgentName)
      return
    }
    const model = agentModel.trim() || "unspecified"
    setIsCreatingAgent(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/agents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          model,
          permissions: permissionCatalog.map((permissionKey) => ({
            permission_key: permissionKey,
            mode: agentPermissionModes[permissionKey],
            scope: {},
          })),
        }),
      })
      if (!response.ok) throw new Error(tr.creationRejected)
      const created = await response.json() as { agent: RegistryAgent; agent_key: string }
      const liveAgent = mapRegistryAgent(created.agent, language)
      setAgents((current) => [liveAgent, ...current])
      setSelectedAgentId(liveAgent.id)
      setAgentFormOpen(false)
      setCredential({ agentId: liveAgent.id, agentName: liveAgent.name, agentKey: created.agent_key })
      toast.success(tr.agentCreated, { description: liveAgent.id })
    } catch (error) {
      toast.error(tr.agentNotCreated, {
        description: error instanceof Error ? error.message : tr.tryAgain,
      })
    } finally {
      setIsCreatingAgent(false)
    }
  }

  const rotateAgentKey = async () => {
    if (!selectedAgent || !sessionToken || !apiBaseUrl) return
    try {
      const response = await fetch(`${apiBaseUrl}/api/agents/${selectedAgent.id}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      if (!response.ok) throw new Error(tr.keyRotationFailed)
      const result = await response.json() as { agent_key: string }
      setCredential({ agentId: selectedAgent.id, agentName: selectedAgent.name, agentKey: result.agent_key })
      toast.success(tr.keyRotated, { description: selectedAgent.id })
    } catch (error) {
      toast.error(tr.keyRotationFailed, {
        description: error instanceof Error ? error.message : tr.tryAgain,
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
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl border border-white/[0.08] bg-white/[0.035] p-0.5 text-[10px] font-bold">
                {(["ru", "en"] as Language[]).map((item) => <button key={item} onClick={() => changeLanguage(item)} className={`rounded-[9px] px-2 py-1.5 transition ${language === item ? "bg-[#7af2c9] text-[#071017]" : "text-[#778a88]"}`}>{item.toUpperCase()}</button>)}
              </div>
              <button aria-label={tr.notifications} className="relative flex size-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.035] text-[#b9c9c6] transition hover:bg-white/[0.07]">
                <Bell className="size-[18px]" />
                {pendingRequests.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full border-2 border-[#0b151d] bg-[#ff8d69]" />}
              </button>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <div className="flex-1 px-5 pb-28 pt-5">
            <TabsContent value="overview" className="space-y-5">
              <section className="relative overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(145deg,#12242b_0%,#0c171f_55%,#0a141b_100%)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.24)]">
                <div className="absolute -right-16 -top-20 size-52 rounded-full bg-[#56e7b8]/[0.08] blur-3xl" />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7e9490]">{tr.administratorIdentity}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <Fingerprint className="size-5 text-[#7af2c9]" />
                      <p className="font-mono text-[19px] font-semibold tracking-[0.05em]">{administratorId}</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#56e7b8]/20 bg-[#56e7b8]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#7af2c9]">
                    <ShieldCheck className="size-3.5" /> {tr.verified}
                  </span>
                </div>
                <div className="relative mt-6 flex items-end justify-between">
                  <div>
                    <p className="text-lg font-semibold">{administratorName}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[#8ea09d]"><Building2 className="size-3.5" /> {organizationName}</p>
                  </div>
                  <button onClick={() => { navigator.clipboard?.writeText(administratorId); toast.success(tr.administratorIdCopied) }} className="flex size-9 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-[#9dafac] transition hover:text-white" aria-label={tr.copyAdministratorId}>
                    <Copy className="size-4" />
                  </button>
                </div>
              </section>

              <section className="grid grid-cols-3 gap-2.5">
                <article className="metric-card"><Bot className="size-4 text-[#7af2c9]" /><p className="mt-3 text-2xl font-semibold">{agents.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-[#718380]">{tr.agents}</p></article>
                <article className="metric-card"><Activity className="size-4 text-[#7af2c9]" /><p className="mt-3 text-2xl font-semibold">{activeCount}</p><p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-[#718380]">{tr.activeAgents}</p></article>
                <article className="metric-card"><ShieldAlert className={`size-4 ${pendingRequests.length > 0 ? "text-[#ffad6c]" : "text-[#7af2c9]"}`} /><p className="mt-3 text-2xl font-semibold">{pendingRequests.length}</p><p className="mt-1 text-[10px] uppercase tracking-[0.13em] text-[#718380]">{tr.pending}</p></article>
              </section>

              {pendingRequests[0] ? (
                <section className="overflow-hidden rounded-[24px] border border-[#ff9d66]/20 bg-[#ff9d66]/[0.055]">
                  <div className="flex items-start gap-3 border-b border-[#ff9d66]/15 px-5 py-4">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-[#ff9d66]/10 text-[#ffad73]"><ShieldAlert className="size-5" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3"><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#ffb07a]">{tr.approvalRequired}</p><span className="flex items-center gap-1 text-[10px] text-[#8b9b98]"><Clock3 className="size-3" /> {tr.now}</span></div>
                      <h2 className="mt-2 text-base font-semibold leading-snug">{pendingRequests[0].action}</h2>
                      <p className="mt-1 text-xs text-[#8b9b98]">{agents.find((agent) => agent.id === pendingRequests[0].agent_id)?.name ?? tr.aiAgent} · {pendingRequests[0].agent_id}</p>
                    </div>
                  </div>
                  <div className="space-y-3 px-5 py-4 text-xs">
                    <div className="flex justify-between gap-4"><span className="text-[#778986]">{tr.requestedScope}</span><span className="max-w-[65%] break-words text-right text-[#dbe8e5]">{Object.keys(pendingRequests[0].requested_scope).length ? JSON.stringify(pendingRequests[0].requested_scope) : tr.noAdditionalScope}</span></div>
                    <div className="flex justify-between gap-4"><span className="text-[#778986]">{tr.riskScore}</span><span className="text-right font-medium text-[#ffb07a]">{pendingRequests[0].risk_score == null ? tr.notSupplied : `${Math.round(pendingRequests[0].risk_score * 100)}%`}</span></div>
                  </div>
                  <div className="grid grid-cols-[1fr_1.4fr] gap-2.5 px-5 pb-5">
                    <Button onClick={() => resolveApproval(pendingRequests[0].request_id, "rejected")} variant="outline" className="h-11 rounded-xl border-white/10 bg-white/[0.025] text-[#d7e4e1] hover:bg-white/[0.07] hover:text-white"><X className="size-4" /> {tr.reject}</Button>
                    <Button onClick={() => resolveApproval(pendingRequests[0].request_id, "approved")} className="h-11 rounded-xl bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6]"><Check className="size-4" /> {tr.approveOnce}</Button>
                  </div>
                </section>
              ) : (
                <section className="rounded-[24px] border border-[#56e7b8]/15 bg-[#56e7b8]/[0.045] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-[14px] bg-[#56e7b8]/10 text-[#7af2c9]"><ShieldCheck className="size-5" /></div>
                    <div><p className="font-semibold">{tr.noPendingApprovals}</p><p className="mt-1 text-xs text-[#7f918e]">{tr.newRequestsAppear}</p></div>
                  </div>
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{tr.yourAgents}</h2><button onClick={openAgentForm} className="flex items-center gap-1 text-xs font-semibold text-[#7af2c9]"><Plus className="size-3.5" /> {tr.addAgent}</button></div>
                <div className="space-y-2.5">
                  {agents.map((agent) => (
                    <button key={agent.id} onClick={() => { setSelectedAgentId(agent.id); setTab("agents") }} className="group flex w-full items-center gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.027] p-3.5 text-left transition hover:border-white/[0.12] hover:bg-white/[0.045]">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-[15px] border border-white/[0.07] bg-[#111e26] text-[#91a5a1] group-hover:text-[#7af2c9]"><Bot className="size-5" /></div>
                      <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{agent.name}</p><StatusPill status={agent.status} language={language} /></div><p className="mt-1 truncate text-[11px] text-[#748683]">{agent.id} · {agent.model} · {agent.activity}</p></div>
                      <ChevronRight className="size-4 text-[#516360] transition group-hover:translate-x-0.5 group-hover:text-[#91a5a1]" />
                    </button>
                  ))}
                  {agents.length === 0 && <div className="rounded-[20px] border border-dashed border-white/[0.1] px-4 py-7 text-center"><Bot className="mx-auto size-5 text-[#738582]" /><p className="mt-2 text-sm font-medium">{tr.noAgents}</p><p className="mt-1 text-xs text-[#718481]">{tr.addFirstAgent}</p></div>}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="agents" className="space-y-5">
              {selectedAgent ? <>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#718481]">{tr.selectedAgent}</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-[16px] border border-white/[0.08] bg-[#111e26] text-[#7af2c9]"><Bot className="size-6" /></div>
                  <div className="min-w-0 flex-1"><h1 className="truncate text-xl font-semibold">{selectedAgent.name}</h1><p className="mt-1 font-mono text-[11px] text-[#778986]">{selectedAgent.id} · {selectedAgent.model}</p></div>
                  <StatusPill status={selectedAgent.status} language={language} />
                </div>
              </div>

              <section className="rounded-[24px] border border-white/[0.07] bg-white/[0.027] p-4">
                <div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl bg-white/[0.045] text-[#93a6a2]"><Building2 className="size-4" /></div><div className="flex-1"><p className="text-[10px] uppercase tracking-[0.13em] text-[#697b78]">{tr.organization}</p><p className="mt-1 text-sm font-medium">{selectedAgent.organization}</p></div><span className="text-[10px] text-[#7af2c9]">{tr.verified.toUpperCase()}</span></div>
              </section>

              <section>
                <div className="mb-3 flex items-end justify-between"><div><h2 className="text-sm font-semibold">{tr.permissionBoundary}</h2><p className="mt-1 text-xs text-[#718481]">{tr.everyChangeAudited}</p></div><LockKeyhole className="size-4 text-[#7af2c9]" /></div>
                <div className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.027]">
                  {permissionCatalog.map((permissionId, index) => {
                    const permission = selectedAgent.permissions.find((item) => item.id === permissionId)
                    const copy = permissionCopy[language][permissionId]
                    const mode = getPermissionMode(permission)
                    return (
                      <div key={permissionId} className={`flex items-center gap-3 p-4 ${index !== 0 ? "border-t border-white/[0.06]" : ""}`}>
                        <div className="min-w-0 flex-1"><p className="text-sm font-medium">{copy.label}</p><p className="mt-1 text-[11px] leading-4 text-[#718481]">{copy.detail}</p></div>
                        <select value={mode} onChange={(event) => void updatePermissionMode(permissionId, event.target.value as PermissionMode)} aria-label={`${tr.togglePermission}: ${copy.label}`} className={`max-w-[138px] rounded-xl border px-2.5 py-2 text-[11px] font-semibold outline-none ${mode === "allow" ? "border-[#56e7b8]/20 bg-[#56e7b8]/10 text-[#7af2c9]" : mode === "approval" ? "border-[#ffae70]/20 bg-[#ffae70]/10 text-[#ffb77d]" : "border-white/10 bg-white/[0.035] text-[#8b9b98]"}`}>
                          <option value="allow">{tr.allow}</option>
                          <option value="approval">{tr.approvalMode}</option>
                          <option value="deny">{tr.deny}</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              </section>

              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="outline" className="h-12 w-full rounded-[16px] border-white/10 bg-white/[0.025] font-semibold text-[#b9c9c6] hover:bg-white/[0.06] hover:text-white"><KeyRound className="size-4" /> {tr.rotateKey}</Button></AlertDialogTrigger>
                <AlertDialogContent className="border-white/10 bg-[#0d1820] text-[#eef7f4]">
                  <AlertDialogHeader><AlertDialogMedia className="bg-[#56e7b8]/10 text-[#7af2c9]"><KeyRound /></AlertDialogMedia><AlertDialogTitle>{tr.rotateQuestion} {selectedAgent.name}?</AlertDialogTitle><AlertDialogDescription className="text-[#849693]">{tr.rotateDescription}</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.07] hover:text-white">{tr.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => void rotateAgentKey()} className="bg-[#7af2c9] text-[#071017] hover:bg-[#94f7d6]">{tr.rotate}</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {selectedAgent.status === "active" ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild><Button variant="outline" className="h-12 w-full rounded-[16px] border-[#ff765f]/20 bg-[#ff765f]/[0.055] font-semibold text-[#ff9785] hover:bg-[#ff765f]/10 hover:text-[#ffad9e]"><CirclePause className="size-4" /> {tr.emergencyPause}</Button></AlertDialogTrigger>
                  <AlertDialogContent className="border-white/10 bg-[#0d1820] text-[#eef7f4]">
                    <AlertDialogHeader><AlertDialogMedia className="bg-[#ff765f]/10 text-[#ff8d78]"><ShieldAlert /></AlertDialogMedia><AlertDialogTitle>{tr.pauseQuestion} {selectedAgent.name}?</AlertDialogTitle><AlertDialogDescription className="text-[#849693]">{tr.pauseDescription}</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel className="border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.07] hover:text-white">{tr.cancel}</AlertDialogCancel><AlertDialogAction onClick={pauseAgent} variant="destructive">{tr.pauseAgent}</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button onClick={restoreAgent} className="h-12 w-full rounded-[16px] bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6]"><Zap className="size-4" /> {tr.restoreAgent}</Button>
              )}

              <section>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#718481]">{tr.switchAgent}</p>
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">{agents.map((agent) => <button key={agent.id} onClick={() => setSelectedAgentId(agent.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-xs ${selectedAgent.id === agent.id ? "border-[#56e7b8]/30 bg-[#56e7b8]/10 text-[#7af2c9]" : "border-white/[0.07] bg-white/[0.025] text-[#8fa09d]"}`}>{agent.name}</button>)}</div>
              </section>
              </> : <section className="rounded-[24px] border border-dashed border-white/[0.1] px-5 py-10 text-center"><Bot className="mx-auto size-6 text-[#738582]" /><h1 className="mt-3 text-lg font-semibold">{tr.noAgents}</h1><p className="mt-2 text-sm text-[#718481]">{tr.createFirstFromHome}</p><Button onClick={() => setTab("overview")} className="mt-5 bg-[#7af2c9] text-[#071017] hover:bg-[#94f7d6]">{tr.backHome}</Button></section>}
            </TabsContent>

            <TabsContent value="audit" className="space-y-5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-[#718481]">{tr.immutableRecord}</p><h1 className="mt-2 text-2xl font-semibold">{tr.auditTrail}</h1><p className="mt-2 text-sm leading-6 text-[#7f918e]">{tr.auditDescription}</p></div>
              <div className="space-y-3">
                {auditEvents.map((event, index) => (
                  <article key={event.event_id} className="relative flex gap-3 rounded-[20px] border border-white/[0.07] bg-white/[0.027] p-4">
                    {index < auditEvents.length - 1 && <div className="absolute left-[33px] top-[52px] h-[28px] w-px bg-white/[0.08]" />}
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#56e7b8]/10 text-[#7af2c9]"><ScrollText className="size-4" /></div>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{auditEventNames[language][event.event_type] ?? event.event_type.replaceAll(".", " ")}</p><p className="mt-1 break-words text-[11px] text-[#718481]">{event.agent_id ? `${event.agent_id} · ` : ""}{Object.keys(event.event_data).length ? JSON.stringify(event.event_data) : administratorId}</p></div><span className="text-right text-[10px] text-[#596a67]">{new Date(event.created_at).toLocaleString(language === "ru" ? "ru-RU" : "en-US")}</span>
                  </article>
                ))}
                {auditEvents.length === 0 && <div className="rounded-[20px] border border-dashed border-white/[0.1] px-4 py-7 text-center"><ScrollText className="mx-auto size-5 text-[#738582]" /><p className="mt-2 text-sm font-medium">{tr.noAuditEvents}</p></div>}
              </div>
              <div className="rounded-[20px] border border-dashed border-white/[0.1] px-4 py-5 text-center"><ScrollText className="mx-auto size-5 text-[#738582]" /><p className="mt-2 text-xs text-[#718481]">{tr.auditLoaded}</p></div>
            </TabsContent>

            <TabsContent value="profile" className="space-y-5">
              <div className="flex flex-col items-center py-4 text-center"><div className="relative flex size-20 items-center justify-center rounded-[27px] border border-[#56e7b8]/20 bg-[#56e7b8]/10 text-2xl font-semibold text-[#7af2c9]">{administratorInitials}<span className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-4 border-[#071017] bg-[#56e7b8] text-[#071017]"><Check className="size-3.5" strokeWidth={3} /></span></div><h1 className="mt-4 text-xl font-semibold">{administratorName}</h1><p className="mt-1 font-mono text-xs text-[#7e908d]">{administratorId}</p><p className="mt-1 text-xs text-[#60726f]">{telegramIdentity}</p></div>
              <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.027]">
                {[
                  [Fingerprint, tr.identity, telegramUser ? `${telegramIdentity} ${tr.connected}` : tr.readyForTelegram],
                  [Building2, tr.organization, organizationName],
                  [ShieldCheck, tr.operationalRecord, tr.noIncidents],
                  [KeyRound, tr.secondFactor, tr.notConnected],
                ].map(([Icon, label, value], index) => (
                  <button key={label as string} onClick={() => toast.info(label as string, { description: value as string })} className={`flex w-full items-center gap-3 p-4 text-left ${index !== 0 ? "border-t border-white/[0.06]" : ""}`}><div className="flex size-9 items-center justify-center rounded-xl bg-white/[0.045] text-[#8fa29e]"><Icon className="size-4" /></div><div className="flex-1"><p className="text-xs text-[#728481]">{label as string}</p><p className="mt-1 text-sm font-medium">{value as string}</p></div><ChevronRight className="size-4 text-[#50615e]" /></button>
                ))}
              </section>
              <div className="rounded-[22px] border border-[#56e7b8]/15 bg-[#56e7b8]/[0.045] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#7af2c9]" /><div><p className="text-sm font-medium">{tr.trustTitle}</p><p className="mt-1.5 text-xs leading-5 text-[#78908a]">{tr.trustDescription}</p></div></div></div>
              {!telegramUser && <Button asChild className="h-12 w-full rounded-[16px] bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6]"><a href="https://t.me/AIAdminRegistryBot?startapp=registry" target="_blank" rel="noreferrer"><Zap className="size-4" /> {tr.openTelegramBot}</a></Button>}
            </TabsContent>
          </div>

          <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[520px] -translate-x-1/2 border-t border-white/[0.07] bg-[#081219]/94 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
            <TabsList className="grid h-auto w-full grid-cols-4 bg-transparent p-0">
              {[
                ["overview", LayoutDashboard, tr.home],
                ["agents", Bot, tr.agents],
                ["audit", ScrollText, tr.audit],
                ["profile", UserRound, tr.profile],
              ].map(([value, Icon, label]) => (
                <TabsTrigger key={value as string} value={value as string} className="flex h-[54px] flex-col gap-1 rounded-xl bg-transparent text-[10px] text-[#61726f] shadow-none after:hidden data-[state=active]:bg-[#56e7b8]/[0.07] data-[state=active]:text-[#7af2c9] dark:data-[state=active]:border-transparent dark:data-[state=active]:bg-[#56e7b8]/[0.07]"><Icon className="size-[18px]" />{label as string}</TabsTrigger>
              ))}
            </TabsList>
          </nav>
        </Tabs>
      </div>
      {agentFormOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="create-agent-title">
          <div className="max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-[26px] border border-white/10 bg-[#0d1820] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 id="create-agent-title" className="text-xl font-semibold">{tr.createAgentTitle}</h2><p className="mt-1 text-sm leading-5 text-[#849693]">{tr.createAgentDescription}</p></div>
              <button onClick={() => setAgentFormOpen(false)} aria-label={tr.close} className="flex size-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#91a29f]"><X className="size-4" /></button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#aebfbb]">{tr.agentName}</span><input autoFocus value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder={tr.agentNamePlaceholder} className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm outline-none placeholder:text-[#50615e] focus:border-[#56e7b8]/40" /></label>
              <label className="block"><span className="mb-2 block text-xs font-semibold text-[#aebfbb]">{tr.model}</span><input value={agentModel} onChange={(event) => setAgentModel(event.target.value)} placeholder={tr.modelPlaceholder} className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm outline-none placeholder:text-[#50615e] focus:border-[#56e7b8]/40" /></label>
              <div><p className="mb-2 text-xs font-semibold text-[#aebfbb]">{tr.permissionsTitle}</p><div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                {permissionCatalog.map((permissionId, index) => (
                  <div key={permissionId} className={`flex items-center gap-3 bg-white/[0.02] p-3 ${index ? "border-t border-white/[0.06]" : ""}`}>
                    <div className="min-w-0 flex-1"><p className="text-sm font-medium">{permissionCopy[language][permissionId].label}</p><p className="mt-0.5 text-[10px] leading-4 text-[#718481]">{permissionCopy[language][permissionId].detail}</p></div>
                    <select value={agentPermissionModes[permissionId]} onChange={(event) => setAgentPermissionModes((current) => ({ ...current, [permissionId]: event.target.value as PermissionMode }))} className="max-w-[138px] rounded-xl border border-white/10 bg-[#111e26] px-2 py-2 text-[11px] font-semibold text-[#c5d4d1] outline-none">
                      <option value="allow">{tr.allow}</option><option value="approval">{tr.approvalMode}</option><option value="deny">{tr.deny}</option>
                    </select>
                  </div>
                ))}
              </div></div>
              <Button onClick={() => void addAgent()} disabled={isCreatingAgent} className="h-12 w-full rounded-[16px] bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6] disabled:opacity-60"><Plus className="size-4" /> {isCreatingAgent ? tr.creatingAgent : tr.createAgent}</Button>
            </div>
          </div>
        </div>
      )}

      {credential && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="credential-title">
          <div className="max-h-[94dvh] w-full max-w-[480px] overflow-y-auto rounded-[26px] border border-[#56e7b8]/20 bg-[#0d1820] p-5 shadow-2xl">
            <div className="flex size-11 items-center justify-center rounded-[15px] bg-[#56e7b8]/10 text-[#7af2c9]"><KeyRound className="size-5" /></div>
            <h2 id="credential-title" className="mt-4 text-xl font-semibold">{tr.credentialsTitle}</h2><p className="mt-2 text-sm leading-6 text-[#849693]">{tr.credentialsDescription}</p>
            <div className="mt-5 space-y-3">
              {[[tr.apiAddress, apiBaseUrl], [tr.agentId, credential.agentId], [tr.agentKey, credential.agentKey]].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-[#718481]">{label}</p><div className="mt-2 flex items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-[#dbe8e5]">{value}</code><button onClick={() => { void navigator.clipboard?.writeText(value); toast.success(tr.copied) }} aria-label={`${tr.copy}: ${label}`} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-[#9dafac]"><Copy className="size-4" /></button></div></div>
              ))}
            </div>
            <div className="mt-4 rounded-2xl border border-[#ffae70]/20 bg-[#ffae70]/[0.07] p-3 text-xs leading-5 text-[#ffc28e]"><ShieldAlert className="mr-2 inline size-4" />{tr.keepSecret}</div>
            <div className="mt-5"><h3 className="text-sm font-semibold">{tr.integrationTitle}</h3><p className="mt-1 text-xs leading-5 text-[#849693]">{tr.envHint}</p><pre className="mt-3 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#071017] p-3 text-[10px] leading-5 text-[#9fd8c5]">{curlExample}</pre></div>
            <Button onClick={() => setCredential(null)} className="mt-5 h-12 w-full rounded-[16px] bg-[#7af2c9] font-bold text-[#071017] hover:bg-[#94f7d6]"><Check className="size-4" /> {tr.keySaved}</Button>
          </div>
        </div>
      )}
      <Toaster position="top-center" />
    </main>
  )
}
