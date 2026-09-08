import React, { useState } from 'react';
import { Bill, Member, ItemAssignment, SplitResult } from '../types';
import { calculateSplit } from '../services/api';
import { Users, Plus, Trash2, Check, AlertTriangle, RefreshCw } from 'lucide-react';
import { formatMoney } from '../utils/money';

interface AssignPageProps {
  bill: Bill;
  members: Member[];
  assignments: ItemAssignment[];
  onUpdateMembers: (members: Member[]) => void;
  onUpdateAssignments: (assignments: ItemAssignment[]) => void;
  onSplitCalculated: (result: SplitResult) => void;
}

export const AssignPage: React.FC<AssignPageProps> = ({ 
  bill, 
  members, 
  assignments, 
  onUpdateMembers, 
  onUpdateAssignments,
  onSplitCalculated
}) => {
  const [newMemberName, setNewMemberName] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    
    const newMember: Member = {
      id: `member-${Date.now()}`,
      name: newMemberName.trim()
    };
    
    onUpdateMembers([...members, newMember]);
    setNewMemberName('');
  };

  const removeMember = (id: string) => {
    onUpdateMembers(members.filter(m => m.id !== id));
    // Remove member from all assignments
    const newAssignments = assignments.map(a => ({
      ...a,
      member_ids: a.member_ids.filter(mId => mId !== id)
    }));
    onUpdateAssignments(newAssignments);
  };

  const toggleAssignment = (itemId: string, memberId: string) => {
    const existing = assignments.find(a => a.item_id === itemId);
    let newAssignments = [...assignments];
    
    if (existing) {
      const idx = newAssignments.findIndex(a => a.item_id === itemId);
      const isAssigned = existing.member_ids.includes(memberId);
      
      if (isAssigned) {
        newAssignments[idx] = {
          ...existing,
          member_ids: existing.member_ids.filter(id => id !== memberId)
        };
      } else {
        newAssignments[idx] = {
          ...existing,
          member_ids: [...existing.member_ids, memberId]
        };
      }
    } else {
      newAssignments.push({
        item_id: itemId,
        member_ids: [memberId]
      });
    }
    
    onUpdateAssignments(newAssignments);
  };

  const assignAllToItem = (itemId: string) => {
    const existingIdx = assignments.findIndex(a => a.item_id === itemId);
    let newAssignments = [...assignments];
    
    if (existingIdx >= 0) {
      newAssignments[existingIdx] = {
        item_id: itemId,
        member_ids: members.map(m => m.id)
      };
    } else {
      newAssignments.push({
        item_id: itemId,
        member_ids: members.map(m => m.id)
      });
    }
    
    onUpdateAssignments(newAssignments);
  };

  const isAssignedToMember = (itemId: string, memberId: string) => {
    const assignment = assignments.find(a => a.item_id === itemId);
    return assignment ? assignment.member_ids.includes(memberId) : false;
  };

  const getUnassignedItems = () => {
    return bill.items.filter(item => {
      const assignment = assignments.find(a => a.item_id === item.id);
      return !assignment || assignment.member_ids.length === 0;
    });
  };

  const unassignedItems = getUnassignedItems();
  const canCalculate = members.length >= 2 && unassignedItems.length === 0;

  const handleCalculate = async () => {
    if (!canCalculate) return;
    
    setIsCalculating(true);
    setError(null);
    try {
      const result = await calculateSplit(bill, members, assignments);
      onSplitCalculated(result);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate split');
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-1/3 flex flex-col space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-6 border-b border-gray-100 pb-4">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-900">Members</h2>
          </div>
          
          <form onSubmit={addMember} className="flex space-x-2 mb-6">
            <input 
              type="text" 
              value={newMemberName} 
              onChange={e => setNewMemberName(e.target.value)}
              placeholder="Enter name"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button 
              type="submit"
              disabled={!newMemberName.trim()}
              className="bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>
          
          {members.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">Add at least two people to start assigning items.</p>
          ) : (
            <ul className="space-y-2">
              {members.map(member => (
                <li key={member.id} className="flex justify-between items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-100">
                  <span className="font-medium text-gray-700 text-sm">{member.name}</span>
                  <button 
                    onClick={() => removeMember(member.id)}
                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          
          {members.length < 2 && members.length > 0 && (
            <p className="text-xs text-amber-600 mt-4 flex items-center">
              <AlertTriangle className="w-3 h-3 mr-1" /> Add at least one more person
            </p>
          )}
        </div>
      </div>

      <div className="w-full md:w-2/3 flex flex-col space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Assign Items</h2>
            {unassignedItems.length > 0 && (
              <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1" /> {unassignedItems.length} items left to assign
              </span>
            )}
          </div>
          
          {members.length < 1 ? (
            <div className="p-12 text-center text-gray-500 flex-1 flex items-center justify-center">
              Add members first to start assigning items.
            </div>
          ) : (
            <div className="p-0 overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 bg-white sticky top-0">
                    <th className="py-3 px-4 font-semibold">Item</th>
                    <th className="py-3 px-4 font-semibold text-right w-24">Total</th>
                    <th className="py-3 px-4 font-semibold w-24 text-center">Actions</th>
                    {members.map(m => (
                      <th key={m.id} className="py-3 px-2 font-semibold text-center truncate max-w-[80px]">
                        <div title={m.name} className="truncate">{m.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bill.items.map((item) => {
                    const isUnassigned = unassignedItems.some(ui => ui.id === item.id);
                    return (
                      <tr key={item.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${isUnassigned ? 'bg-red-50/50' : ''}`}>
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                          <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-gray-900 text-sm">
                          {formatMoney(item.total_price, bill.currency)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button 
                            onClick={() => assignAllToItem(item.id)}
                            className="text-[10px] uppercase font-bold bg-gray-200 text-gray-600 px-2 py-1 rounded hover:bg-gray-300 transition-colors"
                          >
                            Everyone
                          </button>
                        </td>
                        {members.map(m => {
                          const isAssigned = isAssignedToMember(item.id, m.id);
                          return (
                            <td key={m.id} className="py-3 px-2 text-center" onClick={() => toggleAssignment(item.id, m.id)}>
                              <div className="flex justify-center cursor-pointer">
                                <div className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${
                                  isAssigned ? 'bg-indigo-600 text-white' : 'bg-gray-200 border border-gray-300'
                                }`}>
                                  {isAssigned && <Check className="w-4 h-4" />}
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          
          <div className="p-6 border-t border-gray-100 bg-gray-50 mt-auto">
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start border border-red-100">
                <AlertTriangle className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            
            <button
              onClick={handleCalculate}
              disabled={!canCalculate || isCalculating}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-indigo-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCalculating ? (
                <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Calculating...</>
              ) : (
                'Calculate Split'
              )}
            </button>
            
            {!canCalculate && members.length >= 2 && (
              <p className="text-center text-sm text-red-500 mt-2">
                Please assign all items before calculating.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
