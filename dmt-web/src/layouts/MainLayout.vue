<template>
  <div class="flex min-h-screen bg-[#F7F8FA] text-[#1D2129]">
    <aside class="fixed inset-y-0 z-30 flex w-[220px] flex-col border-r border-[#E5E6EB] bg-white">
      <div class="flex h-14 items-center gap-2.5 border-b border-[#F2F3F5] px-4">
        <span class="flex h-8 w-8 items-center justify-center rounded-[8px] bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-sm font-bold text-white shadow-md">D</span>
        <div class="leading-tight">
          <div class="text-[14px] font-semibold">DMT-ERP</div>
          <div class="text-[11px] text-[#86909C]">交付与核算系统</div>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-2 py-3">
        <template v-for="g in visibleGroups" :key="g.group">
          <div class="mb-2">
            <div class="px-3 pb-1 pt-2 text-[12px] text-[#86909C]">{{ g.group }}</div>
            <template v-for="n in g.items" :key="n.to">
              <div>
                <div
                  class="mb-0.5 flex h-10 items-center gap-2.5 rounded-[2px] pr-2 transition-colors"
                  :class="isActive(n) ? 'bg-[#F2F3F5] font-medium text-[#165DFF]' : 'text-[#4E5969] hover:bg-[#F7F8FA]'"
                >
                  <router-link :to="n.to" class="flex h-full flex-1 items-center gap-2.5 px-3 text-[14px]">
                    <component :is="n.icon" :size="16" :stroke-width="1.8" />
                    {{ n.label }}
                    <span
                      v-if="n.label === '审批中心' && pendingCount > 0"
                      class="ml-auto flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-[#F53F3F] px-1 text-[11px] text-white"
                    >{{ pendingCount }}</span>
                  </router-link>
                  <button
                    v-if="n.children?.length"
                    class="rounded-[2px] p-0.5 text-[#86909C] hover:bg-[#E5E6EB]"
                    @click="toggleOpen(n.to)"
                  >
                    <ChevronDown v-if="isOpen(n)" :size="14" />
                    <ChevronRight v-else :size="14" />
                  </button>
                </div>
                <template v-if="n.children?.length && isOpen(n)">
                  <router-link
                    v-for="c in n.children"
                    :key="c.to"
                    :to="c.to"
                    class="mb-0.5 flex h-9 items-center gap-2 rounded-[2px] py-1 pl-9 pr-3 text-[13px] transition-colors"
                    :class="$route.path === c.to ? 'font-medium text-[#165DFF]' : 'text-[#4E5969] hover:bg-[#F7F8FA]'"
                  >
                    <span class="h-1 w-1 rounded-full" :class="$route.path === c.to ? 'bg-[#165DFF]' : 'bg-[#C9CDD4]'" />
                    {{ c.label }}
                  </router-link>
                </template>
              </div>
            </template>
          </div>
        </template>
      </nav>

      <div class="border-t border-[#F2F3F5] p-3">
        <div class="flex items-center gap-2.5 px-1">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[13px] font-medium text-white shadow-md">{{ initial }}</span>
          <div class="min-w-0 flex-1 text-[12px] leading-tight">
            <div class="truncate font-medium text-[#1D2129]">{{ auth.profileData?.user?.name ?? '—' }}</div>
            <div class="mt-0.5 truncate text-[#86909C]">{{ roleName }}</div>
          </div>
          <button
            title="退出登录"
            class="shrink-0 rounded-[2px] border border-[#E5E6EB] px-1.5 py-0.5 text-[10px] text-[#86909C] hover:bg-[#FFECE8] hover:text-[#F53F3F]"
            @click="doLogout"
          >退出</button>
        </div>
      </div>
    </aside>

    <div class="ml-[220px] min-w-0 flex-1">
      <header class="sticky top-0 z-20 flex h-14 items-center gap-4 border-b border-[#E5E6EB] bg-white px-6">
        <div class="flex min-w-0 items-center gap-1.5 text-[14px]">
          <span class="shrink-0 text-[#86909C]">首页</span>
          <ChevronRight :size="14" class="shrink-0 text-[#C9CDD4]" />
          <span class="truncate text-[#1D2129]">{{ crumb }}</span>
        </div>
        <div class="mx-auto hidden md:block">
          <GlobalSearch />
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-4">
          <button
            class="relative flex h-9 w-9 items-center justify-center rounded-[4px] text-[#4E5969] hover:bg-[#F2F3F5]"
            title="通知中心"
            @click="$router.push('/notifications')"
          >
            <Bell :size="17" :stroke-width="1.8" />
            <span
              v-if="unreadCount > 0"
              class="absolute -right-0.5 -top-0.5 flex h-[16px] min-w-[16px] items-center justify-center rounded-[8px] bg-[#F53F3F] px-1 text-[10px] text-white"
            >{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </button>
          <span class="hidden rounded-[2px] bg-[#F0F5FF] px-1.5 py-0.5 text-[11px] text-[#165DFF] lg:block">{{ roleName }}</span>
          <span class="hidden text-[13px] tabular-nums text-[#86909C] lg:block">{{ dateStr }}</span>
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] text-[13px] font-medium text-white shadow-md ring-2 ring-white">{{ initial }}</span>
        </div>
      </header>

      <router-view v-if="guardOk" />
      <main v-else class="flex min-h-[70vh] items-center justify-center p-6">
        <div class="w-[420px] max-w-full rounded-[8px] border border-[#E5E6EB] bg-white p-8 text-center shadow-sm">
          <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FFECE8] text-[#F53F3F]"><ShieldAlert :size="22" /></span>
          <div class="mt-3 text-[15px] font-semibold text-[#1D2129]">当前角色无权访问该页面</div>
          <div class="mt-1.5 text-[12px] leading-5 text-[#86909C]">
            你正以「{{ roleName }}」身份查看系统，该角色未开通「{{ crumb }}」的菜单权限。
            如需访问，请联系系统管理员开通。
          </div>
          <div class="mt-4 flex justify-center gap-2">
            <button class="rounded-[2px] bg-[#165DFF] px-3 py-1.5 text-[12px] text-white hover:bg-[#4080FF]" @click="$router.push('/workbench')">返回工作台</button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, ChevronRight, ChevronDown, ShieldAlert } from 'lucide-vue-next'
import { NAV_GROUPS, type NavItem } from './navConfig'
import { useAuthStore } from '../stores/auth'
import GlobalSearch from '../components/GlobalSearch.vue'
import { notificationUnreadCount } from '../api/sys'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const openGroups = reactive<Record<string, boolean>>({})
const pendingCount = ref(0)
const unreadCount = ref(0)

onMounted(async () => {
  try {
    unreadCount.value = (await notificationUnreadCount()).count ?? 0
  } catch {
    unreadCount.value = 0
  }
})

const roleName = computed(() => {
  const roles = auth.profileData?.roles ?? []
  if (roles.includes('ADMIN')) return '系统管理员'
  const map: Record<string, string> = {
    OPS: '业务支撑部', TECH: '技术部', SALES: '销售部', FIN: '财务', MANAGER: '管理层',
  }
  return map[roles[0]] ?? roles[0] ?? '—'
})

const initial = computed(() => (auth.profileData?.user?.name ?? '?').slice(0, 1))

const today = new Date()
const wd = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][today.getDay()]
const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')} ${wd}`

const crumb = computed(() => {
  for (const g of NAV_GROUPS) {
    for (const n of g.items) {
      if (n.to === route.path) return n.label
      if (n.children?.some((c) => c.to === route.path)) {
        return n.children.find((c) => c.to === route.path)!.label
      }
    }
  }
  // 子路径（如 /contract/edit）回退到所属菜单名
  let best = ''
  for (const g of NAV_GROUPS) {
    for (const n of g.items) {
      if (route.path.startsWith(n.to + '/') && n.to.length > best.length) best = n.label
    }
  }
  return best || '工作台'
})

function canSee(item: NavItem) {
  if (item.open) {
    return true
  }
  if (!item.perm) {
    return (auth.profileData?.roles ?? []).includes('ADMIN')
  }
  return auth.hasPerm(item.perm) || (auth.profileData?.roles ?? []).includes('ADMIN')
}

const visibleGroups = computed(() =>
  NAV_GROUPS.map((g) => ({ group: g.group, items: g.items.filter(canSee) })).filter((g) => g.items.length > 0),
)

function isActive(item: NavItem) {
  if (route.path === item.to) return true
  return item.children?.some((c) => route.path === c.to || route.path.startsWith(c.to)) ?? false
}

function isOpen(item: NavItem) {
  if (item.to in openGroups) return openGroups[item.to]
  return isActive(item)
}

function toggleOpen(to: string) {
  openGroups[to] = !(openGroups[to] ?? false)
}

const guardOk = computed(() => {
  if (route.path === '/workbench') return true
  for (const g of NAV_GROUPS) {
    for (const n of g.items) {
      if (n.to === route.path) return canSee(n)
      if (n.children?.some((c) => c.to === route.path)) return true // 子页跟随父级菜单
    }
  }
  return true
})

async function doLogout() {
  await auth.logout()
  router.push('/login')
}
</script>
