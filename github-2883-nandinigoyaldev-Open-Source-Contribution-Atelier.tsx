import { useState, useMemo } from 'react';
import { Bounty } from '../types';

interface BountiesPageProps {
  bounties: Bounty[];
}

const BountiesPage: React.FC<BountiesPageProps> = ({ bounties }) => {
  const [minReward, setMinReward] = useState<number>(0);

  const filteredBounties = useMemo(() => {
    return bounties.filter(bounty => {
      const rewardValue = bounty.reward?.value || 0;
      return rewardValue >= minReward;
    });
  }, [bounties, minReward]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Bounties</h1>
      
      {/* Minimum Currency Reward Filter Slider */}
      <div className="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <label htmlFor="min-reward-slider" className="block text-sm font-medium text-gray-700">
              Minimum Reward: ${minReward}
            </label>
            <p className="text-xs text-gray-500 mt-1">Filter bounties by minimum reward amount (USD)</p>
          </div>
          
          <div className="flex items-center gap-4">
            <input
              id="min-reward-slider"
              type="range"
              min="0"
              max="1000"
              step="10"
              value={minReward}
              onChange={(e) => setMinReward(Number(e.target.value))}
              className="w-48 sm:w-64 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              aria-label="Minimum reward filter slider"
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Min:</span>
              <input
                type="number"
                min="0"
                max="1000"
                step="10"
                value={minReward}
                onChange={(e) => setMinReward(Math.min(1000, Math.max(0, Number(e.target.value))))}
                className="w-20 px-2 py-1 border border-gray-300 rounded-md text-sm"
                aria-label="Minimum reward input"
              />
              <span className="text-sm text-gray-600">USD</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredBounties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No bounties match the selected minimum reward criteria.
          </div>
        ) : (
          filteredBounties.map(bounty => (
            <div key={bounty.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">{bounty.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{bounty.description}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">
                    ${bounty.reward?.value} {bounty.reward?.currency}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {bounty.reward?.description}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default BountiesPage;