import { useState } from 'react'
import { Check, Search, Users } from 'lucide-react'
import { Avatar, Drawer } from '../../../components/ui'
import type { EntityId, Student } from '../../../domain/models'

export function AssignmentDrawer({ open, students, onClose, onSave }: { open: boolean; students: Student[]; onClose: () => void; onSave: (studentIds: EntityId[]) => void }) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EntityId[]>(students.map(student => student.id))
  const filtered = students.filter(student => student.name.toLowerCase().includes(query.toLowerCase()))
  return <Drawer open={open} title="Atur assignment peserta" description="Pilih peserta yang berhak mengikuti ujian." onClose={onClose} footer={<><button className="button secondary" onClick={onClose}>Batal</button><button className="button primary" onClick={() => onSave(selected)}><Check /> Simpan assignment</button></>}>
    <div className="drawer-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama peserta..." /></div>
    <button className="drawer-select-all" onClick={() => setSelected(selected.length === students.length ? [] : students.map(student => student.id))}><Users /><span><strong>{selected.length} peserta dipilih</strong><small>Pilih atau batalkan semua peserta</small></span></button>
    <div className="drawer-student-list">{filtered.map(student => <label key={student.id}><input type="checkbox" checked={selected.includes(student.id)} onChange={() => setSelected(selected.includes(student.id) ? selected.filter(id => id !== student.id) : [...selected, student.id])} /><Avatar name={student.name} /><span><strong>{student.name}</strong><small>{student.level} · Kelas {student.className} · Fase {student.phase}</small></span></label>)}</div>
  </Drawer>
}
