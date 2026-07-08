'use client'
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

export const dynamic = 'force-dynamic'
export const experimental_ppr = false

interface Outlet {
  id: number
  name: string
}

interface MenuItem {
  id: string
  name: string
  price: number
  isCombo: boolean
  recipe: { ingredient: string; qty: number }[]
}

interface InventoryItem {
  id: number
  outlet_id: number
  item_name: string
  stock_on_first: number
}

interface ReplenishmentLog {
  id: number
  outlet_id: number
  item_name: string
  day_of_month: number
  quantity_added: number
  created_at: string
}

interface SalesLog {
  id: number
  outlet_id: number
  item_name: string
  quantity_sold: number
  date_string?: string 
  created_at: string
}

interface TerminalSession {
  outlet_id: number
  is_logged_in: boolean
  last_active_at: string
  device_token?: string
}

export default function Home() {
  const [currentMode, setCurrentMode] = useState<'gate' | 'outlet' | 'promoter'>('gate')
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [allReplenishments, setAllReplenishments] = useState<ReplenishmentLog[]>([])
  const [allSalesHistory, setAllSalesHistory] = useState<SalesLog[]>([])
  const [terminalSessions, setTerminalSessions] = useState<TerminalSession[]>([])
  const [loading, setLoading] = useState(false)
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({})

  // NOTIFICATION BANNER STATE
  const [notification, setNotification] = useState<string | null>(null)

  // NAVIGATION TABS CONTROLLERS
  const [promoterTab, setPromoterTab] = useState<'overview' | 'branches' | 'revenue_matrix' | 'dispatches' | 'security'>('overview')
  const [outletTab, setOutletTab] = useState<'counter' | 'ledger' | 'received_stock'>('counter')
  const [promoterActiveTab, setPromoterActiveTab] = useState<'consumption' | 'dispatches'>('consumption')

  // EXPLICIT SEPARATE CALENDAR DATETIME PICKERS
  const [overviewStartDate, setOverviewStartDate] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [overviewEndDate, setOverviewEndDate] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })

  const [branchCardDateRanges, setBranchCardDateRanges] = useState<{ [key: number]: { start: string; end: string } }>(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const initialRange = { start: `${yyyy}-${mm}-01`, end: `${yyyy}-${mm}-${dd}` }
    return { 1: initialRange, 2: initialRange, 3: initialRange, 4: initialRange, 5: initialRange, 6: initialRange }
  })

  // DEDICATED SEPARATE RANGES STATE MAPPED FOR REVENUE MATRIX VIEW
  const [revMatrixDateRanges, setRevMatrixDateRanges] = useState<{ [key: number]: { start: string; end: string } }>(() => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const initialRange = { start: `${yyyy}-${mm}-01`, end: `${yyyy}-${mm}-${dd}` }
    return { 1: initialRange, 2: initialRange, 3: initialRange, 4: initialRange, 5: initialRange, 6: initialRange }
  })

  // INDEPENDENT CALENDAR PICKER FOR OUTLET RECEIVED STOCK TAB
  const [outletReceivedStart, setOutletReceivedStart] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [outletReceivedEnd, setOutletReceivedEnd] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })

  // EXPLICIT MANUAL DISTRIBUTION DISPATCH FORM CONTROL FIELDS
  const [dispatchOutletId, setDispatchOutletId] = useState<number>(1)
  const [dispatchItemName, setDispatchItemName] = useState<string>('Egg')
  const [dispatchQty, setDispatchQty] = useState<number>(0)
  const [dispatchDate, setDispatchDate] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })

  const getTodayDateString = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const liveOperatingDate = getTodayDateString()
  
  const [outletPeriodStart, setOutletPeriodStart] = useState<string>(getTodayDateString())
  const [outletPeriodEnd, setOutletPeriodEnd] = useState<string>(getTodayDateString())

  const [auditStartDate, setAuditStartDate] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [auditEndDate, setAuditEndDate] = useState<string>(getTodayDateString())
  const [auditIngredient, setAuditIngredient] = useState<string>('ALL')
  const [auditOutletFilter, setAuditOutletFilter] = useState<string>('ALL')

  const outlets: Outlet[] = [
    { id: 1, name: 'Outlet 1' }, { id: 2, name: 'Outlet 2' }, { id: 3, name: 'Outlet 3' },
    { id: 4, name: 'Outlet 4' }, { id: 5, name: 'Outlet 5' }, { id: 6, name: 'Outlet 6' },
  ]

  const menuItems: MenuItem[] = [
    { id: 'i1', name: 'Item 1', price: 10, isCombo: false, recipe: [{ ingredient: 'Egg', qty: 1 }, { ingredient: 'Boxes', qty: 1 }] },
    { id: 'i2', name: 'Item 2', price: 12, isCombo: false, recipe: [{ ingredient: 'Wheat', qty: 1 }, { ingredient: 'Boxes', qty: 1 }] },
    { id: 'i3', name: 'Item 3', price: 15, isCombo: false, recipe: [{ ingredient: 'Ing3', qty: 1 }, { ingredient: 'Boxes', qty: 1 }] },
    { id: 'i4', name: 'Item 4', price: 18, isCombo: false, recipe: [{ ingredient: 'Ing4', qty: 1 }, { ingredient: 'Boxes', qty: 1 }] },
    { id: 'i5', name: 'Item 5', price: 20, isCombo: false, recipe: [{ ingredient: 'Ing5', qty: 1 }, { ingredient: 'Boxes', qty: 1 }] },
    { id: 'i6', name: 'Item 6', price: 25, isCombo: false, recipe: [{ ingredient: 'Water bottle', qty: 1 }] },
    
    { id: 'c1', name: 'Combo 1', price: 35, isCombo: true, recipe: [{ ingredient: 'Egg', qty: 2 }, { ingredient: 'Wheat', qty: 2 }, { ingredient: 'Boxes', qty: 1 }] },
    { id: 'c2', name: 'Combo 2', price: 45, isCombo: true, recipe: [{ ingredient: 'Ing3', qty: 2 }, { ingredient: 'Ing4', qty: 2 }, { ingredient: 'Boxes', qty: 1 }] },
    { id: 'c3', name: 'Combo 3', price: 50, isCombo: true, recipe: [{ ingredient: 'Egg', qty: 2 }, { ingredient: 'Ing5', qty: 2 }, { ingredient: 'Boxes', qty: 2 }] },
    { id: 'c4', name: 'Combo 4', price: 60, isCombo: true, recipe: [{ ingredient: 'Egg', qty: 2 }, { ingredient: 'Wheat', qty: 2 }, { ingredient: 'Water bottle', qty: 2 }, { ingredient: 'Boxes', qty: 2 }] },
  ]

  const distinctIngredients = ['Egg', 'Wheat', 'Ing3', 'Ing4', 'Ing5', 'Water bottle', 'Boxes']

  const formatIngredientLabel = (name: string) => {
    if (name === 'Egg') return 'ing1'
    if (name === 'Wheat') return 'ing2'
    return name
  }

  const getOrCreateDeviceSignatureToken = () => {
    if (typeof window === 'undefined') return ''
    let token = localStorage.getItem('omk_device_signature_token')
    if (!token) {
      token = 'dev_hash_' + Math.random().toString(36).substring(2, 15) + Date.now()
      localStorage.setItem('omk_device_signature_token', token)
    }
    return token
  }

  // FALLBACK DATE STRIPPER TOOL: Ensures seamless reading of old/new date styles safely
  const resolveTargetRowDate = (s: SalesLog) => {
    if (s.date_string && s.date_string.trim().length === 10) {
      return s.date_string
    }
    return s.created_at ? s.created_at.split('T')[0] : liveOperatingDate
  }

  useEffect(() => {
    const savedMode = localStorage.getItem('omk_current_mode')
    const savedOutletId = localStorage.getItem('omk_selected_outlet_id')
    if (savedMode) {
      setCurrentMode(savedMode as any)
      if (savedMode === 'outlet' && savedOutletId) {
        const matchingStore = outlets.find(o => o.id === Number(savedOutletId))
        if (matchingStore) setSelectedOutlet(matchingStore)
      }
    }
  }, [])

  useEffect(() => {
    const fetchSecuritySessions = async () => {
      const { data } = await supabase.from('counter_sessions').select('*')
      if (data) setTerminalSessions(data)
    }
    fetchSecuritySessions()
    const interval = setInterval(fetchSecuritySessions, 12000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (currentMode === 'outlet' && selectedOutlet) {
      const currentDeviceToken = getOrCreateDeviceSignatureToken()
      const maintainHeartbeatAndPollAlerts = async () => {
        const { data } = await supabase.from('counter_sessions').select('*').eq('outlet_id', selectedOutlet.id).maybeSingle()
        if (data && (!data.is_logged_in || (data.device_token && data.device_token !== currentDeviceToken))) {
          alert('Security Alert: This session has been accessed on another physical layout device or force-cleared.')
          exitToGateway()
        } else {
          await supabase.from('counter_sessions').upsert({
            outlet_id: selectedOutlet.id,
            is_logged_in: true,
            last_active_at: new Date().toISOString(),
            device_token: currentDeviceToken
          })
        }
      }
      maintainHeartbeatAndPollAlerts()
      const hbInterval = setInterval(maintainHeartbeatAndPollAlerts, 10000)
      syncGlobalDatabaseData(selectedOutlet.id)
      return () => clearInterval(hbInterval)
    } else if (currentMode === 'promoter') {
      syncGlobalDatabaseData()
    }
  }, [currentMode, selectedOutlet])

  const triggerAlertPushBanner = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 5000)
  }

  const syncGlobalDatabaseData = async (targetOutletId?: number) => {
    setLoading(true)
    const invQuery = supabase.from('inventory').select('*')
    const repQuery = supabase.from('inventory_replenishments').select('*')
    const salesQuery = supabase.from('sales_history').select('*')

    if (targetOutletId) {
      invQuery.eq('outlet_id', targetOutletId)
      salesQuery.eq('outlet_id', targetOutletId)
    }

    const { data: iData } = await invQuery.order('id', { ascending: true })
    const { data: rData } = await repQuery.order('id', { ascending: false })
    const { data: sData } = await salesQuery.order('id', { ascending: false })

    if (iData) setInventory(iData)
    if (rData) setAllReplenishments(rData)
    if (sData) setAllSalesHistory(sData)
    setLoading(false)
  }

  const handleSystemGateUnlock = async () => {
    if (!selectedOutlet) {
      if (passwordInput === 'OmkarAdmin#2026') {
        setCurrentMode('promoter')
        localStorage.setItem('omk_current_mode', 'promoter')
        setErrorMessage('')
        setPasswordInput('')
      } else {
        setErrorMessage('Access Denied: Invalid Master Promoter Credentials.')
      }
    } else {
      const secureOutletKeys: { [key: number]: string } = {
        1: 'Omk_K7x2_Plq1', 2: 'Omk_M4v9_Ztr2', 3: 'Omk_F8w1_Njk3',
        4: 'Omk_B3c8_Xyp4', 5: 'Omk_R9t5_Dwb5', 6: 'Omk_L2s6_Mhv6',
      }

      const verifiedTargetKey = secureOutletKeys[selectedOutlet.id]
      if (passwordInput === verifiedTargetKey) {
        const { data: liveSessionCheck } = await supabase.from('counter_sessions').select('*').eq('outlet_id', selectedOutlet.id).maybeSingle()
        const currentDeviceToken = getOrCreateDeviceSignatureToken()
        
        if (liveSessionCheck && liveSessionCheck.is_logged_in && liveSessionCheck.device_token !== currentDeviceToken) {
          const pastActiveTimestamp = new Date(liveSessionCheck.last_active_at).getTime()
          const exactMinutesDiff = (Date.now() - pastActiveTimestamp) / 1000 / 60
          if (exactMinutesDiff < 5) {
            setErrorMessage(`Access Blocked: This counter terminal is currently open on another physical screen.`);
            return
          }
        }

        await supabase.from('counter_sessions').upsert({
          outlet_id: selectedOutlet.id,
          is_logged_in: true,
          last_active_at: new Date().toISOString(),
          device_token: currentDeviceToken
        })

        setCurrentMode('outlet')
        localStorage.setItem('omk_current_mode', 'outlet')
        localStorage.setItem('omk_selected_outlet_id', String(selectedOutlet.id))
        setErrorMessage('')
        setPasswordInput('')
      } else {
        setErrorMessage(`Invalid Verification Key for ${selectedOutlet.name}.`)
      }
    }
  }

  const handleForceTerminateSession = async (outletId: number) => {
    await supabase.from('counter_sessions').upsert({
      outlet_id: outletId,
      is_logged_in: false,
      last_active_at: new Date().toISOString(),
      device_token: ''
    })
    const { data } = await supabase.from('counter_sessions').select('*')
    if (data) setTerminalSessions(data)
    triggerAlertPushBanner(`Terminal session security flag cleared for Outlet ${outletId}.`)
  }

  const getCalculatedItem = (itemName: string, baseStock: number, targetOutletId: number) => {
    const totalReplenished = allReplenishments.filter(r => {
      return r.outlet_id === targetOutletId && r.item_name === itemName
    }).reduce((a, c) => a + Number(c.quantity_added), 0)

    const totalUsedEver = allSalesHistory.filter(s => {
      if (distinctIngredients.includes(s.item_name)) {
        return s.item_name === itemName && s.outlet_id === targetOutletId
      }
      const menuRef = menuItems.find(m => m.name === s.item_name)
      return s.outlet_id === targetOutletId && (menuRef?.recipe.find(r => r.ingredient === itemName)?.qty || 0) > 0
    }).reduce((a, c) => {
      if (distinctIngredients.includes(c.item_name)) return a + Number(c.quantity_sold)
      const menuRef = menuItems.find(m => m.name === c.item_name)
      const ingUsage = menuRef?.recipe.find(r => r.ingredient === itemName)?.qty || 0
      return a + (Number(c.quantity_sold) * ingUsage)
    }, 0)
    
    const usedToday = allSalesHistory.filter(s => {
      const matchesDate = resolveTargetRowDate(s) === liveOperatingDate
      if (!matchesDate || s.outlet_id !== targetOutletId) return false
      if (s.item_name === itemName) return true
      const menuRef = menuItems.find(m => m.name === s.item_name)
      return (menuRef?.recipe.find(r => r.ingredient === itemName)?.qty || 0) > 0
    }).reduce((a, c) => {
      if (c.item_name === itemName) return a + Number(c.quantity_sold)
      const menuRef = menuItems.find(m => m.name === c.item_name)
      const ingUsage = menuRef?.recipe.find(r => r.ingredient === itemName)?.qty || 0
      return a + (Number(c.quantity_sold) * ingUsage)
    }, 0)

    const currentStockLeft = Number(baseStock) + totalReplenished - totalUsedEver
    return { usedToday, currentStockLeft }
  }

  const getOutletSalesStatsForDateRange = (targetOutletId: number, startDay: string, endDay: string) => {
    let salesAmountTotal = 0
    let transactionsLoggedCount = 0
    let totalItemsDispatchedCount = 0

    allSalesHistory.forEach(s => {
      const rowDateStr = resolveTargetRowDate(s)
      if (s.outlet_id === targetOutletId && rowDateStr >= startDay && rowDateStr <= endDay) {
        if (s.item_name === 'Boxes') {
          transactionsLoggedCount += s.quantity_sold
        } else if (!distinctIngredients.includes(s.item_name)) {
          totalItemsDispatchedCount += s.quantity_sold
          salesAmountTotal += (s.quantity_sold * (menuItems.find(m => m.name === s.item_name)?.price || 0))
        }
      }
    })

    return { salesAmountTotal, transactionsLoggedCount, totalItemsDispatchedCount }
  }

  const getProductSalesPerformanceBreakdown = (targetOutletId: number | 'ALL', startDay: string, endDay: string) => {
    return menuItems.map(menuItem => {
      const unitsSold = allSalesHistory.filter(s => {
        const matchesOutlet = targetOutletId === 'ALL' || s.outlet_id === targetOutletId
        const matchesRange = resolveTargetRowDate(s) >= startDay && resolveTargetRowDate(s) <= endDay
        return s.item_name === menuItem.name && matchesOutlet && matchesRange
      }).reduce((a, c) => a + Number(c.quantity_sold), 0)

      return { ...menuItem, unitsSold, itemRevenue: unitsSold * menuItem.price }
    })
  }

  const getTopPerformerLabel = (targetOutletId: number | 'ALL', startDay: string, endDay: string) => {
    const list = getProductSalesPerformanceBreakdown(targetOutletId, startDay, endDay)
    const sorted = [...list].sort((a, b) => b.unitsSold - a.unitsSold)
    return sorted[0] && sorted[0].unitsSold > 0 ? sorted[0].name : 'None'
  }

  const handleExecuteStockDispatch = async () => {
    if (dispatchQty <= 0) return alert('Please enter a valid stock volume amount')
    const dayIndexInteger = new Date(dispatchDate).getDate()

    await supabase.from('inventory_replenishments').insert({
      outlet_id: dispatchOutletId,
      item_name: dispatchItemName,
      day_of_month: dayIndexInteger,
      quantity_added: dispatchQty,
      created_at: new Date(dispatchDate).toISOString()
    })

    triggerAlertPushBanner(`Stock Dispatch Successfully Received & Computed! Sent +${dispatchQty} units to Outlet ${dispatchOutletId}.`)
    setDispatchQty(0)
    syncGlobalDatabaseData()
  }

  const handlePunchOrder = async () => {
    if (orderTotal === 0) return alert('Please select menu item additions.')
    if (!selectedOutlet) return

    const totalNeeded: { [key: string]: number } = {}
    menuItems.forEach(item => {
      const orderQty = quantities[item.id] || 0
      if (orderQty > 0) {
        item.recipe.forEach(r => { totalNeeded[r.ingredient] = (totalNeeded[r.ingredient] || 0) + (r.qty * orderQty) })
      }
    })

    let shortItem = ''
    for (const inv of inventory) {
      const { currentStockLeft } = getCalculatedItem(inv.item_name, inv.stock_on_first, selectedOutlet.id)
      if (currentStockLeft - (totalNeeded[inv.item_name] || 0) < 0) shortItem = inv.item_name
    }
    if (shortItem) return alert(`Insufficient quantities for ${formatIngredientLabel(shortItem)}`)

    const activeLocalStamp = getTodayDateString()

    for (const item of menuItems) {
      const selectedVolumeCount = quantities[item.id] || 0
      if (selectedVolumeCount > 0) {
        // Try passing both fields safely to never fail table insertion parameters
        await supabase.from('sales_history').insert({
          outlet_id: selectedOutlet.id,
          item_name: item.name,
          quantity_sold: selectedVolumeCount,
          date_string: activeLocalStamp,
          created_at: new Date().toISOString()
        })
      }
    }

    await supabase.from('sales_history').insert({
      outlet_id: selectedOutlet.id,
      item_name: 'Boxes',
      quantity_sold: 1, 
      date_string: activeLocalStamp,
      created_at: new Date().toISOString()
    })

    alert('Bill Successfully Punched Check!')
    setQuantities({})
    syncGlobalDatabaseData(selectedOutlet.id)
  }

  const exitToGateway = async () => {
    if (currentMode === 'outlet' && selectedOutlet) {
      await supabase.from('counter_sessions').upsert({
        outlet_id: selectedOutlet.id,
        is_logged_in: false,
        last_active_at: new Date().toISOString(),
        device_token: ''
      })
    }
    localStorage.removeItem('omk_current_mode')
    localStorage.removeItem('omk_selected_outlet_id')
    setCurrentMode('gate')
    setSelectedOutlet(null)
    setPasswordInput('')
    setErrorMessage('')
    setQuantities({})
  }

  const adjustQuantity = (id: string, amount: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max((prev[id] || 0) + amount, 0) }))
  }
  const orderTotal = menuItems.reduce((acc, item) => acc + (quantities[item.id] || 0) * item.price, 0)

  const generateAuditDateRangeList = (start: string, end: string) => {
    const list: string[] = []
    const current = new Date(start)
    const targetEnd = new Date(end)
    while (current <= targetEnd) {
      list.push(current.toISOString().split('T')[0])
      current.setDate(current.getDate() + 1)
    }
    return list
  }

  const auditDatesArray = generateAuditDateRangeList(auditStartDate, auditEndDate)
  const shouldRenderIngredientColumns = auditIngredient === 'ALL' || auditOutletFilter !== 'ALL'
  const currentRenderHeaders = shouldRenderIngredientColumns ? distinctIngredients : outlets.map(o => o.name)

  const dynamicBottomTotals: { [key: string]: number } = {}
  currentRenderHeaders.forEach(headerKey => { dynamicBottomTotals[headerKey] = 0 })
  let spreadsheetGrandTotal = 0

  let globalPromoterTodaySalesRevenue = 0
  let globalPromoterTodayOrderCount = 0
  let globalPromoterTodayItemCount = 0

  outlets.forEach(o => {
    const { salesAmountTotal, transactionsLoggedCount, totalItemsDispatchedCount } = getOutletSalesStatsForDateRange(o.id, liveOperatingDate, liveOperatingDate)
    globalPromoterTodaySalesRevenue += salesAmountTotal
    globalPromoterTodayOrderCount += transactionsLoggedCount
    globalPromoterTodayItemCount += totalItemsDispatchedCount
  })

  const currentTerminalStats = selectedOutlet ? getOutletSalesStatsForDateRange(selectedOutlet.id, liveOperatingDate, liveOperatingDate) : { salesAmountTotal: 0, transactionsLoggedCount: 0, totalItemsDispatchedCount: 0 }
  const customPeriodTerminalStats = selectedOutlet ? getOutletSalesStatsForDateRange(selectedOutlet.id, outletPeriodStart, outletPeriodEnd) : { salesAmountTotal: 0, transactionsLoggedCount: 0, totalItemsDispatchedCount: 0 }

  if (currentMode === 'gate') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 p-6 text-white font-sans">
        <h1 className="mb-2 text-3xl font-extrabold text-blue-400 tracking-tight">Omkar enterprise</h1>
        <p className="mb-8 text-slate-400 text-sm">Select systemic entry destination to initialize workspace modules</p>
        
        <div className="w-full max-w-4xl space-y-6">
          {!selectedOutlet && passwordInput === '' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {outlets.map(o => (
                  <button key={o.id} onClick={() => setSelectedOutlet(o)} className="rounded-xl border border-slate-700 bg-slate-800 p-5 font-bold transition hover:border-blue-500 hover:bg-slate-700 text-center">
                    <p className="text-base text-white">{o.name}</p>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Terminal POS</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-slate-800 pt-5">
                <button onClick={() => { setSelectedOutlet(null); setPasswordInput('PROMOTER_PROMPT'); }} className="w-full rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/10 p-4 font-black text-amber-400 text-center uppercase tracking-wider text-sm">Access Central Master Promoter Dashboard</button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md rounded-xl bg-slate-800 p-6 border border-slate-700 text-center">
              <h2 className="text-lg font-bold mb-1 text-white">Security Access Key Verification</h2>
              <input 
                type="password" 
                placeholder="Enter Secure Password..." 
                value={passwordInput === 'PROMOTER_PROMPT' ? '' : passwordInput} 
                onChange={(e) => { if(passwordInput === 'PROMOTER_PROMPT') setPasswordInput(''); setPasswordInput(e.target.value); }} 
                className="w-full mb-3 rounded-lg bg-slate-950 p-3 text-center text-sm font-mono text-white border border-slate-700 outline-none focus:border-blue-500" 
              />
              {errorMessage && <p className="text-xs font-semibold text-red-400 mb-3">{errorMessage}</p>}
              <div className="flex gap-2">
                <button onClick={exitToGateway} className="w-1/2 rounded-lg bg-slate-700 py-2 text-xs font-bold text-slate-300 hover:bg-slate-600">Abort</button>
                <button onClick={handleSystemGateUnlock} className="w-1/2 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white hover:bg-blue-500">Authorize</button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (currentMode === 'outlet' && selectedOutlet) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 font-sans text-slate-100 relative">
        
        {notification && (
          <div className="fixed top-4 right-4 z-50 bg-emerald-600 border border-emerald-400 text-white font-bold py-3 px-5 rounded-xl shadow-2xl animate-bounce text-xs tracking-wide">
            {notification}
          </div>
        )}

        <header className="mb-4 sticky top-0 bg-slate-950/95 backdrop-blur border-b border-slate-800 pb-4 z-40 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-black">{selectedOutlet.name} Live Terminal</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Operational Clock Today:</span>
                <div className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px] font-black text-blue-400 font-mono">{liveOperatingDate}</div>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-950/40 to-blue-950/30 border border-purple-900/60 px-4 py-2 rounded-xl hidden sm:block">
              <span className="text-[9px] uppercase font-black text-purple-400 block tracking-widest">Outlet Top Performer</span>
              <span className="text-xs font-extrabold text-white font-sans">{getTopPerformerLabel(selectedOutlet.id, liveOperatingDate, liveOperatingDate)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full xl:w-auto">
            <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl min-w-[120px]">
              <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Today's Revenue</span>
              <span className="text-lg font-black text-emerald-400 font-mono">${currentTerminalStats.salesAmountTotal.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl min-w-[100px]">
              <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Order Count</span>
              <span className="text-lg font-black text-blue-400 font-mono">{currentTerminalStats.transactionsLoggedCount}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl min-w-[100px]">
              <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Item Count</span>
              <span className="text-lg font-black text-amber-500 font-mono">{currentTerminalStats.totalItemsDispatchedCount}</span>
            </div>
            <button onClick={exitToGateway} className="rounded-xl bg-red-950/40 border border-red-900 px-4 text-xs font-bold text-red-200 hover:bg-red-900 transition ml-auto xl:ml-0">Log Out</button>
          </div>
        </header>

        <div className="flex gap-2 border-b border-slate-800 mb-6">
          <button onClick={() => setOutletTab('counter')} className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${outletTab === 'counter' ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>🛒 Counter Desk Terminal</button>
          <button onClick={() => setOutletTab('ledger')} className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${outletTab === 'ledger' ? 'bg-slate-900 text-amber-400 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>📜 Sales Ledger Audit</button>
          <button onClick={() => setOutletTab('received_stock')} className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${outletTab === 'received_stock' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}>🚚 Stock Received History</button>
        </div>

        {outletTab === 'counter' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <section className="xl:col-span-7 space-y-6">
              <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800">
                <h2 className="mb-4 text-xs font-bold text-blue-400 uppercase tracking-widest">Menu Products</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {menuItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-950 p-4 border border-slate-800">
                      <div><h3 className="font-bold text-xs">{item.name}</h3><p className="text-[10px] text-slate-500">${item.price.toFixed(2)}</p></div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustQuantity(item.id, -1)} className="h-7 w-7 rounded bg-slate-800 text-sm font-bold">-</button>
                        <span className="w-4 text-center font-mono text-xs">{quantities[item.id] || 0}</span>
                        <button onClick={() => adjustQuantity(item.id, 1)} className="h-7 w-7 rounded bg-slate-800 text-sm font-bold">+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-between items-center bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div><span className="text-[10px] uppercase tracking-wider text-slate-500">Total Bill</span><p className="text-2xl font-black text-white">${orderTotal.toFixed(2)}</p></div>
                  <button onClick={handlePunchOrder} className="rounded-lg bg-blue-600 px-6 py-3 text-xs font-bold text-white hover:bg-blue-500">Punch Order Check</button>
                </div>
              </div>
            </section>

            <section className="xl:col-span-5">
              <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800">
                <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Live Inventory Blueprint</h2>
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-500 font-bold">
                      <th className="pb-2">Material</th>
                      <th className="pb-2 text-center">Stock 1st</th>
                      <th className="pb-2 text-center text-amber-400">Used Today</th>
                      <th className="pb-2 text-right text-emerald-400">Stock Left</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventory.map(inv => {
                      const { usedToday, currentStockLeft } = getCalculatedItem(inv.item_name, inv.stock_on_first, selectedOutlet.id)
                      return (
                        <tr key={inv.id} className="border-b border-slate-800/50">
                          <td className="py-3 font-sans font-bold text-white">{formatIngredientLabel(inv.item_name)}</td>
                          <td className="py-3 text-center text-slate-400">{inv.stock_on_first}</td>
                          <td className="py-3 text-center text-amber-500 font-bold">{usedToday}</td>
                          <td className="py-3 text-right text-emerald-400 font-bold text-sm">{currentStockLeft}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {outletTab === 'ledger' && (
          <section className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Outlet Sales History lookup</h3>
                <p className="text-[10px] text-slate-500">Filter and review past performance summaries directly on the counter</p>
              </div>
              
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl font-mono text-xs">
                <input type="date" value={outletPeriodStart} onChange={(e) => setOutletPeriodStart(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none" />
                <span className="text-slate-500 text-xs font-sans">to</span>
                <input type="date" value={outletPeriodEnd} onChange={(e) => setOutletPeriodEnd(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Window Revenue</span>
                <span className="text-2xl font-black text-emerald-400 font-mono block mt-1">${customPeriodTerminalStats.salesAmountTotal.toLocaleString()}</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Window Orders Count</span>
                <span className="text-2xl font-black text-blue-400 font-mono block mt-1">{customPeriodTerminalStats.transactionsLoggedCount} orders</span>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Window Item Count</span>
                <span className="text-2xl font-black text-amber-500 font-mono block mt-1">{customPeriodTerminalStats.totalItemsDispatchedCount} units</span>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-800 pt-6">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Itemized Sales Audit Sheet</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 font-bold">
                      <th className="p-3">Product Menu Variant</th>
                      <th className="p-3 text-center">Type</th>
                      <th className="p-3 text-center">Price Unit</th>
                      <th className="p-3 text-center text-blue-400">Total Units Sold</th>
                      <th className="p-3 text-right text-emerald-400">Gross Sales Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {getProductSalesPerformanceBreakdown(selectedOutlet.id, outletPeriodStart, outletPeriodEnd).map(prod => (
                      <tr key={prod.id} className="hover:bg-slate-900/20">
                        <td className="p-3 font-sans font-bold text-white">{prod.name}</td>
                        <td className="p-3 text-center font-sans font-bold">
                          {prod.isCombo ? <span className="text-purple-400 text-[10px] uppercase px-1.5 py-0.5 rounded bg-purple-950/40 border border-purple-900">Combo</span> : <span className="text-slate-500 text-[10px] uppercase">Single</span>}
                        </td>
                        <td className="p-3 text-center text-slate-500">${prod.price.toFixed(2)}</td>
                        <td className="p-3 text-center text-blue-400 font-bold">{prod.unitsSold}</td>
                        <td className="p-3 text-right text-emerald-400 font-bold">${prod.itemRevenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {outletTab === 'received_stock' && (
          <section className="rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">🚚 Inbound Dispatches Logistics Ledger</h3>
                <p className="text-[10px] text-slate-500">Audits centralized supply truck deliveries routed into your branch database container</p>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl font-mono text-xs">
                <span className="text-[10px] font-sans text-slate-500">From:</span>
                <input type="date" value={outletReceivedStart} onChange={(e) => setOutletReceivedStart(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-0.5 focus:outline-none" />
                <span className="text-[10px] font-sans text-slate-500">To:</span>
                <input type="date" value={outletReceivedEnd} onChange={(e) => setOutletReceivedEnd(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-0.5 focus:outline-none" />
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 font-bold">
                    <th className="p-3">Shipment Arrival Timestamp</th>
                    <th className="p-3 text-center">Material Asset Type</th>
                    <th className="p-3 text-right text-emerald-400">Received Allocation Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {allReplenishments.filter(r => {
                    const rowDate = r.created_at?.split('T')[0] || liveOperatingDate
                    return r.outlet_id === selectedOutlet.id && rowDate >= outletReceivedStart && rowDate <= outletReceivedEnd
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-600 font-sans italic">No inbound supply truck drops discovered in chosen range filters.</td>
                    </tr>
                  ) : (
                    allReplenishments.filter(r => {
                      const rowDate = r.created_at?.split('T')[0] || liveOperatingDate
                      return r.outlet_id === selectedOutlet.id && rowDate >= outletReceivedStart && rowDate <= outletReceivedEnd
                    }).map(log => (
                      <tr key={log.id} className="hover:bg-slate-900/20">
                        <td className="p-3 text-slate-400">{log.created_at ? new Date(log.created_at).toLocaleString('en-GB') : `Day Check Index: ${log.day_of_month}th`}</td>
                        <td className="p-3 text-center font-sans font-bold text-white uppercase tracking-wider text-[11px]">{formatIngredientLabel(log.item_name)}</td>
                        <td className="p-3 text-right text-emerald-400 font-black text-sm">+{log.quantity_added} units</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 font-sans text-slate-100 space-y-6">
      
      {notification && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 border border-emerald-400 text-white font-bold py-3 px-5 rounded-xl shadow-2xl text-xs tracking-wide">
          {notification}
        </div>
      )}

      <header className="sticky top-0 bg-slate-950/95 backdrop-blur z-40 border-b border-slate-800 pb-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-amber-400 tracking-tight">👑 Omkar enterprise Command Dashboard</h1>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-widest">Global Master Operations, Logistics & Security Panel</p>
          </div>

          <div className="bg-gradient-to-r from-amber-500/10 to-blue-500/5 border border-amber-500/20 px-4 py-2 rounded-xl hidden md:block">
            <span className="text-[9px] uppercase font-black text-amber-400 block tracking-widest">Network Top Performer</span>
            <span className="text-xs font-black text-white font-sans">{getTopPerformerLabel('ALL', liveOperatingDate, liveOperatingDate)}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full xl:w-auto">
          <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl min-w-[130px]">
            <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Network Today Sales</span>
            <span className="text-lg font-black text-emerald-400 font-mono">${globalPromoterTodaySalesRevenue.toLocaleString()}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl min-w-[100px]">
            <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Net Orders</span>
            <span className="text-lg font-black text-blue-400 font-mono">{globalPromoterTodayOrderCount}</span>
          </div>
          <div className="bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-xl min-w-[100px]">
            <span className="text-[9px] uppercase font-bold text-slate-500 block tracking-wider">Net Items</span>
            <span className="text-lg font-black text-amber-500 font-mono">{globalPromoterTodayItemCount}</span>
          </div>
          <button onClick={exitToGateway} className="rounded-xl bg-slate-850 px-4 text-xs font-bold text-slate-300 hover:bg-red-900 hover:text-white transition ml-auto xl:ml-0">Exit Portal</button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-0.5">
        <button onClick={() => setPromoterTab('overview')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${promoterTab === 'overview' ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>📊 Network Overview</button>
        <button onClick={() => setPromoterTab('branches')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${promoterTab === 'branches' ? 'bg-slate-900 text-purple-400 border-b-2 border-purple-500' : 'text-slate-500 hover:text-slate-300'}`}>🏪 Branch-by-Branch Matrix</button>
        <button onClick={() => setPromoterTab('revenue_matrix')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${promoterTab === 'revenue_matrix' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}>💰 Revenue Matrix</button>
        <button onClick={() => setPromoterTab('dispatches')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${promoterTab === 'dispatches' ? 'bg-slate-900 text-amber-500 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>📦 Stock Dispatch Desk</button>
        <button onClick={() => setPromoterTab('security')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${promoterTab === 'security' ? 'bg-slate-900 text-red-400 border-b-2 border-red-500' : 'text-slate-500 hover:text-slate-300'}`}>🔐 Terminal Security Locks</button>
      </div>

      {promoterTab === 'overview' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Network Analytics Audit Filter</h3>
              <p className="text-[10px] text-slate-500">Isolates global network sheets calculation windows independently</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 font-mono text-xs">
              <span className="text-[10px] font-sans text-slate-500">From:</span>
              <input type="date" value={overviewStartDate} onChange={(e) => setOverviewStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white outline-none" />
              <span className="text-[10px] font-sans text-slate-500">To:</span>
              <input type="date" value={overviewEndDate} onChange={(e) => setOverviewEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-white outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(() => {
              let rev = 0, ord = 0, itm = 0
              outlets.forEach(o => {
                const stats = getOutletSalesStatsForDateRange(o.id, overviewStartDate, overviewEndDate)
                rev += stats.salesAmountTotal
                ord += stats.transactionsLoggedCount
                itm += stats.totalItemsDispatchedCount
              })
              return (
                <>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center shadow">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Combined Period Period Revenue</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono block mt-1">${rev.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center shadow">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Combined Period Period Orders</span>
                    <span className="text-2xl font-black text-blue-400 font-mono block mt-1">{ord.toLocaleString()} orders</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl text-center shadow">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Combined Period Period Items Sold</span>
                    <span className="text-2xl font-black text-amber-500 font-mono block mt-1">{itm.toLocaleString()} units</span>
                  </div>
                </>
              )
            })()}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Global Menu & Combo Dissection Matrix</h3>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="bg-slate-900/60 border-b border-slate-800 font-bold text-slate-400">
                    <th className="p-3">Product Menu Variant</th>
                    <th className="p-3 text-center">Structure Classification</th>
                    <th className="p-3 text-center">Price Tag</th>
                    <th className="p-3 text-center text-blue-400">Network Combined Sales Volume</th>
                    <th className="p-3 text-right text-emerald-400">Network Total Earned Gross</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {getProductSalesPerformanceBreakdown('ALL', overviewStartDate, overviewEndDate).map(item => (
                    <tr key={item.id} className="hover:bg-slate-900/30">
                      <td className="p-3 font-sans font-bold text-white">{item.name}</td>
                      <td className="p-3 text-center text-[10px] uppercase font-sans font-bold">
                        {item.isCombo ? <span className="text-purple-400 bg-purple-950/40 border border-purple-900 px-2 py-0.5 rounded">Combo Package</span> : <span className="text-slate-500">Standalone Item</span>}
                      </td>
                      <td className="p-3 text-center text-slate-500">${item.price.toFixed(2)}</td>
                      <td className="p-3 text-center text-blue-400 font-bold">{item.unitsSold} units</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">${item.itemRevenue.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {promoterTab === 'branches' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Independent Branch Analytics Matrix</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">Every location operates on completely autonomous independent date range filter controls.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outlets.map(o => {
              const localRange = branchCardDateRanges[o.id] || { start: liveOperatingDate, end: liveOperatingDate }
              const localStats = getOutletSalesStatsForDateRange(o.id, localRange.start, localRange.end)

              return (
                <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-base font-black text-white">{o.name}</h4>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Active Terminal Outlet</span>
                    </div>
                    {terminalSessions.find(s => s.outlet_id === o.id)?.is_logged_in ? (
                      <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-900 text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider animate-pulse">Live</span>
                    ) : (
                      <span className="bg-slate-950 text-slate-600 border border-slate-800 text-[9px] px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Offline</span>
                    )}
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Card Audit Date Window</span>
                    <div className="flex items-center justify-between gap-1 font-mono text-[11px]">
                      <input 
                        type="date" 
                        value={localRange.start} 
                        onChange={(e) => setBranchCardDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], start: e.target.value } }))} 
                        className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                      />
                      <span className="text-slate-600 font-sans text-xs">to</span>
                      <input 
                        type="date" 
                        value={localRange.end} 
                        onChange={(e) => setBranchCardDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], end: e.target.value } }))} 
                        className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs pt-1">
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      <span className="text-[9px] font-sans text-slate-500 block">Revenue</span>
                      <span className="font-bold text-emerald-400">${localStats.salesAmountTotal}</span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      <span className="text-[9px] font-sans text-slate-500 block">Orders</span>
                      <span className="font-bold text-blue-400">{localStats.transactionsLoggedCount}</span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      <span className="text-[9px] font-sans text-slate-500 block">Items</span>
                      <span className="font-bold text-amber-500">{localStats.totalItemsDispatchedCount}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl px-3 py-1.5 border border-purple-900/30 text-center">
                    <span className="text-[10px] font-sans text-purple-400 font-bold block">
                      ⭐ Window Best Seller: <span className="text-white font-mono font-black">{getTopPerformerLabel(o.id, localRange.start, localRange.end)}</span>
                    </span>
                  </div>

                  <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1 text-[11px] max-h-36 overflow-y-auto">
                    <span className="text-[9px] text-purple-400 uppercase font-bold tracking-wider block mb-1">Itemized Sales Dissection:</span>
                    {getProductSalesPerformanceBreakdown(o.id, localRange.start, localRange.end).map(prod => (
                      <div key={prod.id} className="flex justify-between items-center font-mono text-slate-400 border-b border-slate-900 pb-0.5 last:border-0">
                        <span className="font-sans text-white truncate max-w-[130px]">{prod.name}</span>
                        <span>{prod.unitsSold} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {promoterTab === 'revenue_matrix' && (
        <div className="space-y-6">
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">💰 Network Revenue Matrix Monitor</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">Reviews absolute monetary sales metrics layered with deep item quantity log arrays.</p>
            </div>
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1 rounded-lg">Target: Multi-Branch Overview</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outlets.map(o => {
              const localRange = revMatrixDateRanges[o.id] || { start: liveOperatingDate, end: liveOperatingDate }
              const localStats = getOutletSalesStatsForDateRange(o.id, localRange.start, localRange.end)

              return (
                <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="text-base font-black text-emerald-400">{o.name} Revenue Card</h4>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Financial Auditor Suite</span>
                    </div>
                    <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 text-[10px] px-2 py-0.5 rounded font-black tracking-tight font-mono">${localStats.salesAmountTotal.toLocaleString()}</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                    <span className="text-[9px] uppercase font-bold text-slate-500 block">Card Audit Date Window</span>
                    <div className="flex items-center justify-between gap-1 font-mono text-[11px]">
                      <input 
                        type="date" 
                        value={localRange.start} 
                        onChange={(e) => setRevMatrixDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], start: e.target.value } }))} 
                        className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                      />
                      <span className="text-slate-600 font-sans text-xs">to</span>
                      <input 
                        type="date" 
                        value={localRange.end} 
                        onChange={(e) => setRevMatrixDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], end: e.target.value } }))} 
                        className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs pt-1">
                    <div className="bg-slate-950/50 p-2 rounded border border-emerald-900/20">
                      <span className="text-[9px] font-sans text-slate-500 block">Total Revenue</span>
                      <span className="font-extrabold text-emerald-400">${localStats.salesAmountTotal.toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      <span className="text-[9px] font-sans text-slate-500 block">Orders Done</span>
                      <span className="font-bold text-blue-400">{localStats.transactionsLoggedCount}</span>
                    </div>
                    <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                      <span className="text-[9px] font-sans text-slate-500 block">Menu Items</span>
                      <span className="font-bold text-amber-500">{localStats.totalItemsDispatchedCount}</span>
                    </div>
                  </div>

                  <div className="bg-slate-950/80 rounded-xl px-3 py-1.5 border border-amber-900/30 text-center">
                    <span className="text-[10px] font-sans text-amber-400 font-bold block">
                      🏆 Highest Velocity Seller: <span className="text-white font-mono font-black">{getTopPerformerLabel(o.id, localRange.start, localRange.end)}</span>
                    </span>
                  </div>

                  <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1 text-[11px] max-h-36 overflow-y-auto">
                    <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider block mb-1">Itemized Sales Dissection:</span>
                    {getProductSalesPerformanceBreakdown(o.id, localRange.start, localRange.end).map(prod => (
                      <div key={prod.id} className="flex justify-between items-center font-mono border-b border-slate-900 pb-0.5 last:border-0 text-slate-400">
                        <span className="font-sans text-white truncate max-w-[120px]">{prod.name}</span>
                        <span className="text-emerald-500 font-bold">${prod.itemRevenue.toLocaleString()} <span className="text-slate-600 font-normal text-[10px]">({prod.unitsSold} qty)</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {promoterTab === 'dispatches' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <section className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit space-y-4">
            <div>
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Log Distribution Shipment</h3>
              <p className="text-[10px] text-slate-500">Dispatch raw material inventory assets to network channels safely</p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex flex-col space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Select Target Destination Branch:</label>
                <select value={dispatchOutletId} onChange={(e) => setDispatchOutletId(Number(e.target.value))} className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-white font-bold outline-none focus:border-emerald-500">
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Raw Asset Category Material:</label>
                <select value={dispatchItemName} onChange={(e) => setDispatchItemName(e.target.value)} className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-white font-bold outline-none focus:border-emerald-500">
                  {distinctIngredients.map(ing => <option key={ing} value={ing}>{formatIngredientLabel(ing)}</option>)}
                </select>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Transfer Allocation Date (Explicit):</label>
                <input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-white font-mono outline-none focus:border-emerald-500" />
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Exact Unit Volume Despatched:</label>
                <input type="number" placeholder="0" value={dispatchQty || ''} onChange={(e) => setDispatchQty(Number(e.target.value))} className="bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-emerald-400 font-mono font-bold text-sm outline-none focus:border-emerald-500" />
              </div>

              <button onClick={handleExecuteStockDispatch} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition uppercase tracking-wider text-xs shadow-md pt-2.5">
                Execute Stock Dispatch
              </button>
            </div>
          </section>

          <section className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 pb-2 border-b border-slate-800">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest">Historical Spreadsheet Filter</h4>
                <p className="text-[9px] text-slate-500">Audits structural incoming or outgoing raw quantities matrix logs</p>
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-2 rounded-xl border border-slate-800 text-[11px]">
                <select value={promoterActiveTab} onChange={(e) => setPromoterActiveTab(e.target.value as any)} className="bg-slate-900 border border-slate-700 text-blue-400 rounded px-1.5 py-0.5 font-bold outline-none">
                  <option value="consumption">Stock Out (Sales)</option>
                  <option value="dispatches">Stock In (Sent)</option>
                </select>
                <select value={auditOutletFilter} onChange={(e) => setAuditOutletFilter(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 outline-none">
                  <option value="ALL">All Outlets</option>
                  {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <select value={auditIngredient} onChange={(e) => setAuditIngredient(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 rounded px-1.5 py-0.5 outline-none">
                  <option value="ALL">All Materials</option>
                  {distinctIngredients.map(ing => <option key={ing} value={ing}>{formatIngredientLabel(ing)}</option>)}
                </select>
                <div className="flex items-center gap-1 border-l border-slate-800 pl-1">
                  <input type="date" value={auditStartDate} onChange={(e) => setAuditStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-white w-[110px]" />
                  <span className="text-[10px] text-slate-500">to</span>
                  <input type="date" value={auditEndDate} onChange={(e) => setAuditEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-white w-[110px]" />
                </div>
              </div>
            </header>

            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 font-bold uppercase tracking-wider text-center">
                    <th className="py-3 px-3 text-left w-32 bg-slate-900 sticky left-0 z-10 border-r border-slate-800">Timeline Date</th>
                    {currentRenderHeaders.map(colHeader => (
                      <th key={colHeader} className="py-3 px-2">{formatIngredientLabel(colHeader)}</th>
                    ))}
                    <th className="py-3 px-3 bg-blue-950/40 text-blue-400 border-l border-slate-800">Period Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-center">
                  {auditDatesArray.map(dateString => {
                    let dailyRowRunningSum = 0

                    return (
                      <tr key={dateString} className="hover:bg-slate-900/40 transition">
                        <td className="py-2.5 px-3 text-left font-bold text-slate-400 bg-slate-950 sticky left-0 z-10 border-r border-slate-800 font-sans text-xs">{dateString}</td>
                        {currentRenderHeaders.map(colHeader => {
                          let computedValue = 0

                          if (promoterActiveTab === 'consumption') {
                            if (shouldRenderIngredientColumns) {
                              const targetIngName = colHeader
                              computedValue = allSalesHistory.filter(s => {
                                return s.item_name === targetIngName && (auditOutletFilter === 'ALL' || s.outlet_id === Number(auditOutletFilter)) && resolveTargetRowDate(s) === dateString
                              }).reduce((a, c) => a + Number(c.quantity_sold), 0)
                            } else {
                              const targetOutletId = outlets.find(o => o.name === colHeader)?.id || 0
                              computedValue = allSalesHistory.filter(s => {
                                return s.item_name === auditIngredient && s.outlet_id === targetOutletId && resolveTargetRowDate(s) === dateString
                              }).reduce((a, c) => a + Number(c.quantity_sold), 0)
                            }
                          } else {
                            if (shouldRenderIngredientColumns) {
                              const targetIngName = colHeader
                              computedValue = allReplenishments.filter(r => {
                                const rowDate = r.created_at?.split('T')[0] || liveOperatingDate
                                return r.item_name === targetIngName && (auditOutletFilter === 'ALL' || r.outlet_id === Number(auditOutletFilter)) && rowDate === dateString
                              }).reduce((a, c) => a + Number(c.quantity_added), 0)
                            } else {
                              const targetOutletId = outlets.find(o => o.name === colHeader)?.id || 0
                              computedValue = allReplenishments.filter(r => {
                                const rowDate = r.created_at?.split('T')[0] || liveOperatingDate
                                return r.item_name === auditIngredient && r.outlet_id === targetOutletId && rowDate === dateString
                              }).reduce((a, c) => a + Number(c.quantity_added), 0)
                            }
                          }

                          dailyRowRunningSum += computedValue
                          dynamicBottomTotals[colHeader] += computedValue

                          return (
                            <td key={colHeader} className={`py-2.5 px-2 font-bold ${computedValue > 0 ? (promoterActiveTab === 'consumption' ? 'text-amber-500' : 'text-emerald-400 font-black text-sm') : 'text-slate-700'}`}>{computedValue || '-'}</td>
                          )
                        })}
                        <td className="py-2.5 px-3 bg-blue-950/40 text-blue-400 font-bold text-right border-l border-slate-800">
                          {dailyRowRunningSum.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="border-t-2 border-slate-700 bg-slate-900 font-sans text-xs font-black text-center text-white shadow-inner">
                    <td className="py-3.5 px-3 text-left bg-slate-900 font-extrabold text-blue-400 uppercase tracking-wider sticky left-0 z-10 border-r border-slate-800">Total Sum</td>
                    {currentRenderHeaders.map(colHeader => {
                      const verticalTotal = dynamicBottomTotals[colHeader]
                      spreadsheetGrandTotal += verticalTotal
                      return <td key={colHeader} className={`py-3.5 px-2 font-mono text-sm tracking-tight ${verticalTotal > 0 ? 'text-emerald-400 font-black' : 'text-slate-500'}`}>{verticalTotal || 0}</td>
                    })}
                    <td className="py-3.5 px-3 bg-emerald-950/40 border-l border-slate-800 font-mono text-base text-emerald-400 font-black">{spreadsheetGrandTotal.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {promoterTab === 'security' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Multi-Device Anti-Fraud Session Controller</h3>
            <p className="text-[10px] text-slate-500">Enforces an absolute single-screen policy per outlet terminal. Clear stuck or zombie devices instantly down below.</p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="bg-slate-900 text-slate-400 border-b border-slate-800 font-bold">
                  <th className="p-3">Counter Terminal Group</th>
                  <th className="p-3 text-center">Login Security Lock State</th>
                  <th className="p-3 text-center">Last Active Heartbeat Check</th>
                  <th className="p-3 text-right">Master Override Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                {outlets.map(o => {
                  const sessionState = terminalSessions.find(s => s.outlet_id === o.id)
                  return (
                    <tr key={o.id} className="hover:bg-slate-900/20">
                      <td className="p-3 font-sans font-bold text-white">{o.name}</td>
                      <td className="p-3 text-center">
                        {sessionState?.is_logged_in ? (
                          <span className="bg-red-950 text-red-400 border border-red-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">LOCKED IN USE</span>
                        ) : (
                          <span className="bg-slate-900 text-slate-500 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">UNLOCKED FREE</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                        {sessionState?.last_active_at ? new Date(sessionState.last_active_at).toLocaleTimeString() : 'No activity logged'}
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          disabled={!sessionState?.is_logged_in}
                          onClick={() => handleForceTerminateSession(o.id)}
                          className={`px-3 py-1 rounded text-[10px] uppercase font-bold transition ${sessionState?.is_logged_in ? 'bg-red-600 text-white hover:bg-red-500 shadow-md' : 'bg-slate-900 text-slate-700 cursor-not-allowed'}`}
                        >
                          Force Reset Session
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  )
}

