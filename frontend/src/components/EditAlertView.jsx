import React, { useState, useEffect, useMemo } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from 'react-datepicker';
import da from 'date-fns/locale/da';
registerLocale('da', da);

const EditAlertView = () => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [status, setStatus] = useState(null);
    const [token, setToken] = useState(null);
    
    const [form, setForm] = useState({
        site_slug: '',
        email: '',
        start_date: '',
        end_date: '',
        match_type: 'any',
        min_days: 1
    });

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const t = urlParams.get('token');
        if (!t) {
            setError("Intet token angivet i URL'en.");
            setLoading(false);
            return;
        }
        setToken(t);

        // Fetch alert data
        fetch(`/api/alerts/${t}`)
            .then(res => res.json())
            .then(data => {
                if (data.status === 'success') {
                    setForm({
                        site_slug: data.alert.site_slug,
                        email: data.alert.email,
                        start_date: data.alert.start_date,
                        end_date: data.alert.end_date,
                        match_type: data.alert.match_type,
                        min_days: data.alert.min_days
                    });
                } else {
                    setError("Kunne ikke finde overvågningen. Den er muligvis slettet.");
                }
                setLoading(false);
            })
            .catch(err => {
                setError("Der opstod en fejl under indlæsning af overvågningen.");
                setLoading(false);
            });
    }, []);

    const parseDate = (dStr) => {
        if (!dStr) return null;
        const [y, m, d] = dStr.split('-');
        return new Date(y, m - 1, d);
    };

    const formatDate = (date) => {
        if (!date) return '';
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const periodDays = useMemo(() => {
        if (!form.start_date || !form.end_date) return 1;
        const start = parseDate(form.start_date);
        const end = parseDate(form.end_date);
        if (!start || !end) return 1;
        const diff = (end - start) / (1000 * 60 * 60 * 24);
        return Math.max(1, Math.floor(diff) + 1);
    }, [form.start_date, form.end_date]);

    const submitUpdate = async (e) => {
        e.preventDefault();
        setStatus('submitting');
        try {
            const res = await fetch(`/api/alerts/${token}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    start_date: form.start_date,
                    end_date: form.end_date,
                    match_type: form.match_type,
                    min_days: form.match_type === 'all' ? periodDays : form.min_days
                })
            });
            if (res.ok) {
                setStatus('success');
            } else {
                setStatus('error');
            }
        } catch (err) {
            setStatus('error');
        }
    };

    if (loading) return <div className="p-8 text-center" style={{color:'white'}}>Indlæser overvågning...</div>;
    if (error) return <div className="p-8 text-center text-red-500" style={{color:'var(--accent-color)'}}>{error}</div>;

    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', backgroundColor: 'var(--card-bg)', padding: '30px', borderRadius: '12px', border: '1px solid var(--card-border)', color: 'white' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px', color: 'var(--accent-color)' }}>Rediger Overvågning 🏕️</h2>
            <p style={{ marginBottom: '20px', color: '#94a3b8' }}>
                Du redigerer overvågningen for <b>{form.site_slug}</b> (tilknyttet {form.email}).
            </p>

            {status === 'success' ? (
                <div style={{ padding: '20px', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '8px', textAlign: 'center' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>Ændringer gemt! ✅</h3>
                    <p>Din overvågning er nu opdateret. Du får besked når der bliver plads.</p>
                </div>
            ) : (
                <form onSubmit={submitUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label>Startdato:</label>
                            <DatePicker 
                                selected={parseDate(form.start_date)} 
                                onChange={(date) => setForm({...form, start_date: formatDate(date)})} 
                                dateFormat="dd.MM.yyyy"
                                minDate={new Date()}
                                locale="da"
                                required
                            />
                        </div>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label>Slutdato:</label>
                            <DatePicker 
                                selected={parseDate(form.end_date)} 
                                onChange={(date) => setForm({...form, end_date: formatDate(date)})} 
                                dateFormat="dd.MM.yyyy"
                                minDate={parseDate(form.start_date) || new Date()}
                                locale="da"
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <label>Betingelse for besked:</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="radio" name="match_type" value="all" checked={form.match_type === 'all'} onChange={() => setForm({...form, match_type: 'all'})} />
                            Hele perioden skal være ledig
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input type="radio" name="match_type" value="any" checked={form.match_type === 'any'} onChange={() => setForm({...form, match_type: 'any'})} />
                            Giv besked hvis minimum <input type="number" min="1" max={periodDays} value={form.min_days} onChange={(e) => {
                                let val = parseInt(e.target.value) || 1;
                                if (val > periodDays) val = periodDays;
                                if (val < 1) val = 1;
                                setForm({...form, min_days: val, match_type: 'any'});
                            }} onClick={() => setForm({...form, match_type: 'any'})} disabled={form.match_type !== 'any'} style={{ width: '60px', padding: '2px 5px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--card-border)', color: 'white', borderRadius: '4px' }} /> sammenhængende dage er ledige
                        </label>
                    </div>

                    {status === 'error' && (
                        <p style={{ color: '#ef4444' }}>Der skete en fejl. Prøv igen.</p>
                    )}

                    <button type="submit" disabled={status === 'submitting'} style={{ padding: '12px', backgroundColor: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {status === 'submitting' ? 'Gemmer...' : 'Gem Ændringer'}
                    </button>
                    
                    <a href={`/api/alerts/unsubscribe?token=${token}`} target="_blank" rel="noreferrer" style={{ textAlign: 'center', color: '#ef4444', fontSize: '14px', marginTop: '10px' }}>
                        Afmeld overvågning
                    </a>
                </form>
            )}
        </div>
    );
};

export default EditAlertView;
