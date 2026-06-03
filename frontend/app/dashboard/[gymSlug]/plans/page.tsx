'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { CreditCard, Trash2, Plus, Clock, Activity } from 'lucide-react';

interface PlanData {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationDays: number;
}

export default function PlansPage() {
  const { gymSlug } = useParams() as { gymSlug: string };
  const [plans, setPlans] = useState<PlanData[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // New Plan Form fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [durationDays, setDurationDays] = useState('30');

  const fetchPlans = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans`);
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [gymSlug]);

  const handleAddPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          price: parseFloat(price),
          durationDays: parseInt(durationDays),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsAdding(false);
        setName('');
        setDescription('');
        setPrice('');
        setDurationDays('30');
        await fetchPlans();
      } else {
        setError(data.error || 'Failed to create plan.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this membership plan? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/dashboard/${gymSlug}/plans/${planId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchPlans();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Membership Plans</h2>
          <p className="text-xs text-zinc-500 mt-1">Configure durations, pricing models, and benefits for your gym members.</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-bold text-white transition-all hover:bg-cyan-500"
        >
          <Plus className="h-4 w-4" /> Create New Plan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Plans Grid */}
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-xs text-zinc-500 bg-zinc-950/40 rounded-2xl border border-zinc-900">Loading plans...</div>
          ) : plans.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-zinc-500 bg-zinc-950/40 rounded-2xl border border-dashed border-zinc-800">
              <CreditCard className="h-8 w-8 text-zinc-700 mb-2" />
              <p className="text-sm font-semibold">No subscription plans found</p>
              <button
                onClick={() => setIsAdding(true)}
                className="mt-2 text-xs font-bold text-cyan-400 hover:underline"
              >
                Create your first plan now
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {plans.map((p) => (
                <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6 backdrop-blur-md transition-all hover:border-zinc-700">
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">{p.name}</h3>
                      <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-zinc-500">
                        <Clock className="h-3 w-3 text-cyan-400" /> {p.durationDays} Days Duration
                      </div>
                    </div>
                    
                    {/* Delete Plan */}
                    <button
                      onClick={() => handleDeletePlan(p.id)}
                      className="rounded-lg p-1.5 text-zinc-600 hover:bg-rose-500/10 hover:text-rose-400 transition-all"
                      title="Delete Plan"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mb-4">
                    <span className="text-2xl font-extrabold text-white">₹{p.price}</span>
                    <span className="text-[10px] text-zinc-500 ml-1 font-medium">net price</span>
                  </div>

                  <p className="text-xs text-zinc-400 leading-relaxed min-h-[40px]">
                    {p.description || 'Gives full access to all generic weights, cardio zones & trainers.'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Plan Card */}
        {isAdding ? (
          <div className="rounded-2xl border border-cyan-800 bg-zinc-950/70 p-6 shadow-2xl shadow-cyan-950/10 h-fit lg:col-span-1">
            <h3 className="text-base font-bold text-white mb-4">Create Membership Plan</h3>
            
            {error && (
              <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400">
                {error}
              </div>
            )}

            <form onSubmit={handleAddPlan} className="space-y-4 text-xs">
              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Plan Name</label>
                <input
                  type="text"
                  placeholder="e.g. 6 Months Premium"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Price (₹ INR)</label>
                  <input
                    type="number"
                    placeholder="2999"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Duration (Days)</label>
                  <select
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="30">30 Days (Monthly)</option>
                    <option value="90">90 Days (Quarterly)</option>
                    <option value="180">180 Days (Half-Yearly)</option>
                    <option value="365">365 Days (Annual)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-zinc-400 uppercase tracking-wider">Plan Description</label>
                <textarea
                  placeholder="List gym perks, timing access or trainer allowances..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-cyan-600 py-3 font-bold text-white hover:bg-cyan-500"
                >
                  Create Plan
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="flex-1 rounded-xl border border-zinc-800 py-3 font-bold text-zinc-400 hover:bg-zinc-850"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 flex flex-col items-center justify-center text-center text-zinc-500 lg:col-span-1 h-64">
            <Activity className="h-10 w-10 text-zinc-700 mb-2" />
            <h4 className="text-sm font-bold text-white font-sans">Custom Plans Builder</h4>
            <p className="text-xs text-zinc-500 mt-1 max-w-[200px] leading-relaxed">
              Define customized durations and distinct pricing plans for your members.
            </p>
            <button
              onClick={() => setIsAdding(true)}
              className="mt-4 rounded-xl border border-zinc-850 px-4 py-2 text-xs font-semibold text-cyan-400 hover:bg-zinc-900 hover:text-white transition-all"
            >
              Build New Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
