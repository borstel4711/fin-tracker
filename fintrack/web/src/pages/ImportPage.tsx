import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { ImportProfile, ImportResult } from '../types';

type ProfileForm = Omit<ImportProfile, 'id'>;

const emptyProfile: ProfileForm = {
  name: '',
  delimiter: ';',
  encoding: 'latin1',
  date_format: 'DD.MM.YYYY',
  decimal_comma: 1,
  skip_rows: 0,
  col_date: '',
  col_amount: '',
  col_debit: '',
  col_credit: '',
  col_counterparty: '',
  col_purpose: '',
  col_balance: '',
};

export default function ImportPage() {
  const [profiles, setProfiles] = useState<ImportProfile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [newProfile, setNewProfile] = useState<ProfileForm>(emptyProfile);
  const [showProfileForm, setShowProfileForm] = useState(false);

  const loadProfiles = () => api.get<ImportProfile[]>('/profiles').then(setProfiles).catch(() => {});

  useEffect(() => {
    loadProfiles();
  }, []);

  const submitImport = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!file || !profileId) {
      setError('Bitte Profil und Datei wählen.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    formData.append('profile_id', profileId);
    try {
      const res = await api.upload<ImportResult>('/import', formData);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const createProfile = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...newProfile,
      decimal_comma: Number(newProfile.decimal_comma),
      skip_rows: Number(newProfile.skip_rows),
    };
    await api.post('/profiles', payload);
    setNewProfile(emptyProfile);
    setShowProfileForm(false);
    loadProfiles();
  };

  return (
    <div className="space-y-6">
      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <h2 className="text-base font-semibold">CSV importieren</h2>
        <form onSubmit={submitImport} className="space-y-3">
          <select className="border rounded px-2 py-1 w-full" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            <option value="">Importprofil wählen…</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
            Importieren
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <p className="text-sm text-slate-600">
            {result.inserted} neu, {result.skipped} Dubletten übersprungen (von {result.row_count} Zeilen).
          </p>
        )}
      </section>

      <section className="bg-white rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Importprofile</h2>
          <button className="text-sm text-blue-600 hover:underline" onClick={() => setShowProfileForm((v) => !v)}>
            {showProfileForm ? 'Abbrechen' : '+ Neues Profil'}
          </button>
        </div>

        <ul className="text-sm divide-y">
          {profiles.map((p) => (
            <li key={p.id} className="py-2">
              <span className="font-medium">{p.name}</span>{' '}
              <span className="text-slate-500">
                ({p.delimiter} · {p.encoding} · {p.date_format})
              </span>
            </li>
          ))}
        </ul>

        {showProfileForm && (
          <form onSubmit={createProfile} className="grid grid-cols-2 gap-2 text-sm pt-2 border-t">
            <Field label="Name" value={newProfile.name} onChange={(v) => setNewProfile({ ...newProfile, name: v })} required />
            <Field
              label="Trennzeichen"
              value={newProfile.delimiter}
              onChange={(v) => setNewProfile({ ...newProfile, delimiter: v })}
            />
            <Field
              label="Encoding (latin1/utf8)"
              value={newProfile.encoding}
              onChange={(v) => setNewProfile({ ...newProfile, encoding: v as ImportProfile['encoding'] })}
            />
            <Field
              label="Datumsformat"
              value={newProfile.date_format}
              onChange={(v) => setNewProfile({ ...newProfile, date_format: v })}
            />
            <Field
              label="Dezimalkomma (1/0)"
              value={String(newProfile.decimal_comma)}
              onChange={(v) => setNewProfile({ ...newProfile, decimal_comma: Number(v) })}
            />
            <Field
              label="Müllzeilen vor Header"
              value={String(newProfile.skip_rows)}
              onChange={(v) => setNewProfile({ ...newProfile, skip_rows: Number(v) })}
            />
            <Field
              label="Spalte Datum"
              value={newProfile.col_date}
              onChange={(v) => setNewProfile({ ...newProfile, col_date: v })}
              required
            />
            <Field
              label="Spalte Betrag"
              value={newProfile.col_amount ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_amount: v })}
            />
            <Field
              label="Spalte Soll"
              value={newProfile.col_debit ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_debit: v })}
            />
            <Field
              label="Spalte Haben"
              value={newProfile.col_credit ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_credit: v })}
            />
            <Field
              label="Spalte Empfänger"
              value={newProfile.col_counterparty ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_counterparty: v })}
            />
            <Field
              label="Spalte Zweck"
              value={newProfile.col_purpose ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_purpose: v })}
            />
            <Field
              label="Spalte Saldo"
              value={newProfile.col_balance ?? ''}
              onChange={(v) => setNewProfile({ ...newProfile, col_balance: v })}
            />
            <div className="col-span-2">
              <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm">
                Profil speichern
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-slate-500">{label}</span>
      <input className="border rounded px-2 py-1" value={value} required={required} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
