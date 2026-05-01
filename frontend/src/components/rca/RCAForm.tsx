import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { incidentsApi } from '../../api/incidents';
import { RCA, Incident } from '../../types';
import toast from 'react-hot-toast';

const RCA_CATEGORIES = [
  'Infrastructure Failure', 'Software Bug', 'Configuration Error',
  'Capacity Issue', 'Network Issue', 'Security Incident',
  'Third-Party Service Failure', 'Human Error', 'Deployment Issue',
  'Database Issue', 'Unknown',
];

interface Props {
  incidentId: string;
  existingRca?: RCA;
  incident: Incident;
  onSuccess: () => void;
}

export const RCAForm: React.FC<Props> = ({ incidentId, existingRca, incident, onSuccess }) => {
  const [form, setForm] = useState({
    incident_start_time: existingRca?.incident_start_time || incident.first_signal_at || incident.created_at,
    incident_end_time: existingRca?.incident_end_time || incident.resolved_at || new Date().toISOString(),
    root_cause_category: existingRca?.root_cause_category || '',
    root_cause_summary: existingRca?.root_cause_summary || '',
    fix_applied: existingRca?.fix_applied || '',
    prevention_steps: existingRca?.prevention_steps || '',
    lessons_learned: existingRca?.lessons_learned || '',
    draft: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (data: typeof form) => incidentsApi.submitRCA(incidentId, data),
    onSuccess: () => {
      toast.success('RCA submitted successfully');
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to submit RCA');
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.root_cause_category) errs.root_cause_category = 'Category is required';
    if (form.root_cause_summary.length < 10) errs.root_cause_summary = 'Summary must be at least 10 characters';
    if (form.fix_applied.length < 5) errs.fix_applied = 'Fix description is required';
    if (form.prevention_steps.length < 5) errs.prevention_steps = 'Prevention steps are required';
    if (!form.incident_start_time) errs.incident_start_time = 'Start time is required';
    if (!form.incident_end_time) errs.incident_end_time = 'End time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (draft: boolean) => {
    if (!draft && !validate()) return;
    mutation.mutate({ ...form, draft });
  };

  const toLocalDatetime = (iso?: string) => {
    if (!iso) return '';
    return new Date(iso).toISOString().slice(0, 16);
  };

  return (
    <div className="card p-6">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-6">
        Root Cause Analysis
        {existingRca?.draft && (
          <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-2 py-0.5 rounded">
            Draft
          </span>
        )}
      </h3>

      <div className="space-y-5">
        {/* Time range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Incident Start Time *</label>
            <input
              type="datetime-local"
              className="input"
              value={toLocalDatetime(form.incident_start_time)}
              onChange={e => setForm(f => ({ ...f, incident_start_time: new Date(e.target.value).toISOString() }))}
            />
            {errors.incident_start_time && <p className="text-xs text-red-500 mt-1">{errors.incident_start_time}</p>}
          </div>
          <div>
            <label className="label">Incident End Time *</label>
            <input
              type="datetime-local"
              className="input"
              value={toLocalDatetime(form.incident_end_time)}
              onChange={e => setForm(f => ({ ...f, incident_end_time: new Date(e.target.value).toISOString() }))}
            />
            {errors.incident_end_time && <p className="text-xs text-red-500 mt-1">{errors.incident_end_time}</p>}
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="label">Root Cause Category *</label>
          <select
            className="input"
            value={form.root_cause_category}
            onChange={e => setForm(f => ({ ...f, root_cause_category: e.target.value }))}
          >
            <option value="">Select a category...</option>
            {RCA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {errors.root_cause_category && <p className="text-xs text-red-500 mt-1">{errors.root_cause_category}</p>}
        </div>

        {/* Root cause summary */}
        <div>
          <label className="label">Root Cause Summary *</label>
          <textarea
            className="input resize-none"
            rows={4}
            placeholder="Describe the root cause in detail. What went wrong and why?"
            value={form.root_cause_summary}
            onChange={e => setForm(f => ({ ...f, root_cause_summary: e.target.value }))}
          />
          {errors.root_cause_summary && <p className="text-xs text-red-500 mt-1">{errors.root_cause_summary}</p>}
        </div>

        {/* Fix applied */}
        <div>
          <label className="label">Fix Applied *</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="What was done to fix the issue?"
            value={form.fix_applied}
            onChange={e => setForm(f => ({ ...f, fix_applied: e.target.value }))}
          />
          {errors.fix_applied && <p className="text-xs text-red-500 mt-1">{errors.fix_applied}</p>}
        </div>

        {/* Prevention steps */}
        <div>
          <label className="label">Prevention Steps *</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="What steps will prevent this from happening again?"
            value={form.prevention_steps}
            onChange={e => setForm(f => ({ ...f, prevention_steps: e.target.value }))}
          />
          {errors.prevention_steps && <p className="text-xs text-red-500 mt-1">{errors.prevention_steps}</p>}
        </div>

        {/* Lessons learned */}
        <div>
          <label className="label">Lessons Learned</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="What did the team learn from this incident?"
            value={form.lessons_learned}
            onChange={e => setForm(f => ({ ...f, lessons_learned: e.target.value }))}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => handleSubmit(true)}
            disabled={mutation.isPending}
            className="btn-secondary"
          >
            Save Draft
          </button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={mutation.isPending}
            className="btn-primary"
          >
            {mutation.isPending ? 'Submitting...' : 'Submit RCA'}
          </button>
        </div>
      </div>
    </div>
  );
};
