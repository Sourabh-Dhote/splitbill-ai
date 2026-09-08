import React from 'react';
import { SplitResult } from '../types';
import { formatMoney } from '../utils/money';
import { Receipt, Check, AlertTriangle } from 'lucide-react';

interface SplitPageProps {
  result: SplitResult;
  currency: string;
  onReset: () => void;
}

export const SplitPage: React.FC<SplitPageProps> = ({ result, currency, onReset }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Final Split</h2>
        <p className="text-gray-500">Here's how much everyone owes</p>
      </div>

      {result.notes.length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-8">
          <h4 className="font-semibold text-blue-900 mb-2 text-sm uppercase tracking-wider">Calculation Notes</h4>
          <ul className="list-disc pl-5 space-y-1">
            {result.notes.map((note, idx) => (
              <li key={idx} className="text-sm text-blue-800">{note}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {result.person_breakdowns.map((person) => (
          <div key={person.member.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">{person.member.name}</h3>
              <span className="font-bold text-xl">{formatMoney(person.total, currency)}</span>
            </div>
            
            <div className="p-4 flex-1">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Items</h4>
              <div className="space-y-3 mb-6">
                {person.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start text-sm">
                    <div>
                      <span className="text-gray-800">{item.item_name}</span>
                      {item.shared_with_count > 1 && (
                        <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          ÷{item.shared_with_count}
                        </span>
                      )}
                    </div>
                    <span className="text-gray-900 font-medium">{formatMoney(item.share_amount, currency)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Item Subtotal</span>
                  <span>{formatMoney(person.item_subtotal, currency)}</span>
                </div>
                
                {person.discount_share > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount Share</span>
                    <span>-{formatMoney(person.discount_share, currency)}</span>
                  </div>
                )}
                
                {person.tax_shares.map((tax, idx) => (
                  <div key={idx} className="flex justify-between text-gray-600">
                    <span>{tax.tax_name}</span>
                    <span>{formatMoney(tax.amount, currency)}</span>
                  </div>
                ))}
                
                {person.service_charge_share > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Service Charge</span>
                    <span>{formatMoney(person.service_charge_share, currency)}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center font-bold text-gray-900">
              <span>Total Owed</span>
              <span className="text-lg text-indigo-700">{formatMoney(person.total, currency)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center mb-1">
              <Receipt className="w-5 h-5 mr-2 text-gray-500" /> Summary
            </h3>
            <p className="text-sm text-gray-500 mb-4 md:mb-0">
              Total calculated from splits: <span className="font-semibold text-gray-900">{formatMoney(result.calculated_total, currency)}</span>
            </p>
          </div>
          
          <div className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium ${
            result.verified ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {result.verified ? (
              <><Check className="w-5 h-5 mr-2" /> Split verified — totals match exactly</>
            ) : (
              <><AlertTriangle className="w-5 h-5 mr-2" /> Difference of {formatMoney(Math.abs(result.difference), currency)} from printed bill total</>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-center pt-8">
        <button
          onClick={onReset}
          className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center"
        >
          Start Over
        </button>
      </div>
    </div>
  );
};
