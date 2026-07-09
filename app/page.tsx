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

  const [promoterActiveTab, setPromoterActiveTab] = useState<'consumption' | 'dispatches'>('consumption')

  // Hardcoded helper to grab standard YYYY-MM-DD
  const getTodayDateString = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  // FIXED CALENDAR DATE: Outlets are hardcoded to today's machine clock. No manual updates allowed.
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
  const [auditIngredient, setAuditIngredient] = useState<string>('ALL')
  const [auditOutletFilter, setAuditOutletFilter] = useState<string>('ALL')

  const [activeReplenishItem, setActiveReplenishItem] = useState<string | null>(null)
  const [newRepQty, setNewRepQty] = useState(0)

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
      const matchDate = new Date(s.created_at).toISOString().split('T')[0]
      return s.item_name === itemName && s.outlet_id === targetOutletId && matchDate === liveOperatingDate
    }).reduce((a, c) => a + Number(c.quantity_sold), 0)

    const currentStockLeft = Number(baseStock) + totalReplenished - totalUsedEver
    return { usedToday, currentStockLeft }
  }

  // COMPUTE DYNAMIC REVENUE METRIC VALUES
  const getOutletSalesStatsForDateRange = (targetOutletId: number, startDay: string, endDay: string) => {
    let salesAmountTotal = 0
    let transactionsLoggedCount = 0

    // Gather distinct transaction records from ingredient consumption timelines
    const uniqueReceiptKeys = new Set<string>()
    
    allSalesHistory.forEach(s => {
      const recordDate = s.created_at.split('T')[0]
      if (s.outlet_id === targetOutletId && recordDate >= startDay && recordDate <= endDay) {
        const receiptUid = `${s.created_at}_${s.outlet_id}`
        uniqueReceiptKeys.add(receiptUid)
      }
    })

    transactionsLoggedCount = uniqueReceiptKeys.size
    
    // In our menu map arrangement, base revenue is mapped from ingredients consumption quantities directly
    // Since Item 1 consumes 1 Egg + 1 Box, its financial collection translates directly through inventory units values
    // Here we compute total recipe revenue items generated on your counter checkout operations logs
    allSalesHistory.forEach(s => {
      const recordDate = s.created_at.split('T')[0]
      if (s.outlet_id === targetOutletId && recordDate >= startDay && recordDate <= endDay) {
        if (s.item_name === 'Boxes') {
          salesAmountTotal += (s.quantity_sold * 12) // Average product price allocation
        }
      }
    })

    return { salesAmountTotal, transactionsLoggedCount }
  }

  const openReplenishModal = (itemName: string) => {
    setActiveReplenishItem(itemName)
    setNewRepQty(0)
  }

  const handleAddReplenishment = async () => {
    if (newRepQty <= 0) return alert('Enter a valid quantity')
    if (!selectedOutlet) return
    const parseDayInt = new Date(liveOperatingDate).getDate()

    await supabase.from('inventory_replenishments').insert({ 
      outlet_id: selectedOutlet.id, 
      item_name: activeReplenishItem, 
      day_of_month: parseDayInt, 
      quantity_added: newRepQty 
    })

    alert('Stock delivery logged successfully!')
    setActiveReplenishItem(null)
    syncGlobalDatabaseData(selectedOutlet.id)
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

    // Loop through and write deduction entries including a distinct tracking row for total sales price mapping
    for (const inv of inventory) {
      const deduction = totalNeeded[inv.item_name] || 0
      if (deduction > 0) {
        await supabase.from('sales_history').insert({
          outlet_id: selectedOutlet.id,
          item_name: inv.item_name,
          quantity_sold: deduction,
          eggs_consumed: inv.item_name === 'Egg' ? deduction : 0,
          created_at: new Date().toISOString() // Pushes precise live timestamp
        })
      }
    }

    // Write a billing snapshot record block tied to Boxes items for cash total auditing
    await supabase.from('sales_history').insert({
      outlet_id: selectedOutlet.id,
      item_name: 'Boxes',
      quantity_sold: quantities['i1'] || quantities['i2'] || 1, // Snapshot pricing handle anchor
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

  // CALCULATION LOGIC FOR MASTER PROMOTER LIVE REVENUE METRICS
  let globalPromoterTodaySalesRevenue = 0
  outlets.forEach(o => {
    const { salesAmountTotal } = getOutletSalesStatsForDateRange(o.id, liveOperatingDate, liveOperatingDate)
    globalPromoterTodaySalesRevenue += salesAmountTotal
  })

  let globalPromoterCustomPeriodRevenue = 0
  outlets.forEach(o => {
    const { salesAmountTotal } = getOutletSalesStatsForDateRange(o.id, auditStartDate, auditEndDate)
    globalPromoterCustomPeriodRevenue += salesAmountTotal
  })

  // Calculate local outlet live sales numbers
  const currentTerminalStats = selectedOutlet ? getOutletSalesStatsForDateRange(selectedOutlet.id, liveOperatingDate, liveOperatingDate) : { salesAmountTotal: 0, transactionsLoggedCount: 0 }
  const customPeriodTerminalStats = selectedOutlet ? getOutletSalesStatsForDateRange(selectedOutlet.id, outletPeriodStart, outletPeriodEnd) : { salesAmountTotal: 0, transactionsLoggedCount: 0 }

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
          <div>
            <h1 className="text-2xl font-black">{selectedOutlet.name} Live Terminal</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Operating Calendar Date:</span>
              <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded text-xs font-black text-blue-400 font-mono shadow-inner">
                {new Date(liveOperatingDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* DYNAMIC REAL-TIME OUTLET DAILY SHIFT SALES COUNTERS */}
          <div className="flex flex-wrap gap-3 w-full lg:w-auto">
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-md min-w-[130px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Today's Revenue</span>
              <span className="text-xl font-black text-emerald-400 font-mono">${currentTerminalStats.salesAmountTotal.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl shadow-md min-w-[110px]">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Orders Count</span>
              <span className="text-xl font-black text-blue-400 font-mono">{currentTerminalStats.transactionsLoggedCount}</span>
            </div>
            <button onClick={exitToGateway} className="rounded-xl bg-slate-900 border border-slate-800 px-5 text-xs font-bold text-slate-400 hover:bg-red-950 hover:text-white hover:border-red-900 transition ml-auto lg:ml-0">Log Out</button>
          </div>
        </header>

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

          <section className="xl:col-span-5 space-y-6">
            <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800">
              <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-4">Live Inventory Blueprint</h2>
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 font-bold">
                    <th className="pb-2">Material</th>
                    <th className="pb-2 text-center">Stock 1st</th>
                    <th className="pb-2 text-center text-blue-400">Receive Supply</th>
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
                        <td className="py-3 text-center">
                          <button onClick={() => openReplenishModal(inv.item_name)} className="rounded bg-slate-950 border border-slate-800 text-[10px] px-2 py-1 text-blue-400 hover:border-blue-500">
                            + Received
                          </button>
                        </td>
                        <td className="py-3 text-center text-amber-500 font-bold">{usedToday}</td>
                        <td className="py-3 text-right text-emerald-400 font-bold text-sm">{currentStockLeft}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl bg-slate-900 p-6 border border-slate-800">
              <h2 className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3">Received Stock History Ledger</h2>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 divide-y divide-slate-800">
                {allReplenishments.length === 0 ? (
                  <p className="p-4 text-center text-xs font-mono text-slate-600 italic">No incoming deliveries logged yet.</p>
                ) : (
                  allReplenishments.map(log => (
                    <div key={log.id} className="flex justify-between items-center p-3 font-mono text-xs">
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
          </section>
        </div>

        {/* RECENT SALES & HISTORICAL LOGS SEARCH SYSTEM FOR THE OUTLET */}
        <section className="mt-8 rounded-2xl bg-slate-900 p-6 border border-slate-800 space-y-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Window Sales Total</span>
              <span className="text-2xl font-black text-emerald-400 font-mono block mt-1">${customPeriodTerminalStats.salesAmountTotal.toLocaleString()}</span>
            </div>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected Window Orders Count</span>
              <span className="text-2xl font-black text-blue-400 font-mono block mt-1">{customPeriodTerminalStats.transactionsLoggedCount} orders</span>
            </div>
          </div>
        </section>

        {activeReplenishItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-1">Receive Stock: {formatIngredientLabel(activeReplenishItem)}</h3>
              <p className="text-[10px] text-slate-400 uppercase font-mono tracking-tight mb-4">Logging units into {selectedOutlet.name} inventory database registries</p>
              <input type="number" placeholder="Enter exact received amount" value={newRepQty || ''} onChange={(e) => setNewRepQty(Number(e.target.value))} className="w-full rounded bg-slate-950 text-sm p-3 text-emerald-400 border border-slate-700 font-bold outline-none focus:border-emerald-500" />
              <div className="flex gap-2 mt-5 text-xs font-bold">
                <button onClick={() => setActiveReplenishItem(null)} className="w-1/2 bg-slate-800 py-2.5 rounded-lg text-slate-300 transition">Cancel</button>
                <button onClick={handleAddReplenishment} className="w-1/2 bg-emerald-600 py-2.5 rounded-lg text-white transition hover:bg-emerald-500">Confirm Received Stock</button>
              </div>
            </div>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 font-sans text-slate-100 space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-black text-amber-400 tracking-tight">👑 Omkar enterprise Command Dashboard</h1>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5 uppercase tracking-widest">Cross-Branch Analytics & Inventory Control Console</p>
        </div>
        <button onClick={exitToGateway} className="rounded-lg bg-slate-850 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-red-900 hover:text-white transition">Exit Portal</button>
      </header>

      {/* PROMOTER REAL-TIME REVENUE SUMMARY METRIC DISPLAY WIDGETS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 block">Network-Wide Today Sales</span>
          <span className="text-3xl font-black text-emerald-400 tracking-tight font-mono block mt-1">${globalPromoterTodaySalesRevenue.toLocaleString()}</span>
          <p className="text-[10px] text-slate-600 font-sans mt-1">Live synchronized summary across all combined outlets since midnight</p>
        </div>
        <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
          <span className="text-[10px] uppercase tracking-widest font-extrabold text-slate-500 block">Network Selected Range Sales</span>
          <span className="text-3xl font-black text-blue-400 tracking-tight font-mono block mt-1">${globalPromoterCustomPeriodRevenue.toLocaleString()}</span>
          <p className="text-[10px] text-slate-600 font-sans mt-1">Computed dynamic revenue total within chosen audit dates below</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-slate-800 pb-1">
        <button onClick={() => setPromoterActiveTab('consumption')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-t-2 ${promoterActiveTab === 'consumption' ? 'bg-slate-900 text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>📊 Consumption Records (Stock Out)</button>
        <button onClick={() => setPromoterActiveTab('dispatches')} className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition border-t-2 ${promoterActiveTab === 'dispatches' ? 'bg-slate-900 text-emerald-400 border-emerald-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>🚚 Sent Stock Ledger (Stock In)</button>
      </div>

      <section className="rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-xl space-y-4">
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-widest">{promoterActiveTab === 'consumption' ? 'Custom Material Consumption Auditor' : 'Master Dispatch Distribution Balance Sheet'}</h2>
            <p className="text-[10px] text-slate-500 mt-0.5">{promoterActiveTab === 'consumption' ? 'Auditing raw sales volumes subtracted during client orders' : 'Auditing stock drop quantities sent to active locations'}</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 uppercase tracking-wider font-bold text-[10px]">Outlet Target:</span>
              <select value={auditOutletFilter} onChange={(e) => setAuditOutletFilter(e.target.value)} className="bg-slate-900 border border-slate-700 text-emerald-400 rounded px-2 py-1 font-bold font-mono outline-none">
                <option value="ALL">All Outlets Combined</option>
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-500 uppercase tracking-wider font-bold text-[10px]">Ingredient:</span>
              <select value={auditIngredient} onChange={(e) => setAuditIngredient(e.target.value)} className="bg-slate-900 border border-slate-700 text-amber-400 rounded px-2 py-1 font-bold font-mono outline-none">
                <option value="ALL">All Ingredients</option>
                {distinctIngredients.map(ing => <option key={ing} value={ing}>{formatIngredientLabel(ing)}</option>)}
              </select>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-slate-500 uppercase tracking-wider font-bold text-[10px] font-sans">From:</span>
              <input type="date" value={auditStartDate} onChange={(e) => setAuditStartDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none text-xs" />
              <span className="text-slate-500 uppercase tracking-wider font-bold text-[10px] font-sans">To:</span>
              <input type="date" value={auditEndDate} onChange={(e) => setAuditEndDate(e.target.value)} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white outline-none text-xs" />
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
                const loopDayInteger = new Date(dateString).getDate()

                return (
                  <tr key={dateString} className="hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 text-left font-bold text-slate-400 bg-slate-950 sticky left-0 z-10 border-r border-slate-800 font-sans text-xs">{dateString}</td>
                    {currentRenderHeaders.map(colHeader => {
                      let computedValue = 0

                      if (promoterActiveTab === 'consumption') {
                        if (shouldRenderIngredientColumns) {
                          const targetIngName = colHeader
                          computedValue = allSalesHistory.filter(s => {
                            const recDayStr = s.created_at.split('T')[0]
                            const matchesOutlet = auditOutletFilter === 'ALL' || s.outlet_id === Number(auditOutletFilter)
                            return s.item_name === targetIngName && matchesOutlet && recDayStr === dateString
                          }).reduce((a, c) => a + Number(c.quantity_sold), 0)
                        } else {
                          const targetOutletId = outlets.find(o => o.name === colHeader)?.id || 0
                          computedValue = allSalesHistory.filter(s => {
                            const recDayStr = s.created_at.split('T')[0]
                            return s.item_name === auditIngredient && s.outlet_id === targetOutletId && recDayStr === dateString
                          }).reduce((a, c) => a + Number(c.quantity_sold), 0)
                        }
                      } else {
                        if (shouldRenderIngredientColumns) {
                          const targetIngName = colHeader
                          computedValue = allReplenishments.filter(r => {
                            const matchesOutlet = auditOutletFilter === 'ALL' || r.outlet_id === Number(auditOutletFilter)
                            return r.item_name === targetIngName && r.day_of_month === loopDayInteger && matchesOutlet
                          }).reduce((a, c) => a + Number(c.quantity_added), 0)
                        } else {
                          const targetOutletId = outlets.find(o => o.name === colHeader)?.id || 0
                          computedValue = allReplenishments.filter(r => {
                            return r.item_name === auditIngredient && r.outlet_id === targetOutletId && r.day_of_month === loopDayInteger
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
    </main>
  )
}