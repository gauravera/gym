'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function MockGatewayPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState('');
  const [key, setKey] = useState('');
  const [member, setMember] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'SUCCESS' | 'FAILURE'>('IDLE');

  useEffect(() => {
    setTransactionId(searchParams.get('transactionId') || 'tx_demo123');
    setAmount(searchParams.get('amount') || '999');
    setKey(searchParams.get('key') || 'rzp_test_mock123');
    setMember(searchParams.get('member') || 'Test Member');
  }, [searchParams]);

  const handleSimulatePayment = async (success: boolean) => {
    setIsProcessing(true);
    
    if (!success) {
      setTimeout(() => {
        setIsProcessing(false);
        setStatus('FAILURE');
      }, 1500);
      return;
    }

    try {
      // Formulate a mock Razorpay payment capture webhook payload
      const payload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_${Math.random().toString(36).substring(2, 11)}`,
              amount: parseFloat(amount) * 100, // Razorpay amount in paise
              currency: 'INR',
              status: 'captured',
              order_id: `order_${Math.random().toString(36).substring(2, 11)}`,
              method: 'upi',
              notes: {
                transactionId: transactionId,
              },
            },
          },
        },
      };

      const res = await fetch('/api/webhook/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setStatus('SUCCESS');
      } else {
        setStatus('FAILURE');
      }
    } catch (err) {
      console.error(err);
      setStatus('FAILURE');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-100">
      <div className="w-full max-w-md rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
        {/* Razorpay Brand Header */}
        <div className="bg-blue-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-6 w-6 rounded bg-white flex items-center justify-center text-blue-600 font-extrabold text-sm">
              R
            </span>
            <span className="font-extrabold text-sm tracking-wide text-white">razorpay</span>
          </div>
          <span className="rounded bg-blue-700/60 px-2 py-0.5 text-[9px] font-bold text-blue-200 border border-blue-600/40 uppercase">
            Test Mode Sandbox
          </span>
        </div>

        {status === 'IDLE' ? (
          <div className="p-6 space-y-6">
            {/* Merchant Details */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
              <div>
                <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">Gym Subscriber</span>
                <span className="block text-sm font-bold text-slate-200">{member}</span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] text-slate-500 uppercase tracking-widest font-bold">Amount Due</span>
                <span className="block text-base font-extrabold text-blue-400">₹{amount}</span>
              </div>
            </div>

            {/* Security Check */}
            <div className="rounded-xl bg-slate-900/40 border border-slate-800 p-4 flex gap-3 text-xs leading-relaxed text-slate-400">
              <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <p>
                This is a secure gateway simulation. FitFlow has dynamically generated this sandbox checkout linked to transaction ID: <code className="bg-slate-900 px-1 py-0.5 rounded text-slate-300 font-mono">{transactionId.slice(-8)}</code>.
              </p>
            </div>

            {/* Payment simulation choices */}
            <div className="space-y-3">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Simulate Transaction Event</span>
              
              <button
                onClick={() => handleSimulatePayment(true)}
                disabled={isProcessing}
                className="w-full flex items-center justify-between rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white hover:bg-emerald-500 transition-all disabled:opacity-50"
              >
                <span>Authorize & Complete Payment (Success)</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => handleSimulatePayment(false)}
                disabled={isProcessing}
                className="w-full flex items-center justify-between rounded-xl border border-slate-850 hover:bg-slate-900 px-4 py-3 text-xs font-bold text-rose-400 transition-all disabled:opacity-50"
              >
                <span>Simulate Decline / Gateway Timeout (Failure)</span>
                <AlertCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : status === 'SUCCESS' ? (
          <div className="p-8 text-center space-y-6 flex flex-col items-center">
            <div className="rounded-full bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Payment Authorized!</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                The Razorpay Webhook listener successfully captured the event. The transaction has been updated, subscription activated, and invoice prepared.
              </p>
            </div>
            <button
              onClick={() => router.back()}
              className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-slate-300 hover:bg-slate-850 transition-all border border-slate-800"
            >
              Return to Chat Sandbox
            </button>
          </div>
        ) : (
          <div className="p-8 text-center space-y-6 flex flex-col items-center">
            <div className="rounded-full bg-rose-500/10 border border-rose-500/20 p-4 text-rose-400">
              <AlertCircle className="h-12 w-12" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Payment Failed</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                The mock transaction was declined or timed out. No active subscriptions were created or modified.
              </p>
            </div>
            <div className="flex w-full gap-3">
              <button
                onClick={() => setStatus('IDLE')}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white hover:bg-blue-500 transition-all"
              >
                Retry Simulation
              </button>
              <button
                onClick={() => router.back()}
                className="flex-1 rounded-xl border border-slate-800 bg-slate-900 py-3 text-xs font-bold text-slate-300 hover:bg-slate-850 transition-all"
              >
                Go Back
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-950 border-t border-slate-900/60 px-6 py-3 text-center text-[10px] text-slate-600 font-medium">
          🔒 Secured by Razorpay. Powered by FitFlow SaaS.
        </div>
      </div>
    </div>
  );
}
