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
}

interface SalesLog {
  id: number
  outlet_id: number
  item_name: string
  quantity_sold: number
  created_at: string
}

export default function Home() {
  const [currentMode, setCurrentMode] = useState<'gate' | 'outlet' | 'promoter'>('gate')
  const [selectedOutlet, setSelectedOutlet] = useState<Outlet | null>(null)
  const [passwordInput, setPasswordInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [allReplenishments, setAllReplenishments] = useState<ReplenishmentLog[]>([])
  const [allSalesHistory, setAllSalesHistory] = useState<SalesLog[]>([])
  const [loading, setLoading] = useState(false)
  const [quantities, setQuantities] = useState<{ [key: string]: number }>({})

  // PROMOTER NAVIGATION CONTROLLER (Matches your reference layouts)
  const [promoterTab, setPromoterTab] = useState<'overview' | 'branches' | 'revenue_matrix' | 'dispatch' | 'security'>('overview')
  
  // OUTLET TABS CONTROLLER (4 clean tabs)
  const [outletTab, setOutletTab] = useState<'counter' | 'blueprint' | 'history' | 'lookup'>('counter')

  // Stock Dispatch Desk Active Input States
  const [dispatchOutlet, setDispatchOutlet] = useState<string>('1')
  const [dispatchIngredient, setDispatchIngredient] = useState<string>('Egg')
  const [dispatchQty, setDispatchQty] = useState<number>(0)

  // Hardcoded helper to grab standard YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const liveOperatingDate = getTodayDateString()
  
  // States for Outlet Performance custom time-frame lookup
  const [outletPeriodStart, setOutletPeriodStart] = useState<string>(getTodayDateString())
  const [outletPeriodEnd, setOutletPeriodEnd] = useState<string>(getTodayDateString())

  // States for Promoter Master Dashboard range filters
  const [auditStartDate, setAuditStartDate] = useState<string>(() => {
    const today = new Date()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    return `${today.getFullYear()}-${mm}-01`
  })
  const [auditEndDate, setAuditEndDate] = useState<string>(getTodayDateString())

  // Dedicated range states for independent Promoter Revenue Matrix Cards matching image offsets
  const [revenueCardDateRanges, setRevenueCardDateRanges] = useState<{ [key: number]: { start: string; end: string } }>(() => {
    const today = new Date()
    const initialRange = { start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, end: getTodayDateString() }
    return { 1: initialRange, 2: initialRange, 3: initialRange, 4: initialRange, 5: initialRange, 6: initialRange }
  })

  // Branch-by-branch matrix date filters
  const [branchMatrixDateRanges, setBranchMatrixDateRanges] = useState<{ [key: number]: { start: string; end: string } }>(() => {
    const today = new Date()
    const initialRange = { start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`, end: getTodayDateString() }
    return { 1: initialRange, 2: initialRange, 3: initialRange, 4: initialRange, 5: initialRange, 6: initialRange }
  })

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

  useEffect(() => {
    if (currentMode === 'outlet' && selectedOutlet) {
      syncGlobalDatabaseData(selectedOutlet.id)
    } else if (currentMode === 'promoter') {
      syncGlobalDatabaseData()
    }
  }, [currentMode, selectedOutlet])

  const syncGlobalDatabaseData = async (targetOutletId?: number) => {
    setLoading(true)
    const invQuery = supabase.from('inventory').select('*')
    const repQuery = supabase.from('inventory_replenishments').select('*')
    const salesQuery = supabase.from('sales_history').select('*')

    if (targetOutletId) {
      invQuery.eq('outlet_id', targetOutletId)
      repQuery.eq('outlet_id', targetOutletId)
      salesQuery.eq('outlet_id', targetOutletId)
    }

    const { data: iData } = await invQuery.order('id', { ascending: true })
    const { data: rData } = await repQuery
    const { data: sData } = await salesQuery

    if (iData) setInventory(iData)
    if (rData) setAllReplenishments(rData)
    if (sData) setAllSalesHistory(sData)
    setLoading(false)
  }

  const handleSystemGateUnlock = async () => {
    if (!selectedOutlet) {
      if (passwordInput === 'OmkarAdmin#2026') {
        setCurrentMode('promoter')
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
        setCurrentMode('outlet')
        setErrorMessage('')
        setPasswordInput('')
      } else {
        setErrorMessage(`Invalid Verification Key for ${selectedOutlet.name}.`)
      }
    }
  }

  const getCalculatedItem = (itemName: string, baseStock: number, targetOutletId: number) => {
    const totalReplenished = allReplenishments.filter(r => r.item_name === itemName && r.outlet_id === targetOutletId).reduce((a, c) => a + Number(c.quantity_added), 0)
    const totalUsedEver = allSalesHistory.filter(s => s.item_name === itemName && s.outlet_id === targetOutletId).reduce((a, c) => a + Number(c.quantity_sold), 0)
    
    const usedToday = allSalesHistory.filter(s => {
      const matchDate = s.created_at ? s.created_at.split('T')[0] : ''
      return s.item_name === itemName && s.outlet_id === targetOutletId && matchDate === liveOperatingDate
    }).reduce((a, c) => a + Number(c.quantity_sold), 0)

    const currentStockLeft = Number(baseStock) + totalReplenished - totalUsedEver
    return { usedToday, currentStockLeft }
  }

  // CORE ANALYTICS MATRIX: Reads the exact raw material strings mapped to your database logs
  const getOutletSalesStatsForDateRange = (targetOutletId: number, startDay: string, endDay: string) => {
    let salesAmountTotal = 0
    let transactionsLoggedCount = 0
    let totalItemsDispatchedCount = 0

    const rawIngredientQuantities: { [key: string]: number } = {}
    distinctIngredients.forEach(ing => { rawIngredientQuantities[ing] = 0 })

    allSalesHistory.forEach(s => {
      const recordDate = s.created_at ? s.created_at.split('T')[0] : ''
      if (s.outlet_id === targetOutletId && recordDate >= startDay && recordDate <= endDay) {
        if (s.item_name === 'Boxes') {
          transactionsLoggedCount += s.quantity_sold
          salesAmountTotal += (s.quantity_sold * 12) 
        } else if (s.item_name !== 'Boxes') {
          rawIngredientQuantities[s.item_name] = (rawIngredientQuantities[s.item_name] || 0) + s.quantity_sold
          totalItemsDispatchedCount += s.quantity_sold
        }
      }
    })

    let highestQty = 0
    let highestIngredientName = 'None'
    Object.entries(rawIngredientQuantities).forEach(([name, qty]) => {
      if (qty > highestQty && name !== 'Boxes') {
        highestQty = qty
        highestIngredientName = formatIngredientLabel(name)
      }
    })

    return { salesAmountTotal, transactionsLoggedCount, totalItemsDispatchedCount, rawIngredientQuantities, highestIngredientName }
  }

  // STOCK DISPATCH LOGIC: Directly modifies warehouse registries for selected locations
  const handleExecuteDispatch = async () => {
    if (dispatchQty <= 0) return alert('Please input a valid dispatch volume amount.')
    const dayInt = new Date(liveOperatingDate).getDate()

    await supabase.from('inventory_replenishments').insert({
      outlet_id: Number(dispatchOutlet),
      item_name: dispatchIngredient,
      day_of_month: dayInt,
      quantity_added: dispatchQty
    })

    alert(`Successfully dispatched ${dispatchQty} units of ${formatIngredientLabel(dispatchIngredient)} to Outlet ${dispatchOutlet}!`)
    setDispatchQty(0)
    syncGlobalDatabaseData()
  }

  const handlePunchOrder = async () => {
    if (orderTotal === 0) return alert('Add items.')
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

    for (const inv of inventory) {
      const deduction = totalNeeded[inv.item_name] || 0
      if (deduction > 0) {
        await supabase.from('sales_history').insert({
          outlet_id: selectedOutlet.id,
          item_name: inv.item_name,
          quantity_sold: deduction,
          created_at: new Date().toISOString()
        })
      }
    }

    await supabase.from('sales_history').insert({
      outlet_id: selectedOutlet.id,
      item_name: 'Boxes',
      quantity_sold: 1, 
      created_at: new Date().toISOString()
    })

    alert('Bill Punched!');
    setQuantities({})
    syncGlobalDatabaseData(selectedOutlet.id)
  }

  const adjustQuantity = (id: string, amount: number) => {
    setQuantities(prev => ({ ...prev, [id]: Math.max((prev[id] || 0) + amount, 0) }))
  }
  const orderTotal = menuItems.reduce((acc, item) => acc + (quantities[item.id] || 0) * item.price, 0)

  const exitToGateway = () => {
    setCurrentMode('gate')
    setSelectedOutlet(null)
    setPasswordInput('')
    setErrorMessage('')
    setQuantities({})
  }

  let globalPromoterTodaySalesRevenue = 0
  let globalPromoterTodayOrderCount = 0
  let globalPromoterTodayItemCount = 0

  outlets.forEach(o => {
    const { salesAmountTotal, transactionsLoggedCount, totalItemsDispatchedCount } = getOutletSalesStatsForDateRange(o.id, liveOperatingDate, liveOperatingDate)
    globalPromoterTodaySalesRevenue += salesAmountTotal
    globalPromoterTodayOrderCount += transactionsLoggedCount
    globalPromoterTodayItemCount += totalItemsDispatchedCount
  })

  // Global Network-wide top performer derived directly from raw material quantities
  let netEgg = 0, netWheat = 0, netIng3 = 0, netIng4 = 0, netIng5 = 0, netWater = 0
  allSalesHistory.forEach(s => {
    const d = s.created_at ? s.created_at.split('T')[0] : ''
    if (d === liveOperatingDate) {
      if (s.item_name === 'Egg') netEgg += s.quantity_sold
      if (s.item_name === 'Wheat') netWheat += s.quantity_sold
      if (s.item_name === 'Ing3') netIng3 += s.quantity_sold
      if (s.item_name === 'Ing4') netIng4 += s.quantity_sold
      if (s.item_name === 'Ing5') netIng5 += s.quantity_sold
      if (s.item_name === 'Water bottle') netWater += s.quantity_sold
    }
  })
  const netTotalsMap = { 'ing1': netEgg, 'ing2': netWheat, 'Ing3': netIng3, 'Ing4': netIng4, 'Ing5': netIng5, 'Water bottle': netWater }
  let globalTopPerformer = 'None'
  let globalMax = 0
  Object.entries(netTotalsMap).forEach(([k, v]) => {
    if (v > globalMax) { globalMax = v; globalTopPerformer = k; }
  })

  const currentTerminalStats = selectedOutlet ? getOutletSalesStatsForDateRange(selectedOutlet.id, liveOperatingDate, liveOperatingDate) : { salesAmountTotal: 0, transactionsLoggedCount: 0, totalItemsDispatchedCount: 0, highestIngredientName: 'None' }
  const customPeriodTerminalStats = selectedOutlet ? getOutletSalesStatsForDateRange(selectedOutlet.id, outletPeriodStart, outletPeriodEnd) : { salesAmountTotal: 0, transactionsLoggedCount: 0, totalItemsDispatchedCount: 0, highestIngredientName: 'None' }

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
        <header className="mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center border-b border-slate-800 pb-5 gap-4">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-2xl font-black">{selectedOutlet.name} Live Terminal</h1>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operating Calendar Date:</span>
                <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded text-xs font-black text-blue-400 font-mono shadow-inner">
                  {liveOperatingDate}
                </div>
              </div>
            </div>

            {/* RESTORED TOP PERFORMER BADGE PLACED CLEANLY NEXT TO TODAY'S REVENUE */}
            <div className="bg-gradient-to-r from-purple-950/40 to-blue-950/30 border border-purple-900/60 px-4 py-2 rounded-xl hidden md:block">
              <span className="text-[9px] uppercase font-black text-purple-400 block tracking-widest">Outlet Top Seller</span>
              <span className="text-xs font-extrabold text-white font-sans uppercase">{currentTerminalStats.highestIngredientName}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-md min-w-[130px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Today's Revenue</span>
              <span className="text-xl font-black text-emerald-400 font-mono">${currentTerminalStats.salesAmountTotal.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-md min-w-[110px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Order Count</span>
              <span className="text-xl font-black text-blue-400 font-mono">{currentTerminalStats.transactionsLoggedCount}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-md min-w-[110px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Item Count</span>
              <span className="text-xl font-black text-amber-500 font-mono">{currentTerminalStats.totalItemsDispatchedCount}</span>
            </div>
            <button onClick={exitToGateway} className="rounded-xl bg-slate-900 border border-slate-800 px-5 text-xs font-bold text-slate-400 hover:bg-red-950 hover:text-white hover:border-red-900 transition ml-auto lg:ml-0">Log Out</button>
          </div>
        </header>

        {/* 4 CLEAN ISOLATED TABS ON OUTLET VIEW */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 mb-6 pb-0.5">
          <button onClick={() => setOutletTab('counter')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${outletTab === 'counter' ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}>🛒 Menu Products / Punch Bill</button>
          <button onClick={() => setOutletTab('blueprint')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${outletTab === 'blueprint' ? 'bg-slate-900 text-teal-400 border-b-2 border-teal-500' : 'text-slate-500 hover:text-slate-300'}`}>📊 Live Inventory Blueprint</button>
          <button onClick={() => setOutletTab('history')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${outletTab === 'history' ? 'bg-slate-900 text-emerald-400 border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}>🚚 Received Stock Ledger</button>
          <button onClick={() => setOutletTab('lookup')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-xl transition ${outletTab === 'lookup' ? 'bg-slate-900 text-amber-400 border-b-2 border-amber-500' : 'text-slate-500 hover:text-slate-300'}`}>📜 Sales History Lookup</button>
        </div>

        {outletTab === 'counter' && (
          <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 max-w-4xl">
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
        )}

        {/* LIVE INVENTORY BLUEPRINT - RECEIVE SUPPLY COLUMN DELETED CLEANLY */}
        {outletTab === 'blueprint' && (
          <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 max-w-3xl">
            <h2 className="text-xs font-bold text-teal-400 uppercase tracking-widest mb-4">Live Inventory Blueprint</h2>
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
        )}

        {outletTab === 'history' && (
          <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800 max-w-3xl">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Received Stock History Ledger</h2>
            <div className="max-h-96 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800">
              {allReplenishments.length === 0 ? (
                <p className="p-4 text-center text-xs font-mono text-slate-600 italic">No incoming deliveries logged yet.</p>
              ) : (
                allReplenishments.map((log, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 font-mono text-xs">
                    <div>
                      <span className="font-bold text-white bg-slate-900 px-2 py-0.5 rounded mr-2 uppercase text-[10px] border border-slate-800">
                        {formatIngredientLabel(log.item_name)}
                      </span>
                      <span className="text-slate-400 text-[10px] font-sans">Day Check Index: {log.day_of_month}th</span>
                    </div>
                    <span className="text-emerald-400 font-black text-sm">+{log.quantity_added} units</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {outletTab === 'lookup' && (
          <section className="rounded-2xl bg-slate-900 p-6 border border-slate-800 max-w-4xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Outlet Sales History lookup</h3>
                <p className="text-[10px] text-slate-500 font-sans mt-0.5">Filter and review past performance summaries directly on the counter</p>
              </div>
              <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 p-2 rounded-xl font-mono text-xs">
                <input type="date" value={outletPeriodStart} onChange={(e) => setOutletPeriodStart(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none" />
                <span className="text-slate-500 text-xs font-sans">to</span>
                <input type="date" value={outletPeriodEnd} onChange={(e) => setOutletPeriodEnd(e.target.value)} className="bg-slate-900 border border-slate-700 text-white rounded px-2 py-1 focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Window Sales Total</span>
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
          </section>
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 font-sans text-slate-100 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-5 gap-4">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-black text-amber-400 tracking-tight">👑 Omkar enterprise Command Dashboard</h1>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-widest">Cross-Branch Analytics & Inventory Control Console</p>
          </div>

          <div className="bg-gradient-to-r from-amber-500/10 to-blue-500/5 border border-amber-500/20 px-4 py-2 rounded-xl hidden md:block">
            <span className="text-[9px] uppercase font-black text-amber-400 block tracking-widest">Network Top Performer</span>
            <span className="text-xs font-black text-white font-sans uppercase">{globalTopPerformer}</span>
          </div>
        </div>
        <button onClick={exitToGateway} className="rounded-lg bg-slate-850 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-red-900 hover:text-white transition">Exit Portal</button>
      </header>

      {/* TOP STATS BLOCKS MATCHING IMAGE 3 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl shadow-lg">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 block">Network Today Sales</span>
          <span className="text-3xl font-black text-emerald-400 tracking-tight font-mono block mt-1">${globalPromoterTodaySalesRevenue.toLocaleString()}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl shadow-lg">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 block">Net Orders</span>
          <span className="text-3xl font-black text-blue-400 tracking-tight font-mono block mt-1">{globalPromoterTodayOrderCount}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl shadow-lg">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 block">Net Items</span>
          <span className="text-3xl font-black text-amber-500 tracking-tight font-mono block mt-1">{globalPromoterTodayItemCount}</span>
        </div>
      </div>

      {/* PROMOTER DESK SELECTION TABS ROW */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-0.5">
        <button onClick={() => setPromoterTab('overview')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-t-2 ${promoterTab === 'overview' ? 'bg-slate-900 text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>🗂️ Network Overview</button>
        <button onClick={() => setPromoterTab('branches')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-t-2 ${promoterTab === 'branches' ? 'bg-slate-900 text-purple-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>🏪 Branch-by-Branch Matrix</button>
        <button onClick={() => setPromoterTab('revenue_matrix')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-t-2 ${promoterTab === 'revenue_matrix' ? 'bg-slate-900 text-emerald-400 border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>💰 Revenue Matrix</button>
        <button onClick={() => setPromoterTab('dispatch')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-t-2 ${promoterTab === 'dispatch' ? 'bg-slate-900 text-teal-400 border-teal-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>📦 Stock Dispatch Desk</button>
        <button onClick={() => setPromoterTab('security')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-t-2 ${promoterTab === 'security' ? 'bg-slate-900 text-red-400 border-red-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>🔐 Terminal Security Locks</button>
      </div>

      {promoterTab === 'overview' && (
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-3 border-b border-slate-800">
            <h2 className="text-sm font-bold text-blue-400 uppercase tracking-widest">Network Analytics Audit Filter</h2>
            <div className="flex items-center gap-1.5 text-xs font-mono bg-slate-950 p-2 border border-slate-800 rounded-xl">
              <span className="text-slate-500 font-sans font-bold text-[10px]">From:</span>
              <input type="date" value={auditStartDate} onChange={(e) => setAuditStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none text-xs" />
              <span className="text-slate-500 font-sans font-bold text-[10px]">To:</span>
              <input type="date" value={auditEndDate} onChange={(e) => setAuditEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none text-xs" />
            </div>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {(() => {
              let rev = 0, ord = 0, itm = 0
              outlets.forEach(o => {
                const stats = getOutletSalesStatsForDateRange(o.id, auditStartDate, auditEndDate)
                rev += stats.salesAmountTotal
                ord += stats.transactionsLoggedCount
                itm += stats.totalItemsDispatchedCount
              })
              return (
                <>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center shadow">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Combined Period Revenue</span>
                    <span className="text-2xl font-black text-emerald-400 font-mono block mt-1">${rev.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center shadow">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Combined Period Orders</span>
                    <span className="text-2xl font-black text-blue-400 font-mono block mt-1">{ord.toLocaleString()} orders</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center shadow">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Combined Period Items Sold</span>
                    <span className="text-2xl font-black text-amber-500 font-mono block mt-1">{itm.toLocaleString()} units</span>
                  </div>
                </>
              )
            })()}
          </div>
        </section>
      )}

      {promoterTab === 'branches' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outlets.map(o => {
            const range = branchMatrixDateRanges[o.id] || { start: getTodayDateString(), end: getTodayDateString() }
            const stats = getOutletSalesStatsForDateRange(o.id, range.start, range.end)
            return (
              <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h4 className="text-base font-black text-purple-400 border-b border-slate-800 pb-2">{o.name} Live Matrix</h4>
                
                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Matrix Date Window</span>
                  <div className="flex items-center justify-between gap-1 font-mono text-[11px]">
                    <input 
                      type="date" 
                      value={range.start} 
                      onChange={(e) => setBranchMatrixDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], start: e.target.value } }))} 
                      className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                    />
                    <span className="text-slate-600 font-sans text-xs">to</span>
                    <input 
                      type="date" 
                      value={range.end} 
                      onChange={(e) => setBranchMatrixDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], end: e.target.value } }))} 
                      className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span className="text-[9px] font-sans text-slate-500 block">Revenue</span>
                    <span className="font-bold text-emerald-400">${stats.salesAmountTotal.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span className="text-[9px] font-sans text-slate-500 block">Orders Done</span>
                    <span className="font-bold text-blue-400">{stats.transactionsLoggedCount}</span>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span className="text-[9px] font-sans text-slate-500 block">Raw Materials Consumed</span>
                    <span className="font-bold text-amber-500">{stats.totalItemsDispatchedCount}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* REVENUE MATRIX TAB - FIXED DIRECT STRING QUERY CALCULATION TO ELIMINATE THE 0 BUG */}
      {promoterTab === 'revenue_matrix' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {outlets.map(o => {
            const range = revenueCardDateRanges[o.id] || { start: getTodayDateString(), end: getTodayDateString() }
            const stats = getOutletSalesStatsForDateRange(o.id, range.start, range.end)

            return (
              <div key={o.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4">
                
                <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                  <div>
                    <h4 className="text-base font-black text-white">{o.name} Revenue Card</h4>
                    <span className="text-[9px] text-slate-500 uppercase font-black tracking-wider">Financial Auditor Suite</span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">${stats.salesAmountTotal.toLocaleString()}</span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Card Audit Date Window</span>
                  <div className="flex items-center justify-between gap-1 font-mono text-[11px]">
                    <input 
                      type="date" 
                      value={range.start} 
                      onChange={(e) => setRevenueCardDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], start: e.target.value } }))} 
                      className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                    />
                    <span className="text-slate-600 font-sans text-xs">to</span>
                    <input 
                      type="date" 
                      value={range.end} 
                      onChange={(e) => setRevenueCardDateRanges(prev => ({ ...prev, [o.id]: { ...prev[o.id], end: e.target.value } }))} 
                      className="bg-slate-900 border border-slate-700 text-white rounded px-1.5 py-0.5 focus:outline-none w-[105px]" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px] pt-1">
                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span className="text-[9px] font-sans text-slate-500 block">Total Revenue</span>
                    <span className="font-bold text-emerald-400">${stats.salesAmountTotal.toLocaleString()}</span>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span className="text-[9px] font-sans text-slate-500 block">Orders Done</span>
                    <span className="font-bold text-blue-400">{stats.transactionsLoggedCount}</span>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded border border-slate-800/60">
                    <span className="text-[9px] font-sans text-slate-500 block">Total Used</span>
                    <span className="font-bold text-amber-500">{stats.totalItemsDispatchedCount}</span>
                  </div>
                </div>

                <div className="bg-slate-950 rounded-xl px-3 py-1.5 border border-amber-500/10 text-center">
                  <span className="text-[10px] font-sans text-amber-400 font-bold block">
                    🏆 Highest Velocity Material: <span className="text-white font-mono font-black uppercase">{stats.highestIngredientName}</span>
                  </span>
                </div>

                {/* SCROLLABLE DATABASE RAW COMPONENT TIMELINE AUDITOR DESK */}
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1 text-[11px] max-h-40 overflow-y-auto">
                  <span className="text-[9px] text-emerald-400 uppercase font-bold tracking-wider block mb-1">Ingredient Consumption Dissection:</span>
                  {distinctIngredients.filter(ing => ing !== 'Boxes').map((ingName, idx) => {
                    const qtyUsed = stats.rawIngredientQuantities[ingName] || 0;
                    return (
                      <div key={idx} className="flex justify-between items-center font-mono text-slate-400 border-b border-slate-900 pb-1 pt-0.5 last:border-0">
                        <span className="font-sans text-white capitalize">{formatIngredientLabel(ingName)}</span>
                        <span className="text-emerald-400 font-bold">{qtyUsed.toLocaleString()} units consumed</span>
                      </div>
                    )
                  })}
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* FULLY FUNCTIONAL STOCK DISPATCH DESK CONTROLLER */}
      {promoterTab === 'dispatch' && (
        <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4 max-w-xl">
          <div>
            <h2 className="text-sm font-bold text-teal-400 uppercase tracking-widest">Master Stock Dispatch Desk</h2>
            <p className="text-[11px] text-slate-400 font-sans mt-0.5">Issue inventory drop deliveries across locations directly from central command</p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex flex-col space-y-1 text-xs">
              <span className="text-slate-400 font-bold">Target Destination Location:</span>
              <select value={dispatchOutlet} onChange={(e) => setDispatchOutlet(e.target.value)} className="bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-bold outline-none focus:border-teal-500">
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="flex flex-col space-y-1 text-xs">
              <span className="text-slate-400 font-bold">Material Item Classification:</span>
              <select value={dispatchIngredient} onChange={(e) => setDispatchIngredient(e.target.value)} className="bg-slate-950 border border-slate-700 text-white rounded p-2.5 font-bold outline-none focus:border-teal-500">
                {distinctIngredients.map((ing, idx) => <option key={idx} value={ing}>{formatIngredientLabel(ing)}</option>)}
              </select>
            </div>

            <div className="flex flex-col space-y-1 text-xs">
              <span className="text-slate-400 font-bold">Dispatch Unit Quantity Volume:</span>
              <input type="number" placeholder="Enter quantity to add..." value={dispatchQty || ''} onChange={(e) => setDispatchQty(Number(e.target.value))} className="bg-slate-950 border border-slate-700 text-teal-400 rounded p-2.5 font-mono font-black text-sm outline-none focus:border-teal-500" />
            </div>

            <button onClick={handleExecuteDispatch} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition mt-2">
              🚚 Log Central Supply Dispatch
            </button>
          </div>
        </section>
      )}

      {promoterTab === 'security' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl">
          <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-2">Terminal Access Lock Desk</h3>
          <p className="text-xs text-slate-400 font-sans">Multi-terminal active verification locks are mapped secure within central parameters.</p>
        </section>
      )}
    </main>
  )
}

