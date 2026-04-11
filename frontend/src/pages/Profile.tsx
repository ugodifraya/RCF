import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, setUser } = useAuth();

  // Profile form
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [position, setPosition] = useState(user?.position || '');
  const [number, setNumber] = useState(user?.number?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatarUrl || null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Measurements
  const [measurements, setMeasurements] = useState<{ id: string; weight: number | null; height: number | null; date: string }[]>([]);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [measDate, setMeasDate] = useState(new Date().toISOString().slice(0, 10));
  const [measSaving, setMeasSaving] = useState(false);
  const [measMsg, setMeasMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [showReminder, setShowReminder] = useState(false);

  useEffect(() => {
    api.get('/performance/my-measurements').then(r => {
      setMeasurements(r.data);
      if (r.data.length > 0) {
        const last = new Date(r.data[0].date);
        const daysSince = Math.floor((Date.now() - last.getTime()) / 86400000);
        if (daysSince >= 28) setShowReminder(true);
        // Pre-fill from last entry
        if (r.data[0].weight) setWeight(r.data[0].weight.toString());
        if (r.data[0].height) setHeight(r.data[0].height.toString());
      } else {
        setShowReminder(true);
      }
    }).catch(() => {});
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setProfileMsg(null);
    try {
      const res = await api.patch('/users/me', {
        firstName, lastName, email,
        position: position || undefined,
        number: number ? parseInt(number) : undefined,
      });
      setUser(res.data);
      setProfileMsg({ type: 'ok', text: 'Profil mis à jour !' });
    } catch {
      setProfileMsg({ type: 'err', text: 'Erreur lors de la mise à jour.' });
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'err', text: 'Les mots de passe ne correspondent pas.' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'err', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    setPwdSaving(true);
    setPwdMsg(null);
    try {
      await api.patch('/users/me', { currentPassword, password: newPassword });
      setPwdMsg({ type: 'ok', text: 'Mot de passe modifié !' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch {
      setPwdMsg({ type: 'err', text: 'Mot de passe actuel incorrect.' });
    } finally {
      setPwdSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop() || 'jpg';
    setAvatarSaving(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      const base64 = (ev.target?.result as string).split(',')[1];
      try {
        const res = await api.post('/users/me/avatar', { base64, ext });
        setAvatarPreview(res.data.avatarUrl);
        setUser(u => u ? { ...u, avatarUrl: res.data.avatarUrl } : u);
      } catch {
        alert('Erreur lors du téléchargement de la photo.');
      } finally {
        setAvatarSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const saveMeasurement = async () => {
    if (!weight && !height) {
      setMeasMsg({ type: 'err', text: 'Entrez au moins le poids ou la taille.' });
      return;
    }
    setMeasSaving(true);
    setMeasMsg(null);
    try {
      const res = await api.post('/performance/measurements', { weight: weight || undefined, height: height || undefined, date: measDate });
      setMeasurements(prev => [res.data, ...prev]);
      setShowReminder(false);
      setMeasMsg({ type: 'ok', text: 'Mesures enregistrées !' });
    } catch {
      setMeasMsg({ type: 'err', text: 'Erreur lors de l\'enregistrement.' });
    } finally {
      setMeasSaving(false);
    }
  };

  const latestM = measurements[0];
  const previousM = measurements[1];
  const weightDiff = latestM?.weight && previousM?.weight ? +(latestM.weight - previousM.weight).toFixed(1) : null;
  const heightDiff = latestM?.height && previousM?.height ? +(latestM.height - previousM.height).toFixed(1) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mon profil</h1>
        <p className="text-gray-500 text-sm mt-1">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar */}
      <div className="card flex items-center gap-5">
        <div className="relative shrink-0">
          {avatarPreview ? (
            <img src={avatarPreview} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary-200" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-3xl font-bold text-primary-600">
              {(user?.firstName?.[0] || '') + (user?.lastName?.[0] || '')}
            </div>
          )}
          {avatarSaving && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
            </div>
          )}
        </div>
        <div>
          <p className="font-semibold text-gray-900">{user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-gray-500 capitalize">{user?.role?.toLowerCase()}{user?.position ? ` · ${user.position}` : ''}{user?.number ? ` · #${user.number}` : ''}</p>
          <button onClick={() => fileRef.current?.click()} className="mt-2 text-sm text-primary-600 hover:underline font-medium">
            Changer la photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
      </div>

      {/* Monthly reminder */}
      {showReminder && (
        <div className="card bg-amber-50 border-amber-200">
          <p className="text-sm font-semibold text-amber-800">Rappel mensuel</p>
          <p className="text-sm text-amber-700 mt-0.5">Pensez à mettre à jour votre poids et votre taille pour suivre votre évolution physique.</p>
        </div>
      )}

      {/* Physical measurements */}
      <div className="card space-y-4">
        <h2 className="font-bold text-gray-900">Mesures physiques</h2>

        {latestM && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xs text-blue-600 font-medium">Poids actuel</p>
              <p className="text-2xl font-bold text-blue-800">{latestM.weight ?? '–'}<span className="text-sm font-normal"> kg</span></p>
              {weightDiff !== null && (
                <p className={`text-xs mt-0.5 font-medium ${weightDiff > 0 ? 'text-red-500' : weightDiff < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                  {weightDiff > 0 ? '+' : ''}{weightDiff} kg vs précédent
                </p>
              )}
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center">
              <p className="text-xs text-purple-600 font-medium">Taille actuelle</p>
              <p className="text-2xl font-bold text-purple-800">{latestM.height ?? '–'}<span className="text-sm font-normal"> cm</span></p>
              {heightDiff !== null && (
                <p className={`text-xs mt-0.5 font-medium ${heightDiff > 0 ? 'text-green-500' : heightDiff < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {heightDiff > 0 ? '+' : ''}{heightDiff} cm vs précédent
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Poids (kg)</label>
            <input type="number" step="0.1" className="input" placeholder="Ex: 62.5" value={weight} onChange={e => setWeight(e.target.value)} />
          </div>
          <div>
            <label className="label">Taille (cm)</label>
            <input type="number" step="0.1" className="input" placeholder="Ex: 168" value={height} onChange={e => setHeight(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={measDate} onChange={e => setMeasDate(e.target.value)} />
          </div>
        </div>

        {measMsg && (
          <p className={`text-sm ${measMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{measMsg.text}</p>
        )}

        <button onClick={saveMeasurement} disabled={measSaving} className="btn-primary w-full">
          {measSaving ? 'Enregistrement...' : 'Enregistrer les mesures'}
        </button>

        {measurements.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Historique</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {measurements.map((m, i) => (
                <div key={m.id} className="flex justify-between text-sm text-gray-600 py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-400">{new Date(m.date).toLocaleDateString('fr-FR')}</span>
                  <span>{m.weight ? `${m.weight} kg` : '–'}</span>
                  <span>{m.height ? `${m.height} cm` : '–'}</span>
                  {i === 0 && <span className="text-xs bg-primary-100 text-primary-700 px-1.5 rounded">Actuel</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile info */}
      <div className="card space-y-4">
        <h2 className="font-bold text-gray-900">Informations personnelles</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prénom</label>
            <input className="input" value={firstName} onChange={e => setFirstName(e.target.value)} />
          </div>
          <div>
            <label className="label">Nom</label>
            <input className="input" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Poste</label>
            <input className="input" placeholder="Ex: Attaquante" value={position} onChange={e => setPosition(e.target.value)} />
          </div>
          <div>
            <label className="label">Numéro</label>
            <input type="number" className="input" placeholder="Ex: 10" value={number} onChange={e => setNumber(e.target.value)} />
          </div>
        </div>
        {profileMsg && (
          <p className={`text-sm ${profileMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{profileMsg.text}</p>
        )}
        <button onClick={saveProfile} disabled={saving} className="btn-primary w-full">
          {saving ? 'Enregistrement...' : 'Sauvegarder le profil'}
        </button>
      </div>

      {/* Password */}
      <div className="card space-y-4">
        <h2 className="font-bold text-gray-900">Changer le mot de passe</h2>
        <div>
          <label className="label">Mot de passe actuel</label>
          <input type="password" className="input" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Nouveau mot de passe</label>
          <input type="password" className="input" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div>
          <label className="label">Confirmer le nouveau mot de passe</label>
          <input type="password" className="input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>
        {pwdMsg && (
          <p className={`text-sm ${pwdMsg.type === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{pwdMsg.text}</p>
        )}
        <button onClick={savePassword} disabled={pwdSaving || !currentPassword || !newPassword} className="btn-primary w-full">
          {pwdSaving ? 'Modification...' : 'Changer le mot de passe'}
        </button>
      </div>
    </div>
  );
}
