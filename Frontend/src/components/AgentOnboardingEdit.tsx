import React, { useEffect, useState } from 'react';
import { Camera, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { api, Agent, OnboardingConfig } from '../lib/api';
import { cn } from '../lib/utils';

interface AgentOnboardingEditProps {
  agent: Agent;
  onUpdated: (agent: Agent) => void;
}

export function AgentOnboardingEdit({ agent, onUpdated }: AgentOnboardingEditProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<OnboardingConfig | null>(null);
  const [outletName, setOutletName] = useState(agent.outlet_name || '');
  const [townVillage, setTownVillage] = useState(agent.town_village || '');
  const [personalPhone, setPersonalPhone] = useState(agent.personal_phone || '');
  const [competitors, setCompetitors] = useState<string[]>(
    agent.competitors_present || []
  );
  const [branding, setBranding] = useState<string[]>(agent.branding_present || []);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    agent.location_photo_url || null
  );

  useEffect(() => {
    api.onboardingConfig().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    setOutletName(agent.outlet_name || '');
    setTownVillage(agent.town_village || '');
    setPersonalPhone(agent.personal_phone || '');
    setCompetitors(agent.competitors_present || []);
    setBranding(agent.branding_present || []);
    setPhotoPreview(agent.location_photo_url || null);
    setPhotoFile(null);
  }, [agent.id, agent.location_photo_url]);

  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const toggle = (list: string[], item: string, setter: (v: string[]) => void) => {
    setter(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (photoFile) {
        await api.agents.uploadLocationPhoto(agent.id, photoFile);
      }
      const updated = await api.agents.update(agent.id, {
        outlet_name: outletName.trim(),
        town_village: townVillage.trim(),
        personal_phone: personalPhone.trim(),
        competitors_present: competitors,
        branding_present: branding
      });
      onUpdated(updated);
      setEditing(false);
      setPhotoFile(null);
      toast.success('Location details updated');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-apsBlue';

  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Location & branding
        </h4>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs font-medium text-apsBlue hover:underline">
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Outlet name
            </label>
            <input
              className={inputClass}
              value={outletName}
              onChange={(e) => setOutletName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Town / village
            </label>
            <input
              className={inputClass}
              value={townVillage}
              onChange={(e) => setTownVillage(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Personal contact
            </label>
            <input
              className={inputClass}
              value={personalPhone}
              onChange={(e) => setPersonalPhone(e.target.value)}
            />
          </div>

          {config && (
            <>
              <div>
                <div className="text-xs font-medium text-slate-600 mb-2">
                  Competitors at location
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {config.competitor_names.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggle(competitors, c, setCompetitors)}
                      className={cn(
                        'px-2 py-1 rounded-full text-[11px] font-medium border',
                        competitors.includes(c)
                          ? 'bg-apsBlue text-white border-apsBlue'
                          : 'bg-white text-slate-600 border-slate-200'
                      )}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-600 mb-2">
                  Branding at location
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {config.branding_types.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => toggle(branding, b, setBranding)}
                      className={cn(
                        'px-2 py-1 rounded-full text-[11px] font-medium border',
                        branding.includes(b)
                          ? 'bg-apsGreen text-white border-apsGreen'
                          : 'bg-white text-slate-600 border-slate-200'
                      )}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">
              Location photo
            </label>
            <label className="block rounded-lg border-2 border-dashed border-slate-200 overflow-hidden cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
              />
              {photoPreview ? (
                <img src={photoPreview} alt="" className="w-full h-32 object-cover" />
              ) : (
                <div className="flex flex-col items-center py-6 text-slate-400">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-xs">Upload photo</span>
                </div>
              )}
            </label>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={save}
              className="flex-1 py-2 rounded-lg bg-apsBlue text-white text-xs font-medium disabled:opacity-60 flex items-center justify-center gap-1">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(false);
                setPhotoFile(null);
                setPhotoPreview(agent.location_photo_url || null);
              }}
              className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Update outlet details, competitors, branding, and location photo after
          onboarding.
        </p>
      )}
    </div>
  );
}
