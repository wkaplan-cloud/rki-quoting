'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Item } from '@/lib/types'
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'

export function ItemsManager({ items: initial }: { items: Item[] }) {
  const [items, setItems] = useState(initial)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const supabase = createClient()

  async function add() {
    if (!newName.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: orgId } = await supabase.rpc('get_current_org_id')
    const { data, error } = await supabase.from('items').insert({ item_name: newName.trim(), user_id: user!.id, org_id: orgId }).select().single()
    if (error) { toast.error(error.message); return }
    setItems(i => [...i, data].sort((a, b) => a.item_name.localeCompare(b.item_name)))
    setNewName('')
    toast.success('Item added')
  }

  async function save(id: string) {
    if (!editName.trim()) return
    await supabase.from('items').update({ item_name: editName.trim() }).eq('id', id)
    setItems(i => i.map(item => item.id === id ? { ...item, item_name: editName.trim() } : item))
    setEditId(null)
    toast.success('Item updated')
  }

  async function remove(id: string) {
    if (!confirm('Delete this item?')) return
    await supabase.from('items').delete().eq('id', id)
    setItems(i => i.filter(item => item.id !== id))
    toast.success('Item deleted')
  }

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div className="flex gap-2">
        <input
          type="text" placeholder="New item name…" value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          className="flex-1 px-3 py-2 bg-white border border-[#D8D3C8] rounded text-sm outline-none focus:border-[#9A7B4F]"
        />
        <button onClick={add} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2C2C2A] text-white text-sm rounded hover:bg-[#9A7B4F] transition-colors cursor-pointer">
          <Plus size={14} /> Add
        </button>
      </div>

      {/* List */}
      <div className="bg-white border border-[#D8D3C8] rounded overflow-hidden">
        {items.length === 0 ? (
          <p className="py-10 text-center text-[#8A877F] text-sm">No items yet — add one above</p>
        ) : (
          items.map((item, i) => (
            <div key={item.id} className={`flex items-center gap-3 px-4 py-2.5 group ${i < items.length - 1 ? 'border-b border-[#EDE9E1]' : ''}`}>
              {editId === item.id ? (
                <>
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') save(item.id); if (e.key === 'Escape') setEditId(null) }}
                    className="flex-1 px-2 py-1 border border-[#9A7B4F] rounded text-sm outline-none" />
                  <button onClick={() => save(item.id)} className="p-1 text-green-600 hover:text-green-700 cursor-pointer"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="p-1 text-[#8A877F] hover:text-[#2C2C2A] cursor-pointer"><X size={14} /></button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm text-[#2C2C2A]">{item.item_name}</span>
                  <button onClick={() => { setEditId(item.id); setEditName(item.item_name) }}
                    className="p-1 text-[#D8D3C8] hover:text-[#8A877F] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Pencil size={13} /></button>
                  <button onClick={() => remove(item.id)}
                    className="p-1 text-[#D8D3C8] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"><Trash2 size={13} /></button>
                </>
              )}
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-[#8A877F]">{items.length} item{items.length !== 1 ? 's' : ''} — these appear as suggestions in the line items table</p>
    </div>
  )
}
